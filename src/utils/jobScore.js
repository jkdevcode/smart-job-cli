import { formatJobModality } from './modality.js';

export const DEFAULT_RED_FLAG_KEYWORDS = Object.freeze([
  'rockstar',
  'ninja',
  'fast-paced',
  'wear many hats',
  'competitive environment'
]);

const SENIORITY_PATTERNS = Object.freeze({
  junior: ['junior', 'jr', 'entry level', 'entry-level', 'trainee', 'intern'],
  mid: ['mid level', 'mid-level', 'semi senior', 'semisenior', 'ssr'],
  senior: ['senior', 'sr', 'specialist'],
  lead: ['lead', 'principal', 'staff', 'architect', 'manager', 'director', 'head of']
});

export function analyzeJob(job, rules = {}) {
  const searchableText = buildSearchableText(job);
  const matchedPositiveKeywords = matchKeywords(searchableText, rules.positiveKeywords);
  const matchedNegativeKeywords = matchKeywords(searchableText, rules.negativeKeywords);
  const matchedRedFlags = matchKeywords(
    searchableText,
    Array.isArray(rules.redFlagKeywords) && rules.redFlagKeywords.length > 0
      ? rules.redFlagKeywords
      : DEFAULT_RED_FLAG_KEYWORDS
  );
  const seniority = detectSeniority(searchableText);
  const score = computeScore({
    job,
    rules,
    seniority,
    matchedPositiveKeywords,
    matchedNegativeKeywords,
    matchedRedFlags
  });

  return {
    score,
    seniority,
    match: matchedPositiveKeywords.length > 0,
    hasRedFlags: matchedRedFlags.length > 0,
    matchedPositiveKeywords,
    matchedNegativeKeywords,
    matchedRedFlags,
    redFlagsText: matchedRedFlags.join('; ')
  };
}

function computeScore({ job, rules, seniority, matchedPositiveKeywords, matchedNegativeKeywords, matchedRedFlags }) {
  let score = 35;

  score += Math.min(25, matchedPositiveKeywords.length * 5);
  score -= Math.min(36, matchedNegativeKeywords.length * 18);
  score -= Math.min(28, matchedRedFlags.length * 7);
  score += getModalityScore(job.modality);
  score += getLanguageScore(job.language);
  score += getEnglishRequirementScore(job.englishRequirement);
  score += getLocationScore(job.location, rules);
  score += getSeniorityScore(seniority);

  return Math.max(0, Math.min(100, score));
}

function getModalityScore(modality) {
  switch (formatJobModality(modality)) {
    case 'remote':
      return 15;
    case 'hybrid':
      return 8;
    case 'onsite':
      return -10;
    default:
      return 0;
  }
}

function getLanguageScore(language) {
  const normalizedLanguage = normalizeText(language);

  if (normalizedLanguage === 'spanish') {
    return 12;
  }

  if (normalizedLanguage === 'mixed') {
    return 6;
  }

  if (normalizedLanguage === 'english') {
    return -4;
  }

  return 0;
}

function getEnglishRequirementScore(englishRequirement) {
  const normalizedRequirement = normalizeText(englishRequirement);

  if (normalizedRequirement === 'none') {
    return 4;
  }

  if (normalizedRequirement === 'preferred') {
    return -2;
  }

  if (normalizedRequirement === 'required') {
    return -10;
  }

  return 0;
}

function getLocationScore(location, rules) {
  if (matchesConfiguredLocation(location, rules.colombiaCities)) {
    return 10;
  }

  if (
    matchesConfiguredLocation(location, rules.targetLocations) ||
    matchesConfiguredLocation(location, rules.requiredSpanishLocations) ||
    matchesConfiguredLocation(location, rules.preferredSpanishLocations)
  ) {
    return 6;
  }

  return 0;
}

function getSeniorityScore(seniority) {
  switch (seniority) {
    case 'junior':
      return 14;
    case 'mid':
      return 8;
    case 'senior':
      return -14;
    case 'lead':
      return -20;
    default:
      return 0;
  }
}

function detectSeniority(text) {
  for (const seniority of ['lead', 'senior', 'mid', 'junior']) {
    const patterns = SENIORITY_PATTERNS[seniority] || [];

    if (patterns.some((pattern) => includesTerm(text, pattern))) {
      return seniority;
    }
  }

  return 'unknown';
}

function matchKeywords(text, keywords = []) {
  const matches = new Set();

  for (const keyword of Array.isArray(keywords) ? keywords : []) {
    const normalizedKeyword = normalizeText(keyword);

    if (!normalizedKeyword) {
      continue;
    }

    if (includesTerm(text, normalizedKeyword)) {
      matches.add(normalizedKeyword);
    }
  }

  return Array.from(matches);
}

function matchesConfiguredLocation(location, values = []) {
  const normalizedLocation = normalizeText(location);

  if (!normalizedLocation) {
    return false;
  }

  return (Array.isArray(values) ? values : []).some((value) => {
    const normalizedValue = normalizeText(value);

    return (
      normalizedValue &&
      (normalizedLocation === normalizedValue ||
        normalizedLocation.includes(normalizedValue) ||
        normalizedValue.includes(normalizedLocation))
    );
  });
}

function includesTerm(text, keyword) {
  return text.includes(keyword);
}

function buildSearchableText(job) {
  return normalizeText(
    [
      job.title,
      job.company,
      job.link,
      job.location,
      job.modality,
      job.language,
      job.englishRequirement,
      job.languageEvidence,
      job.rawText
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
