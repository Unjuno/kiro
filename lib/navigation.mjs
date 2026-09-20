// Navigation is presentation state only; no cookies, database, or inferred locale.
export function languageOf(value) {
  if (typeof value !== 'string' || value.length > 35 || !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value)) return '';
  try { return Intl.getCanonicalLocales(value)[0] || ''; } catch { return ''; }
}

export function urlFor(values = {}) {
  const query = new URLSearchParams();
  for (const key of ['lang', 'story', 'node', 'v', 'choose-language']) {
    const value = values[key];
    if (typeof value === 'string' && value) query.set(key, value);
  }
  return query.size ? `/?${query.toString()}` : '/';
}

export function languageLink(language, state) {
  return urlFor({ ...state, lang: languageOf(language), 'choose-language': '' });
}
