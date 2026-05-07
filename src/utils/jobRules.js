import fs from 'node:fs/promises';
import path from 'node:path';

const RULES_FILE_NAME = 'JOB_SEARCH_RULES.md';

export async function loadJobSearchRules() {
  const rulesPath = path.resolve(process.cwd(), RULES_FILE_NAME);

  try {
    const content = await fs.readFile(rulesPath, 'utf8');

    return {
      rules: parseJobSearchRules(content),
      warning: null,
      path: rulesPath
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        rules: createEmptyRules(),
        warning: `No se encontro ${RULES_FILE_NAME}. Se continuara sin filtros automaticos.`,
        path: rulesPath
      };
    }

    return {
      rules: createEmptyRules(),
      warning: `No fue posible cargar ${RULES_FILE_NAME}. Se continuara sin filtros automaticos.`,
      path: rulesPath
    };
  }
}

export function parseJobSearchRules(content) {
  if (typeof content !== 'string') {
    throw new Error('El archivo de reglas no contiene texto valido.');
  }

  return {
    positiveKeywords: extractKeywordList(content, 'positive_keywords'),
    negativeKeywords: extractKeywordList(content, 'negative_keywords'),
    searchKeywordVariants: extractKeywordList(content, 'search_keyword_variants'),
    targetLocations: extractKeywordList(content, 'target_locations'),
    colombiaCities: extractKeywordList(content, 'colombia_cities'),
    requiredSpanishLocations: extractKeywordList(content, 'required_spanish_locations'),
    preferredSpanishLocations: extractKeywordList(content, 'preferred_spanish_locations'),
    strictEnglishRejectionLocations: extractKeywordList(
      content,
      'strict_english_rejection_locations'
    ),
    allowMixedLanguageLocations: extractKeywordList(content, 'allow_mixed_language_locations'),
    englishRequiredPhrases: extractKeywordList(content, 'english_required_phrases'),
    englishPreferredPhrases: extractKeywordList(content, 'english_preferred_phrases'),
    spanishMarkers: extractKeywordList(content, 'spanish_markers'),
    englishMarkers: extractKeywordList(content, 'english_markers')
  };
}

function extractKeywordList(content, key) {
  const matches = [];
  const regex = new RegExp(`${key}:\\s*\\r?\\n((?:\\s*-\\s*.+(?:\\r?\\n|$))+)`, 'gi');

  for (const match of content.matchAll(regex)) {
    matches.push(match[1]);
  }

  const keywords = new Set();

  for (const block of matches) {
    for (const line of block.split(/\r?\n/)) {
      const keyword = line.replace(/^\s*-\s*/, '').trim();

      if (!keyword) {
        continue;
      }

      keywords.add(normalizeKeyword(keyword));
    }
  }

  return Array.from(keywords);
}

function normalizeKeyword(value) {
  return value.replace(/^['"`]+|['"`]+$/g, '').trim().toLowerCase();
}

function createEmptyRules() {
  return {
    positiveKeywords: [],
    negativeKeywords: [],
    searchKeywordVariants: [],
    targetLocations: [],
    colombiaCities: [],
    requiredSpanishLocations: [],
    preferredSpanishLocations: [],
    strictEnglishRejectionLocations: [],
    allowMixedLanguageLocations: [],
    englishRequiredPhrases: [],
    englishPreferredPhrases: [],
    spanishMarkers: [],
    englishMarkers: []
  };
}
