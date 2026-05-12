import { all, get, run } from '../storage/db.js';
import { loadJobSearchRules } from '../utils/jobRules.js';
import { analyzeJob } from '../utils/jobScore.js';
import { formatJobModality, JOB_MODALITIES } from '../utils/modality.js';

export const JOB_STATUSES = Object.freeze(['new', 'reviewing', 'applied', 'ignored']);

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

  const { rules } = await loadJobSearchRules();
  let inserted = 0;

  for (const job of jobs) {
    if (!job.title || !job.company || !job.link) {
      continue;
    }

    const modality = formatJobModality(job.modality);
    const location = String(job.location || '').trim();
    const language = formatJobLanguage(job.language);
    const languageConfidence = formatJobLanguageConfidence(job.languageConfidence);
    const englishRequirement = formatJobEnglishRequirement(job.englishRequirement);
    const languageEvidence = String(job.languageEvidence || '').trim();
    const source = String(job.source || 'linkedin').trim().toLowerCase() || 'linkedin';
    const analysis = analyzeJob(
      {
        ...job,
        modality,
        language,
        englishRequirement,
        languageEvidence,
        source
      },
      rules
    );

    const result = await run(
      `
        INSERT OR IGNORE INTO jobs (
          title, company, link, location, modality, language,
          languageConfidence, englishRequirement, languageEvidence,
          score, lastSeenAt, source, seniority, redFlags
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
      `,
      [
        job.title,
        job.company,
        job.link,
        location,
        modality,
        language,
        languageConfidence,
        englishRequirement,
        languageEvidence,
        analysis.score,
        source,
        analysis.seniority,
        analysis.redFlagsText
      ]
    );

    if (result.changes === 0) {
      await run(
        `
          UPDATE jobs
          SET location = CASE
                WHEN (location IS NULL OR location = '') AND ? <> '' THEN ?
                ELSE location
              END,
              modality = CASE
                WHEN (modality IS NULL OR modality = '' OR modality = 'unknown') AND ? <> 'unknown' THEN ?
                ELSE modality
              END,
              language = CASE
                WHEN (language IS NULL OR language = '' OR language = 'unknown') AND ? <> 'unknown' THEN ?
                ELSE language
              END,
              languageConfidence = CASE
                WHEN (languageConfidence IS NULL OR languageConfidence = 0) AND ? > 0 THEN ?
                ELSE languageConfidence
              END,
              englishRequirement = CASE
                WHEN (englishRequirement IS NULL OR englishRequirement = '' OR englishRequirement = 'unknown') AND ? <> 'unknown' THEN ?
                ELSE englishRequirement
              END,
              languageEvidence = CASE
                WHEN (languageEvidence IS NULL OR languageEvidence = '') AND ? <> '' THEN ?
                ELSE languageEvidence
              END,
              score = ?,
              lastSeenAt = CURRENT_TIMESTAMP,
              source = ?,
              seniority = ?,
              redFlags = ?
          WHERE link = ?
        `,
        [
          location,
          location,
          modality,
          modality,
          language,
          language,
          languageConfidence,
          languageConfidence,
          englishRequirement,
          englishRequirement,
          languageEvidence,
          languageEvidence,
          analysis.score,
          source,
          analysis.seniority,
          analysis.redFlagsText,
          job.link
        ]
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
             , location, modality, language, languageConfidence, englishRequirement, languageEvidence
             , score, lastSeenAt, source, seniority, redFlags
        FROM jobs
        WHERE status = ?
        ORDER BY score DESC, createdAt DESC, id DESC
      `,
      [status]
    );
  }

  return all(
    `
      SELECT id, title, company, link, status, createdAt
           , location, modality, language, languageConfidence, englishRequirement, languageEvidence
           , score, lastSeenAt, source, seniority, redFlags
      FROM jobs
      WHERE status = ?
        AND modality = ?
      ORDER BY score DESC, createdAt DESC, id DESC
    `,
    [status, normalizedModality]
  );
}

export async function getJobById(id) {
  assertValidId(id);

  return get(
    `
      SELECT id, title, company, link, status, createdAt
           , location, modality, language, languageConfidence, englishRequirement, languageEvidence
           , score, lastSeenAt, source, seniority, redFlags
      FROM jobs
      WHERE id = ?
    `,
    [id]
  );
}

export async function getJobStats() {
  const totals = await get(
    `
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS newCount,
             SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) AS reviewingCount,
             SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) AS appliedCount,
             SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) AS ignoredCount
      FROM jobs
    `
  );
  const topCompanies = await all(
    `
      SELECT company AS value, COUNT(*) AS count
      FROM jobs
      WHERE TRIM(COALESCE(company, '')) <> ''
      GROUP BY company
      ORDER BY count DESC, company ASC
      LIMIT 5
    `
  );
  const topLocations = await all(
    `
      SELECT location AS value, COUNT(*) AS count
      FROM jobs
      WHERE TRIM(COALESCE(location, '')) <> ''
      GROUP BY location
      ORDER BY count DESC, location ASC
      LIMIT 5
    `
  );
  const modalityCounts = await all(
    `
      SELECT modality AS value, COUNT(*) AS count
      FROM jobs
      WHERE TRIM(COALESCE(modality, '')) <> ''
      GROUP BY modality
      ORDER BY count DESC, modality ASC
    `
  );

  return {
    total: Number(totals?.total || 0),
    statuses: {
      new: Number(totals?.newCount || 0),
      reviewing: Number(totals?.reviewingCount || 0),
      applied: Number(totals?.appliedCount || 0),
      ignored: Number(totals?.ignoredCount || 0)
    },
    topCompanies,
    topLocations,
    modalityCounts
  };
}

export async function getJobsForExport() {
  return all(
    `
      SELECT id, title, company, location, modality, language, status, score, link
      FROM jobs
      ORDER BY score DESC, createdAt DESC, id DESC
    `
  );
}

export async function cleanupJobs({ maxAgeDays = 45 } = {}) {
  const maxAgeModifier = `-${Math.max(1, Number.parseInt(maxAgeDays, 10) || 45)} days`;
  const staleJobs = await all(
    `
      SELECT id, title, company, link, COALESCE(lastSeenAt, createdAt) AS seenAt
      FROM jobs
      WHERE datetime(COALESCE(lastSeenAt, createdAt)) < datetime('now', ?)
      ORDER BY datetime(COALESCE(lastSeenAt, createdAt)) ASC, id ASC
    `,
    [maxAgeModifier]
  );
  const invalidJobs = await all(
    `
      SELECT id, title, company, link, COALESCE(lastSeenAt, createdAt) AS seenAt
      FROM jobs
      WHERE TRIM(COALESCE(title, '')) = ''
         OR TRIM(COALESCE(company, '')) = ''
         OR TRIM(COALESCE(link, '')) = ''
         OR link NOT LIKE 'http%'
      ORDER BY id ASC
    `
  );
  const duplicateJobs = await all(
    `
      SELECT jobs.id, jobs.title, jobs.company, jobs.link, COALESCE(jobs.lastSeenAt, jobs.createdAt) AS seenAt
      FROM jobs
      INNER JOIN (
        SELECT link, MAX(id) AS keepId
        FROM jobs
        WHERE TRIM(COALESCE(link, '')) <> ''
        GROUP BY link
        HAVING COUNT(*) > 1
      ) duplicates
        ON duplicates.link = jobs.link
      WHERE jobs.id <> duplicates.keepId
      ORDER BY jobs.link ASC, jobs.id ASC
    `
  );

  const idsToDelete = new Set([
    ...staleJobs.map((job) => job.id),
    ...invalidJobs.map((job) => job.id),
    ...duplicateJobs.map((job) => job.id)
  ]);
  let deleted = 0;

  for (const id of idsToDelete) {
    const result = await run('DELETE FROM jobs WHERE id = ?', [id]);
    deleted += result.changes;
  }

  const remainingRow = await get('SELECT COUNT(*) AS total FROM jobs');

  return {
    deleted,
    remaining: Number(remainingRow?.total || 0),
    preview: {
      staleJobs,
      invalidJobs,
      duplicateJobs,
      totalCandidates: idsToDelete.size
    }
  };
}

export async function filterJobsByRules(jobs) {
  return applyRulesToJobs(jobs, { excludeNegative: true });
}

export async function rankJobsByRules(jobs) {
  return applyRulesToJobs(jobs, { excludeNegative: false });
}

export async function refreshStoredJobInsights() {
  const { rules } = await loadJobSearchRules();
  const jobs = await all(
    `
      SELECT id, title, company, link, location, modality, language,
             englishRequirement, languageEvidence, score, seniority, redFlags
      FROM jobs
    `
  );

  let updated = 0;

  for (const job of jobs) {
    const analysis = analyzeJob(job, rules);
    const currentRedFlags = String(job.redFlags || '').trim();
    const nextRedFlags = analysis.redFlagsText;

    if (
      Number(job.score || 0) === analysis.score &&
      String(job.seniority || 'unknown') === analysis.seniority &&
      currentRedFlags === nextRedFlags
    ) {
      continue;
    }

    const result = await run(
      'UPDATE jobs SET score = ?, seniority = ?, redFlags = ? WHERE id = ?',
      [analysis.score, analysis.seniority, nextRedFlags, job.id]
    );

    updated += result.changes;
  }

  return updated;
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
    const analysis = analyzeJob(job, rules);

    return {
      ...job,
      score: analysis.score,
      seniority: job.seniority || analysis.seniority,
      redFlags: typeof job.redFlags === 'string' ? job.redFlags : analysis.redFlagsText,
      match: analysis.match,
      hasRedFlags: analysis.hasRedFlags,
      matchedPositiveKeywords: analysis.matchedPositiveKeywords,
      matchedNegativeKeywords: analysis.matchedNegativeKeywords,
      matchedRedFlags: analysis.matchedRedFlags,
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

function formatJobLanguage(language) {
  const normalizedValue = String(language || 'unknown').trim().toLowerCase();

  if (normalizedValue === 'spanish') {
    return 'spanish';
  }

  if (normalizedValue === 'english') {
    return 'english';
  }

  if (normalizedValue === 'mixed') {
    return 'mixed';
  }

  return 'unknown';
}

function formatJobLanguageConfidence(languageConfidence) {
  const numericValue = Number(languageConfidence);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, numericValue));
}

function formatJobEnglishRequirement(englishRequirement) {
  const normalizedValue = String(englishRequirement || 'unknown').trim().toLowerCase();

  if (normalizedValue === 'required') {
    return 'required';
  }

  if (normalizedValue === 'preferred') {
    return 'preferred';
  }

  if (normalizedValue === 'none') {
    return 'none';
  }

  return 'unknown';
}
