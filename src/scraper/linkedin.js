import { chromium } from 'playwright';
import { cleanupText, normalizeLinkedInJobLink } from '../utils/normalize.js';
import { loadJobSearchRules } from '../utils/jobRules.js';
import { inferJobModality, normalizeSearchModality } from '../utils/modality.js';

const DEFAULT_KEYWORDS = 'nodejs';
const DEFAULT_MODALITY = 'both';
const DEFAULT_MAX_JOBS = 50;
const MIN_MAX_JOBS = 1;
const MAX_MAX_JOBS = 100;
const LAST_24_HOURS_FILTER = 'r86400';
const GENERIC_KEYWORD_TOKENS = new Set([
  'developer',
  'engineer',
  'junior',
  'mid',
  'senior',
  'remote',
  'hybrid',
  'remoto',
  'hibrido',
  'fullstack',
  'full-stack',
  'full',
  'stack'
]);
const DEFAULT_ENGLISH_REQUIRED_PHRASES = Object.freeze([
  'english only',
  'fluent english',
  'advanced english',
  'professional english',
  'excellent english',
  'must have english',
  'english required',
  'written and spoken english',
  'verbal and written english'
]);
const DEFAULT_ENGLISH_PREFERRED_PHRASES = Object.freeze([
  'english is a plus',
  'basic english',
  'nice to have english',
  'intermediate english',
  'conversational english'
]);
const DEFAULT_SPANISH_MARKERS = Object.freeze([
  'desarrollador',
  'ingeniero',
  'vacante',
  'empleo',
  'requisitos',
  'experiencia',
  'anos',
  'tiempo completo',
  'remoto',
  'hibrido',
  'colombia',
  'bogota'
]);
const DEFAULT_ENGLISH_MARKERS = Object.freeze([
  'full time',
  'contract',
  'requirements',
  'experience',
  'required',
  'must have',
  'years',
  'english',
  'remote',
  'developer',
  'engineer'
]);

function buildSearchUrl({ keyword, modality, location }) {
  let url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}`;

  if (location) {
    url += `&location=${encodeURIComponent(location)}`;
  }

  url += `&f_TPR=${LAST_24_HOURS_FILTER}`;

  const workTypeFilter = {
    remote: '2',
    hybrid: '3',
    both: '2,3'
  }[modality];

  if (workTypeFilter) {
    url += `&f_WT=${encodeURIComponent(workTypeFilter)}`;
  }

  return url;
}

function resolveKeyword(keyword) {
  const normalizedKeyword = String(keyword || '').trim();

  if (normalizedKeyword) {
    return normalizedKeyword;
  }

  return process.env.LINKEDIN_KEYWORDS || DEFAULT_KEYWORDS;
}

function resolveMaxJobs(limit) {
  const configuredLimit = Number.parseInt(limit ?? process.env.LINKEDIN_MAX_JOBS ?? '', 10);

  if (!Number.isInteger(configuredLimit)) {
    return DEFAULT_MAX_JOBS;
  }

  return Math.min(MAX_MAX_JOBS, Math.max(MIN_MAX_JOBS, configuredLimit));
}

function resolveSearchModality(modality, remoteFlag) {
  return normalizeSearchModality(modality ?? process.env.LINKEDIN_DEFAULT_MODALITY ?? DEFAULT_MODALITY, remoteFlag);
}

function resolveKeywordVariants(keyword, rules) {
  const normalizedKeyword = String(keyword || '').trim();

  if (normalizedKeyword) {
    return [normalizedKeyword];
  }

  const configuredVariants = splitConfiguredList(process.env.LINKEDIN_KEYWORD_VARIANTS);

  if (configuredVariants.length > 0) {
    return configuredVariants;
  }

  if (Array.isArray(rules.searchKeywordVariants) && rules.searchKeywordVariants.length > 0) {
    return rules.searchKeywordVariants;
  }

  return [resolveKeyword('')];
}

function resolveSearchLocations(location, rules) {
  const normalizedLocation = String(location || '').trim();

  if (normalizedLocation) {
    return [normalizedLocation];
  }

  const configuredLocations = [
    ...splitConfiguredList(process.env.LINKEDIN_TARGET_LOCATIONS),
    ...splitConfiguredList(process.env.LINKEDIN_COLOMBIA_CITIES)
  ];

  if (configuredLocations.length > 0) {
    return dedupeValues(configuredLocations);
  }

  const ruleLocations = [
    ...(Array.isArray(rules.targetLocations) ? rules.targetLocations : []),
    ...(Array.isArray(rules.colombiaCities) ? rules.colombiaCities : [])
  ];

  if (ruleLocations.length > 0) {
    return dedupeValues(ruleLocations);
  }

  return [null];
}

function resolveRequiredSpanishLocations(rules) {
  return resolveConfiguredList({
    envName: 'LINKEDIN_REQUIRED_SPANISH_LOCATIONS',
    ruleValues: rules.requiredSpanishLocations
  });
}

function resolvePreferredSpanishLocations(rules) {
  return resolveConfiguredList({
    envName: 'LINKEDIN_PREFERRED_SPANISH_LOCATIONS',
    ruleValues: rules.preferredSpanishLocations
  });
}

function resolveStrictEnglishRejectionLocations(rules) {
  return resolveConfiguredList({
    envName: 'LINKEDIN_STRICT_ENGLISH_REJECTION_LOCATIONS',
    ruleValues: rules.strictEnglishRejectionLocations
  });
}

function resolveAllowMixedLanguageLocations(rules) {
  return resolveConfiguredList({
    envName: 'LINKEDIN_ALLOW_MIXED_LANGUAGE_LOCATIONS',
    ruleValues: rules.allowMixedLanguageLocations
  });
}

function resolveEnglishRequiredPhrases(rules) {
  return resolveConfiguredList({
    envName: 'LINKEDIN_ENGLISH_REQUIRED_PHRASES',
    ruleValues: rules.englishRequiredPhrases,
    defaultValues: DEFAULT_ENGLISH_REQUIRED_PHRASES
  });
}

function resolveEnglishPreferredPhrases(rules) {
  return resolveConfiguredList({
    envName: 'LINKEDIN_ENGLISH_PREFERRED_PHRASES',
    ruleValues: rules.englishPreferredPhrases,
    defaultValues: DEFAULT_ENGLISH_PREFERRED_PHRASES
  });
}

function resolveSpanishMarkers(rules) {
  return resolveConfiguredList({
    envName: 'LINKEDIN_SPANISH_MARKERS',
    ruleValues: rules.spanishMarkers,
    defaultValues: DEFAULT_SPANISH_MARKERS
  });
}

function resolveEnglishMarkers(rules) {
  return resolveConfiguredList({
    envName: 'LINKEDIN_ENGLISH_MARKERS',
    ruleValues: rules.englishMarkers,
    defaultValues: DEFAULT_ENGLISH_MARKERS
  });
}

function resolveConfiguredList({ envName, ruleValues, defaultValues = [] }) {
  const configuredValues = splitConfiguredList(process.env[envName]);

  if (configuredValues.length > 0) {
    return dedupeValues(configuredValues);
  }

  if (Array.isArray(ruleValues) && ruleValues.length > 0) {
    return dedupeValues(ruleValues);
  }

  return dedupeValues(defaultValues);
}

function buildSearchPlans(keywordVariants, searchLocations) {
  const plans = [];

  for (const keyword of keywordVariants) {
    for (const location of searchLocations) {
      plans.push({ keyword, location });
    }
  }

  return plans;
}

function resolvePerPlanLimit(maxJobs, searchPlansCount) {
  if (searchPlansCount <= 1) {
    return maxJobs;
  }

  return Math.min(maxJobs, Math.max(10, Math.ceil(maxJobs / searchPlansCount)));
}

function splitConfiguredList(value) {
  return String(value || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeValues(values) {
  const seenValues = new Set();
  const dedupedValues = [];

  for (const value of values) {
    const normalizedValue = normalizeFilterText(value);

    if (!normalizedValue || seenValues.has(normalizedValue)) {
      continue;
    }

    seenValues.add(normalizedValue);
    dedupedValues.push(value);
  }

  return dedupedValues;
}

export async function scrapeLinkedInJobs(options = {}) {
  const { rules } = await loadJobSearchRules();
  const maxJobs = resolveMaxJobs(options.limit);
  const modality = resolveSearchModality(options.modality, options.remote);
  const keywordVariants = resolveKeywordVariants(options.keyword, rules);
  const searchLocations = resolveSearchLocations(options.location, rules);
  const languageConfig = {
    requiredSpanishLocations: resolveRequiredSpanishLocations(rules),
    preferredSpanishLocations: resolvePreferredSpanishLocations(rules),
    strictEnglishRejectionLocations: resolveStrictEnglishRejectionLocations(rules),
    allowMixedLanguageLocations: resolveAllowMixedLanguageLocations(rules),
    englishRequiredPhrases: resolveEnglishRequiredPhrases(rules),
    englishPreferredPhrases: resolveEnglishPreferredPhrases(rules),
    spanishMarkers: resolveSpanishMarkers(rules),
    englishMarkers: resolveEnglishMarkers(rules)
  };
  const searchPlans = buildSearchPlans(keywordVariants, searchLocations);
  const perPlanLimit = resolvePerPlanLimit(maxJobs, searchPlans.length);
  const browser = await chromium.launch({ headless: false });

  try {
    const collectedJobs = [];
    const seenLinks = new Set();

    for (const searchPlan of searchPlans) {
      if (collectedJobs.length >= maxJobs) {
        break;
      }

      const keywordTokens = buildKeywordTokens(searchPlan.keyword);
      const searchJobs = await scrapeJobsForPlan(browser, {
        keyword: searchPlan.keyword,
        limit: Math.min(perPlanLimit, maxJobs - collectedJobs.length),
        location: searchPlan.location,
        modality,
        keywordTokens,
        languagePolicy: resolveLanguagePolicy(searchPlan.location, languageConfig),
        languageConfig
      });

      appendUniqueJobs(collectedJobs, searchJobs, seenLinks, maxJobs);
    }

    return collectedJobs;
  } finally {
    await browser.close();
  }
}

async function scrapeJobsForPlan(browser, { keyword, limit, location, modality, keywordTokens, languagePolicy, languageConfig }) {
  if (modality === 'both') {
    const perModalityLimit = Math.max(MIN_MAX_JOBS, Math.ceil(limit / 2));
    const remoteJobs = await scrapeJobsForModality(browser, {
      keyword,
      limit: perModalityLimit,
      location,
      modality: 'remote',
      keywordTokens,
      languagePolicy,
      languageConfig
    });
    const hybridJobs = await scrapeJobsForModality(browser, {
      keyword,
      limit: perModalityLimit,
      location,
      modality: 'hybrid',
      keywordTokens,
      languagePolicy,
      languageConfig
    });

    return mergeJobsByLink([...remoteJobs, ...hybridJobs], limit);
  }

  return scrapeJobsForModality(browser, {
    keyword,
    limit,
    location,
    modality,
    keywordTokens,
    languagePolicy,
    languageConfig
  });
}

async function scrapeJobsForModality(browser, { keyword, limit, location, modality, keywordTokens, languagePolicy, languageConfig }) {
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }
  });

  try {
    const searchUrl = buildSearchUrl({ keyword, modality, location });

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(4000);

    await page.waitForFunction(
      () =>
        Boolean(
          document.querySelector('.jobs-search__results-list li') ||
            document.querySelector('.jobs-search-results__list-item') ||
            document.querySelector('.base-card')
        ),
      { timeout: 20000 }
    );

    await autoScroll(page, limit);

    const jobs = await page.evaluate((maxResults) => {
      const cardSelectors = [
        '.jobs-search__results-list li',
        '.jobs-search-results__list-item',
        '.base-card'
      ];

      const seenCards = new Set();

      for (const selector of cardSelectors) {
        for (const card of document.querySelectorAll(selector)) {
          seenCards.add(card);
        }
      }

      const cards = Array.from(seenCards).slice(0, maxResults);

      return cards
        .map((card) => {
          const title =
            card.querySelector('.base-search-card__title')?.textContent ||
            card.querySelector('h3')?.textContent ||
            '';

          const company =
            card.querySelector('.base-search-card__subtitle')?.textContent ||
            card.querySelector('h4')?.textContent ||
            card.querySelector('.hidden-nested-link')?.textContent ||
            '';

          const location =
            card.querySelector('.job-search-card__location')?.textContent ||
            card.querySelector('[class*="location"]')?.textContent ||
            '';

          const link =
            card.querySelector('a.base-card__full-link')?.href ||
            card.querySelector('a[href*="/jobs/view/"]')?.href ||
            '';

          return {
            title: title || '',
            company: company || '',
            location: location || '',
            link: link || '',
            rawText: card.textContent || ''
          };
        })
        .filter((job) => job.title && job.company && job.link);
    }, limit);

    const uniqueJobs = [];
    const seenLinks = new Set();

    for (const job of jobs) {
      const title = cleanupText(job.title);
      const company = cleanupText(job.company);
      const location = cleanupText(job.location);
      const link = normalizeLinkedInJobLink(job.link);
      const inferredModality = inferJobModality(location, job.rawText);
      const resolvedModality = inferredModality === 'unknown' ? modality : inferredModality;
      const languageAnalysis = analyzeListingLanguage(
        { title, location, rawText: job.rawText },
        languageConfig
      );

      if (
        !title ||
        !company ||
        !link ||
        seenLinks.has(link) ||
        !matchesKeywordTokens({ title, company }, keywordTokens) ||
        !shouldKeepJobByLanguage(languageAnalysis, languagePolicy)
      ) {
        continue;
      }

      seenLinks.add(link);
      uniqueJobs.push({
        title,
        company,
        location,
        link,
        modality: resolvedModality,
        language: languageAnalysis.language,
        languageConfidence: languageAnalysis.languageConfidence,
        englishRequirement: languageAnalysis.englishRequirement,
        languageEvidence: languageAnalysis.languageEvidence,
        __languagePriority: getLanguagePriority(languageAnalysis, languagePolicy)
      });
    }

    return uniqueJobs
      .slice()
      .sort((left, right) => right.__languagePriority - left.__languagePriority)
      .map(({ __languagePriority, ...job }) => job);
  } finally {
    await page.close();
  }
}

function mergeJobsByLink(jobs, maxJobs) {
  const uniqueJobs = [];
  const seenLinks = new Set();

  for (const job of jobs) {
    if (!job.link || seenLinks.has(job.link)) {
      continue;
    }

    seenLinks.add(job.link);
    uniqueJobs.push(job);

    if (uniqueJobs.length >= maxJobs) {
      break;
    }
  }

  return uniqueJobs;
}

function appendUniqueJobs(targetJobs, newJobs, seenLinks, maxJobs) {
  for (const job of newJobs) {
    if (!job.link || seenLinks.has(job.link)) {
      continue;
    }

    seenLinks.add(job.link);
    targetJobs.push(job);

    if (targetJobs.length >= maxJobs) {
      break;
    }
  }
}

function buildKeywordTokens(keyword) {
  return tokenizeText(keyword).filter(
    (token) => token.length > 2 && !GENERIC_KEYWORD_TOKENS.has(token)
  );
}

function matchesKeywordTokens(job, keywordTokens) {
  if (keywordTokens.length === 0) {
    return true;
  }

  const searchableTokens = new Set(tokenizeText(`${job.title} ${job.company}`));
  return keywordTokens.some((token) => searchableTokens.has(token));
}

function tokenizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter(Boolean);
}

function resolveLanguagePolicy(searchLocation, languageConfig) {
  return {
    requiresSpanish: locationMatchesConfiguredList(
      searchLocation,
      languageConfig.requiredSpanishLocations
    ),
    prefersSpanish: locationMatchesConfiguredList(
      searchLocation,
      languageConfig.preferredSpanishLocations
    ),
    strictEnglishRejection: locationMatchesConfiguredList(
      searchLocation,
      languageConfig.strictEnglishRejectionLocations
    ),
    allowMixedLanguage: locationMatchesConfiguredList(
      searchLocation,
      languageConfig.allowMixedLanguageLocations
    )
  };
}

function locationMatchesConfiguredList(searchLocation, configuredLocations) {
  if (!searchLocation) {
    return false;
  }

  const normalizedLocation = normalizeFilterText(searchLocation);

  return configuredLocations.some((configuredLocation) => {
    const normalizedConfiguredLocation = normalizeFilterText(configuredLocation);
    return (
      normalizedConfiguredLocation &&
      (normalizedLocation === normalizedConfiguredLocation ||
        normalizedLocation.includes(normalizedConfiguredLocation) ||
        normalizedConfiguredLocation.includes(normalizedLocation))
    );
  });
}

function analyzeListingLanguage({ title, location, rawText }, languageConfig) {
  const normalizedText = normalizeFilterText(`${title} ${location} ${rawText}`);

  if (!normalizedText) {
    return {
      language: 'unknown',
      languageConfidence: 0,
      englishRequirement: 'unknown',
      languageEvidence: ''
    };
  }

  const matchedSpanishMarkers = findMatchedMarkers(normalizedText, languageConfig.spanishMarkers);
  const matchedEnglishMarkers = findMatchedMarkers(normalizedText, languageConfig.englishMarkers);
  const matchedEnglishRequiredPhrases = findMatchedMarkers(
    normalizedText,
    languageConfig.englishRequiredPhrases
  );
  const matchedEnglishPreferredPhrases = findMatchedMarkers(
    normalizedText,
    languageConfig.englishPreferredPhrases
  );

  const spanishScore = matchedSpanishMarkers.length;
  const englishScore =
    matchedEnglishMarkers.length +
    matchedEnglishRequiredPhrases.length * 3 +
    matchedEnglishPreferredPhrases.length;
  const totalScore = spanishScore + englishScore;
  const englishRequirement = resolveEnglishRequirement(
    matchedEnglishRequiredPhrases,
    matchedEnglishPreferredPhrases
  );

  if (totalScore === 0) {
    return {
      language: 'unknown',
      languageConfidence: 0,
      englishRequirement,
      languageEvidence: buildLanguageEvidence({
        matchedSpanishMarkers,
        matchedEnglishMarkers,
        matchedEnglishRequiredPhrases,
        matchedEnglishPreferredPhrases
      })
    };
  }

  const dominantScore = Math.max(spanishScore, englishScore);
  const scoreDifference = Math.abs(spanishScore - englishScore);
  const baseConfidence = dominantScore / totalScore;
  let language = 'unknown';
  let languageConfidence = baseConfidence;

  if (spanishScore > 0 && englishScore > 0 && scoreDifference <= 1) {
    language = 'mixed';
    languageConfidence = 1 - scoreDifference / totalScore;
  } else if (spanishScore > englishScore) {
    language = scoreDifference >= 2 || englishScore === 0 ? 'spanish' : 'mixed';
  } else if (englishScore > spanishScore) {
    language = scoreDifference >= 2 || spanishScore === 0 ? 'english' : 'mixed';
  }

  if (language === 'mixed') {
    languageConfidence = Math.max(0.5, 1 - scoreDifference / totalScore);
  }

  return {
    language,
    languageConfidence: Number(languageConfidence.toFixed(2)),
    englishRequirement,
    languageEvidence: buildLanguageEvidence({
      matchedSpanishMarkers,
      matchedEnglishMarkers,
      matchedEnglishRequiredPhrases,
      matchedEnglishPreferredPhrases
    })
  };
}

function resolveEnglishRequirement(matchedEnglishRequiredPhrases, matchedEnglishPreferredPhrases) {
  if (matchedEnglishRequiredPhrases.length > 0) {
    return 'required';
  }

  if (matchedEnglishPreferredPhrases.length > 0) {
    return 'preferred';
  }

  return 'none';
}

function shouldKeepJobByLanguage(languageAnalysis, languagePolicy) {
  if (languagePolicy.requiresSpanish) {
    if (languageAnalysis.englishRequirement === 'required') {
      return false;
    }

    if (
      languageAnalysis.language === 'english' &&
      (languagePolicy.strictEnglishRejection || languageAnalysis.languageConfidence >= 0.65)
    ) {
      return false;
    }

    if (languageAnalysis.language === 'mixed' && !languagePolicy.allowMixedLanguage) {
      return false;
    }
  }

  return true;
}

function getLanguagePriority(languageAnalysis, languagePolicy) {
  let priority = 0;

  if (languagePolicy.requiresSpanish || languagePolicy.prefersSpanish) {
    if (languageAnalysis.language === 'spanish') {
      priority += 40;
    } else if (languageAnalysis.language === 'mixed') {
      priority += languagePolicy.allowMixedLanguage ? 28 : 10;
    } else if (languageAnalysis.language === 'unknown') {
      priority += languagePolicy.prefersSpanish ? 18 : 8;
    } else {
      priority += 2;
    }
  }

  if (languageAnalysis.englishRequirement === 'required') {
    priority -= 18;
  } else if (languageAnalysis.englishRequirement === 'preferred') {
    priority -= 6;
  }

  return priority + Math.round(languageAnalysis.languageConfidence * 10);
}

function findMatchedMarkers(text, markers) {
  return markers.filter((marker) => text.includes(normalizeFilterText(marker)));
}

function buildLanguageEvidence({
  matchedSpanishMarkers,
  matchedEnglishMarkers,
  matchedEnglishRequiredPhrases,
  matchedEnglishPreferredPhrases
}) {
  const evidenceParts = [];

  if (matchedSpanishMarkers.length > 0) {
    evidenceParts.push(`es:${matchedSpanishMarkers.slice(0, 4).join(',')}`);
  }

  if (matchedEnglishMarkers.length > 0) {
    evidenceParts.push(`en:${matchedEnglishMarkers.slice(0, 4).join(',')}`);
  }

  if (matchedEnglishRequiredPhrases.length > 0) {
    evidenceParts.push(`en_required:${matchedEnglishRequiredPhrases.slice(0, 3).join(',')}`);
  }

  if (matchedEnglishPreferredPhrases.length > 0) {
    evidenceParts.push(`en_preferred:${matchedEnglishPreferredPhrases.slice(0, 3).join(',')}`);
  }

  return evidenceParts.join(' | ');
}

function normalizeFilterText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function autoScroll(page, maxJobs) {
  await page.evaluate(async (limit) => {
    await new Promise((resolve) => {
      const cardSelectors = [
        '.jobs-search__results-list li',
        '.jobs-search-results__list-item',
        '.base-card'
      ];

      const scrollTargetSelectors = [
        '.jobs-search-results-list',
        '.jobs-search__results-list',
        '.scaffold-layout__list > div',
        '.scaffold-layout__list-container'
      ];

      const getLoadedJobsCount = () => {
        const counts = cardSelectors.map((selector) => document.querySelectorAll(selector).length);
        return Math.max(0, ...counts);
      };

      const getScrollTarget = () => {
        for (const selector of scrollTargetSelectors) {
          const element = document.querySelector(selector);

          if (element && element.scrollHeight > element.clientHeight + 50) {
            return element;
          }
        }

        return document.scrollingElement || document.documentElement;
      };

      let scrollCount = 0;
      let previousCount = getLoadedJobsCount();
      let stagnantIterations = 0;

      const timer = setInterval(() => {
        const scrollTarget = getScrollTarget();
        scrollTarget.scrollTo(0, scrollTarget.scrollHeight);
        scrollCount += 1;

        const currentCount = getLoadedJobsCount();

        if (currentCount > previousCount) {
          previousCount = currentCount;
          stagnantIterations = 0;
        } else {
          stagnantIterations += 1;
        }

        const reachedLimit = currentCount >= limit;
        const reachedMaxScrolls = scrollCount >= 20;
        const stoppedLoading = stagnantIterations >= 4;

        if (reachedLimit || reachedMaxScrolls || stoppedLoading) {
          clearInterval(timer);
          resolve();
        }
      }, 1200);
    });
  }, maxJobs);

  await page.waitForTimeout(1500);
}
