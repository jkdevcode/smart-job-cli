import { all, get, run } from '../storage/db.js';
import { loadJobSearchRules } from '../utils/jobRules.js';
import { formatJobModality, JOB_MODALITIES } from '../utils/modality.js';

export const JOB_STATUSES = Object.freeze(['new', 'applied', 'ignored']);

const VALID_STATUSES = new Set(JOB_STATUSES);
const VALID_JOB_MODALITIES = new Set(JOB_MODALITIES);

function assertValidStatus(status) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Estado invalido: ${status}`);
  }
}

function assertValidId(id) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('El ID debe ser un entero positivo.');
  }
}

export async function saveJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return 0;
  }

  let inserted = 0;

  for (const job of jobs) {
    if (!job.title || !job.company || !job.link) {
      continue;
    }

    const modality = formatJobModality(job.modality);

    const result = await run(
      `
        INSERT OR IGNORE INTO jobs (title, company, link, modality)
        VALUES (?, ?, ?, ?)
      `,
      [job.title, job.company, job.link, modality]
    );

    if (result.changes === 0 && modality !== 'unknown') {
      await run(
        `
          UPDATE jobs
          SET modality = ?
          WHERE link = ?
            AND (modality IS NULL OR modality = '' OR modality = 'unknown')
        `,
        [modality, job.link]
      );
    }

    inserted += result.changes;
  }

  return inserted;
}

export async function getJobsByStatus(status = 'new') {
  assertValidStatus(status);

  return getJobs({ status });
}

export async function getJobs({ status = 'new', modality = 'all' } = {}) {
  assertValidStatus(status);

  const normalizedModality = String(modality || 'all').trim().toLowerCase();

  if (normalizedModality !== 'all' && !VALID_JOB_MODALITIES.has(normalizedModality)) {
    throw new Error(`Modalidad invalida: ${modality}`);
  }

  if (normalizedModality === 'all') {
    return all(
      `
        SELECT id, title, company, link, status, createdAt
             , modality
        FROM jobs
        WHERE status = ?
        ORDER BY createdAt DESC, id DESC
      `,
      [status]
    );
  }

  return all(
    `
      SELECT id, title, company, link, status, createdAt
           , modality
      FROM jobs
      WHERE status = ?
        AND modality = ?
      ORDER BY createdAt DESC, id DESC
    `,
    [status, normalizedModality]
  );
}

export async function getJobById(id) {
  assertValidId(id);

  return get(
    `
      SELECT id, title, company, link, status, createdAt
           , modality
      FROM jobs
      WHERE id = ?
    `,
    [id]
  );
}

export async function filterJobsByRules(jobs) {
  return applyRulesToJobs(jobs, { excludeNegative: true });
}

export async function rankJobsByRules(jobs) {
  return applyRulesToJobs(jobs, { excludeNegative: false });
}

export async function updateJobStatus(id, status) {
  assertValidId(id);
  assertValidStatus(status);

  const result = await run('UPDATE jobs SET status = ? WHERE id = ?', [status, id]);
  return result.changes;
}

async function applyRulesToJobs(jobs, { excludeNegative }) {
  const { rules, warning } = await loadJobSearchRules();
  const safeJobs = Array.isArray(jobs) ? jobs : [];

  const annotatedJobs = safeJobs.map((job, index) => {
    const searchableText = [job.title, job.company, job.link, job.modality]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchedPositiveKeywords = rules.positiveKeywords.filter((keyword) =>
      searchableText.includes(keyword)
    );

    const matchedNegativeKeywords = rules.negativeKeywords.filter((keyword) =>
      searchableText.includes(keyword)
    );

    return {
      ...job,
      score: matchedPositiveKeywords.length,
      match: matchedPositiveKeywords.length > 0,
      matchedPositiveKeywords,
      matchedNegativeKeywords,
      __originalIndex: index
    };
  });

  const filteredJobs = excludeNegative
    ? annotatedJobs.filter((job) => job.matchedNegativeKeywords.length === 0)
    : annotatedJobs;

  const sortedJobs = filteredJobs
    .slice()
    .sort((left, right) => right.score - left.score || left.__originalIndex - right.__originalIndex)
    .map(({ __originalIndex, ...job }) => job);

  return {
    jobs: sortedJobs,
    warning,
    rules,
    removedCount: annotatedJobs.length - filteredJobs.length,
    matchedCount: sortedJobs.filter((job) => job.match).length
  };
}
