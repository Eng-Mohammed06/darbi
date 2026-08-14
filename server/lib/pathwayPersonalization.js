/**
 * Deterministic, model-free personalization of a major's pathway card.
 *
 * server/routes/pathways.js is deliberately built to never depend on a live
 * model call, so it renders identically whether or not the Anthropic key has
 * credit (see the comment at the top of that file). This module keeps that
 * guarantee: it only reorders a major's own courses and writes a short note,
 * using the profile fields and the onboarding analysis Claude already
 * produced once at signup time (server/lib/onboarding.js) and stored — no
 * call happens here.
 *
 * Two students who told the onboarding questionnaire different things will
 * see the same major's courses in a different order, with a different note
 * explaining why — that's the "different pathway per user" this exists for.
 * Two students who said the same things see the same thing, which is
 * correct, not a bug. A student with nothing to personalize from (no
 * onboarding analysis, no matching interest) gets `null` back and the
 * pathway route falls back to its original generic ordering.
 */

const STOPWORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'their', 'about', 'they', 'them',
  'what', 'when', 'where', 'which', 'want', 'like', 'good', 'work', 'working',
]);

function keywordsFrom(student, analysis) {
  const words = new Set();
  const add = (s) => {
    for (const w of String(s ?? '').toLowerCase().match(/[a-z]{4,}/g) ?? []) {
      if (!STOPWORDS.has(w)) words.add(w);
    }
  };
  (student.interests ?? []).forEach(add);
  analysis?.suggested_focus_areas?.forEach(add);
  analysis?.strengths?.forEach(add);
  if (analysis?.interest_summary) add(analysis.interest_summary);
  return words;
}

function courseText(course) {
  return `${course.name} ${course.track ?? ''} ${course.what_you_learn ?? ''}`.toLowerCase();
}

export function personalizePathway({ student, analysis, courses }) {
  const words = keywordsFrom(student, analysis);
  if (words.size === 0 || courses.length === 0) return null;

  const scored = courses.map((course) => {
    const text = courseText(course);
    const matched = [...words].filter((w) => text.includes(w));
    return { course, matched };
  });

  scored.sort((a, b) => b.matched.length - a.matched.length);
  if (scored[0].matched.length === 0) return null; // nothing actually matched — don't fake a fit

  const matchedOn = [...new Set(scored.flatMap((s) => s.matched))].slice(0, 6);

  const notes = [];
  if (analysis?.interest_summary) notes.push(analysis.interest_summary);
  else if (student.interests?.length) notes.push(`You said you're interested in ${student.interests.join(', ')}.`);
  notes.push(`Courses below are ordered around that first.`);

  return {
    courses: scored.slice(0, 6).map((s) => s.course),
    whyThisFits: notes.join(' '),
    matchedOn,
  };
}
