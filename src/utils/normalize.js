export function cleanupText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeLinkedInJobLink(link) {
  if (!link) {
    return '';
  }

  try {
    const url = new URL(link);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return link.trim();
  }
}
