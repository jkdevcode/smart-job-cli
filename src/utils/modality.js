export const SEARCH_MODALITIES = Object.freeze(['both', 'remote', 'hybrid']);
export const JOB_MODALITIES = Object.freeze(['remote', 'hybrid', 'onsite', 'unknown']);

export function normalizeSearchModality(modality, remoteFlag = false) {
  if (remoteFlag) {
    return 'remote';
  }

  const normalizedValue = String(modality || 'both').trim().toLowerCase();

  if (!SEARCH_MODALITIES.includes(normalizedValue)) {
    throw new Error(`Modalidad invalida. Usa una de: ${SEARCH_MODALITIES.join('|')}.`);
  }

  return normalizedValue;
}

export function inferJobModality(...values) {
  const normalizedText = normalizeText(values.join(' '));

  if (containsAny(normalizedText, ['hybrid', 'hibrido', 'hibrida'])) {
    return 'hybrid';
  }

  if (containsAny(normalizedText, ['on-site', 'onsite', 'on site', 'presencial'])) {
    return 'onsite';
  }

  if (containsAny(normalizedText, ['remote', 'remoto', 'remota'])) {
    return 'remote';
  }

  return 'unknown';
}

export function formatJobModality(modality) {
  const normalizedValue = String(modality || 'unknown').trim().toLowerCase();

  if (normalizedValue === 'remote') {
    return 'remote';
  }

  if (normalizedValue === 'hybrid') {
    return 'hybrid';
  }

  if (normalizedValue === 'onsite') {
    return 'onsite';
  }

  return 'unknown';
}

function containsAny(text, values) {
  return values.some((value) => text.includes(value));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
