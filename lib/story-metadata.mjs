const STORY_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const LANGUAGE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const text = value => typeof value === 'string' && Boolean(value.trim());

export { STORY_ID };

export function normalizeLanguage(value) {
  if (!text(value) || value.length > 64 || !LANGUAGE.test(value.trim())) return null;
  try { return Intl.getCanonicalLocales(value.trim())[0] ?? null; } catch { return null; }
}

export function isHTTPSURL(value) {
  try {
    const parsed = new URL(value);
    return typeof value === 'string' &&
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password;
  } catch {
    return false;
  }
}

export function validateStoryMetadata(story, expectedId = story?.id) {
  if (!story || story.schema_version !== 2) throw new Error('Story schema_version must be 2');
  if (!STORY_ID.test(expectedId ?? '') || story.id !== expectedId) throw new Error('Invalid story id');
  if (!text(story.title)) throw new Error('Missing story title');
  if (!normalizeLanguage(story.language)) throw new Error('Invalid canonical story language');

  if (!Array.isArray(story.authors) || !story.authors.length || !story.authors.every(text)) {
    throw new Error('Missing author metadata');
  }

  if (!story.description || typeof story.description !== 'object' || Array.isArray(story.description)) {
    throw new Error('Story description must be a language map');
  }
  const descriptions = Object.entries(story.description);
  if (!descriptions.length || !descriptions.every(([lang,value]) => normalizeLanguage(lang) && text(value))) {
    throw new Error('Invalid localized story description');
  }

  if (!Array.isArray(story.entries) || !story.entries.length) throw new Error('Missing story entries');
  const entryIds = new Set();
  for (const entry of story.entries) {
    if (!entry || !text(entry.id) || !text(entry.label) || entryIds.has(entry.id)) {
      throw new Error('Invalid or duplicate story entry');
    }
    entryIds.add(entry.id);
  }

  if (!isHTTPSURL(story.source_url)) throw new Error('Story source_url must be HTTPS');
  if (story.source_label !== undefined && !text(story.source_label)) throw new Error('Invalid source_label');
  if (!text(story.attribution)) throw new Error('Missing attribution');
  if (story.attribution_language !== undefined && !normalizeLanguage(story.attribution_language)) {
    throw new Error('Invalid attribution language');
  }

  const rights = story.rights;
  if (!rights || !text(rights.original_work) || !text(rights.note)) {
    throw new Error('Incomplete rights metadata');
  }
  if (!Array.isArray(rights.verified_territories) || !rights.verified_territories.every(text)) {
    throw new Error('Invalid verified_territories');
  }
  if (!text(rights.worldwide_clearance)) throw new Error('Missing worldwide clearance status');
  if (rights.evidence_url !== undefined && !isHTTPSURL(rights.evidence_url)) {
    throw new Error('Rights evidence_url must be HTTPS');
  }

  if (story.localization?.mode !== 'agent-runtime' || story.localization?.use_session_language !== true) {
    throw new Error('Unsupported localization metadata');
  }

  for (const key of ['nodes','edges','endings']) {
    const value = story.statistics?.[key];
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid statistics.${key}`);
  }

  return story;
}
