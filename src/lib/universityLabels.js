/**
 * `universities.code` (UJ, JUST, GJU, HU, BAU, PSUT — see db/schema.sql) is
 * meant to be read alongside the university's full English name
 * (`universities.name`, already in the API response), but the Arabic UI has
 * no Arabic name to fall back on and just prints the bare Latin code. These
 * are the real, publicly known Arabic names of the six universities in
 * DARBI's catalog — a display-only lookup, not a data source (same
 * rationale as LandingPage.jsx's MAJOR_NAME_AR): DARBI's seeded catalog
 * stays English-only, this just supplies the Arabic label to show next to
 * the code.
 */
const AR_NAME_BY_CODE = {
  UJ: 'الجامعة الأردنية',
  JUST: 'جامعة العلوم والتكنولوجيا الأردنية',
  GJU: 'الجامعة الألمانية الأردنية',
  HU: 'الجامعة الهاشمية',
  BAU: 'جامعة البلقاء التطبيقية',
  PSUT: 'جامعة الأميرة سمية للتكنولوجيا',
};

/** `lang !== 'ar'` (or an unknown code) returns null — caller shows just the code. */
export function universityArabicName(code, lang) {
  if (lang !== 'ar') return null;
  return AR_NAME_BY_CODE[code] ?? null;
}
