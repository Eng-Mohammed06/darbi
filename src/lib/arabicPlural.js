/**
 * Standard MSA numeral-agreement categories (the same six CLDR defines for
 * Arabic): 0 and 3-10 take the noun's broken/regular plural, 1 stays
 * singular, 2 takes the dual, 11-99 takes the singular again (in its
 * indefinite-accusative form), and 100+ falls back to the "many"/plural-ish
 * form. Callers supply the actual word for each bucket -- Arabic plurals
 * are irregular, so there's no way to derive "تخصصات" from "تخصص"
 * mechanically the way English just appends "s".
 */
export function arabicPluralForm(n, forms) {
  const mod100 = n % 100;
  if (n === 0 && forms.zero !== undefined) return forms.zero;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (mod100 >= 3 && mod100 <= 10) return forms.few;
  if (mod100 >= 11 && mod100 <= 99) return forms.many;
  return forms.other ?? forms.few;
}
