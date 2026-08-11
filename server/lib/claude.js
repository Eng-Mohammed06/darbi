import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';
const apiKey = process.env.ANTHROPIC_API_KEY;

// A placeholder in .env.example must not look like a working key.
export const claudeConfigured = Boolean(apiKey && apiKey.startsWith('sk-ant-') && apiKey.length > 24);

const client = claudeConfigured ? new Anthropic({ apiKey }) : null;

/** Shape Claude must return. Enforced server-side, so no parsing guesswork. */
const RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          major: { type: 'string', description: 'Exact major name from the provided catalog' },
          fit_score: { type: 'integer', description: '0-100, how well it matches the student' },
          why: { type: 'string', description: '2-3 sentences addressed to the student' },
          matching_interests: { type: 'array', items: { type: 'string' } },
          suggested_courses: {
            type: 'array',
            items: { type: 'string' },
            description: 'Course names taken verbatim from the catalog',
          },
        },
        required: ['major', 'fit_score', 'why', 'matching_interests', 'suggested_courses'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string', description: 'One paragraph of overall guidance' },
  },
  required: ['recommendations', 'summary'],
  additionalProperties: false,
};

const SYSTEM = `You advise Jordanian engineering students on choosing a university major.

You will be given the student's profile and DARBI's catalog of majors, courses,
and verified job listings. Recommend the 3-5 best-fitting majors.

Rules:
- Recommend ONLY majors that appear in the catalog. Never invent one.
- Cite only courses that appear in the catalog, by their exact name.
- Salary bands in the catalog are verified and cited; quote them as ranges, and
  never invent one that is not listed.
- Ground every claim in the catalog and the student's stated interests and GPA.
- Write to the student directly, in plain English. Be concrete, not generic.`;

/**
 * Ask Claude for major recommendations.
 * Throws on API failure — the caller falls back to rule-based matching.
 */
export async function recommendMajors({ student, majors, courses, jobs }) {
  if (!client) throw new Error('claude_not_configured');

  const catalog = {
    majors: majors.map((m) => ({ name: m.name, course_count: m.course_count })),
    courses: courses.map((c) => ({
      major: c.major_name,
      name: c.name,
      track: c.track,
      provider: c.provider,
    })),
    sample_jobs: jobs.slice(0, 40).map((j) => ({
      title: j.title,
      company: j.company_name,
      majors: j.required_majors,
      skills: j.required_skills,
    })),
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: RECOMMENDATION_SCHEMA } },
    messages: [
      {
        role: 'user',
        content:
          `Student profile:\n${JSON.stringify(student, null, 2)}\n\n` +
          `DARBI catalog:\n${JSON.stringify(catalog)}\n\n` +
          `Recommend the best-fitting majors for this student.`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('claude_refused');
  }

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('claude_empty_response');

  return { data: JSON.parse(text), model: response.model, source: 'claude' };
}

/**
 * Deterministic fallback, used when the API key is absent or the call fails.
 * The sprint plan lists this as the mitigation for "Claude API fails or is
 * slow" — the demo degrades instead of breaking.
 *
 * Scores each major by overlap between the student's stated interests and the
 * major's name plus its course sub-fields, then by how many verified jobs ask
 * for it.
 */
export function recommendMajorsFallback({ student, majors, courses, jobs }) {
  const interests = (student.interests ?? []).map((i) => i.toLowerCase());

  const scored = majors.map((major) => {
    const majorCourses = courses.filter((c) => c.major_name === major.name);
    const haystack = [
      major.name,
      ...majorCourses.map((c) => `${c.track ?? ''} ${c.name}`),
    ]
      .join(' ')
      .toLowerCase();

    const matched = interests.filter((i) => haystack.includes(i));
    const jobCount = jobs.filter((j) =>
      (j.required_majors ?? []).some((m) => m.toLowerCase().includes(major.name.toLowerCase())),
    ).length;

    // Interest overlap dominates; job demand and catalog depth break ties.
    const score = Math.min(
      100,
      matched.length * 30 + Math.min(jobCount, 10) * 4 + Math.min(majorCourses.length, 25),
    );

    return {
      major: major.name,
      fit_score: score,
      why:
        matched.length > 0
          ? `Matches your interest in ${matched.join(', ')}. ${majorCourses.length} verified courses ` +
            `are on file, and ${jobCount} verified job listing(s) ask for this major.`
          : `${majorCourses.length} verified courses are on file and ${jobCount} verified job ` +
            `listing(s) ask for this major.`,
      matching_interests: matched,
      suggested_courses: majorCourses.slice(0, 3).map((c) => c.name),
    };
  });

  const recommendations = scored.sort((a, b) => b.fit_score - a.fit_score).slice(0, 5);

  return {
    data: {
      recommendations,
      summary:
        'These matches come from DARBI’s verified Jordanian course, salary and job data, ' +
        'ranked by how well they line up with your stated interests. AI-written guidance is ' +
        'unavailable right now, so this ranking is rule-based.',
    },
    model: 'rule-based-fallback',
    source: 'fallback',
  };
}
