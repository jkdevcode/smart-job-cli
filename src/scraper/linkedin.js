import { chromium } from 'playwright';
import { cleanupText, normalizeLinkedInJobLink } from '../utils/normalize.js';
import { inferJobModality, normalizeSearchModality } from '../utils/modality.js';

const DEFAULT_KEYWORDS = 'nodejs';
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

function buildSearchUrl({ keyword, modality }) {
  let url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}`;

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

export async function scrapeLinkedInJobs(options = {}) {
  const keyword = resolveKeyword(options.keyword);
  const maxJobs = resolveMaxJobs(options.limit);
  const modality = normalizeSearchModality(options.modality, options.remote);
  const keywordTokens = buildKeywordTokens(keyword);
  const browser = await chromium.launch({ headless: false });

  try {
    if (modality === 'both') {
      const perModalityLimit = Math.max(MIN_MAX_JOBS, Math.ceil(maxJobs / 2));
      const remoteJobs = await scrapeJobsForModality(browser, {
        keyword,
        limit: perModalityLimit,
        modality: 'remote',
        keywordTokens
      });
      const hybridJobs = await scrapeJobsForModality(browser, {
        keyword,
        limit: perModalityLimit,
        modality: 'hybrid',
        keywordTokens
      });

      return mergeJobsByLink([...remoteJobs, ...hybridJobs], maxJobs);
    }

    return scrapeJobsForModality(browser, {
      keyword,
      limit: maxJobs,
      modality,
      keywordTokens
    });
  } finally {
    await browser.close();
  }
}

async function scrapeJobsForModality(browser, { keyword, limit, modality, keywordTokens }) {
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }
  });

  try {
    const searchUrl = buildSearchUrl({ keyword, modality });

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

      if (
        !title ||
        !company ||
        !link ||
        seenLinks.has(link) ||
        !matchesKeywordTokens({ title, company }, keywordTokens)
      ) {
        continue;
      }

      seenLinks.add(link);
      uniqueJobs.push({ title, company, link, modality: resolvedModality });
    }

    return uniqueJobs;
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
