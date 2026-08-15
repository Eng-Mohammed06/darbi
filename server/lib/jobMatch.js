import { client, chatConfigured, MODEL } from './chat.js';

export { chatConfigured };

/** Shape Claude must return. Enforced server-side, so no parsing guesswork. */
const JOB_MATCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          job_id: { type: 'integer', description: 'Exact id from the provided job catalog' },
          match_score: { type: 'integer', description: '0-100, overall fit for this graduate' },
          requirements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Short requirement label, e.g. "Python" or "Backend experience"' },
                met: { type: 'boolean', description: 'Whether the graduate\'s actual profile supports this' },
              },
              required: ['label', 'met'],
              additionalProperties: false,
            },
            description: '3-5 concrete requirements this job actually asks for, each checked against the graduate\'s real profile',
          },
          why: { type: 'string', description: 'One sentence on the fit, addressed to the graduate' },
        },
        required: ['job_id', 'match_score', 'requirements', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['matches'],
  additionalProperties: false,
};

const SYSTEM = `You match university graduates and working professionals in Jordan against
real job listings.

You will be given a graduate's profile (major, current role, years of
experience, skills, certificates, projects, work experience, career
interests) and a candidate list of DARBI's verified Jordanian job listings
(id, company, title, required majors, required skills, salary).

Score and rank the 8-10 best-fitting jobs for this graduate, 0-100. For each,
list 3-5 concrete requirements the job actually asks for (drawn from its
required_skills/required_majors, or a broader signal like "Backend
experience" if their work history clearly shows it) and mark each met or
not, based ONLY on what the graduate's profile actually shows -- never mark
something met that isn't supported by their stated skills, experience, or
projects. Write one direct sentence on the fit for each.

Rules:
- Only use job_id values that appear in the provided catalog. Never invent one.
- If a job needs something the graduate's profile doesn't show, mark it
  unmet rather than assuming they have it.
- Rank by genuine fit, not just how many requirements are met -- a strong
  match on the most important skills beats many minor ones.`;

/**
 * Ask Claude to score and rank a candidate job list against a graduate's profile.
 * Throws on API failure — the caller falls back to rule-based matching.
 */
export async function matchJobs({ profile, jobs }) {
  if (!client) throw new Error('chat_not_configured');

  const catalog = jobs.map((j) => ({
    id: j.id,
    company: j.company_name,
    title: j.title,
    required_majors: j.required_majors,
    required_skills: j.required_skills,
    salary: j.salary_raw,
  }));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: JOB_MATCH_SCHEMA } },
    messages: [
      {
        role: 'user',
        content:
          `Graduate profile:\n${JSON.stringify(profile, null, 2)}\n\n` +
          `Candidate job listings:\n${JSON.stringify(catalog)}\n\n` +
          `Score and rank this graduate's best-fitting jobs.`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('chat_refused');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('empty_response');

  return { data: JSON.parse(text), model: response.model, source: 'claude' };
}

/**
 * Narrows the full job list to ones with at least some signal of relevance
 * (a shared skill or major) before it ever reaches Claude — keeps the
 * prompt small and the call fast. Falls back to a plain slice of the full
 * catalog if too few jobs show any overlap (a sparse profile shouldn't mean
 * an empty candidate list).
 */
export function candidateJobs(profile, jobs) {
  const skills = (profile.skills ?? []).map((s) => s.toLowerCase());
  const major = (profile.major ?? '').toLowerCase();

  const scored = jobs.map((job) => {
    const skillHits = (job.required_skills ?? []).filter((s) =>
      skills.some((ps) => ps.includes(s.toLowerCase()) || s.toLowerCase().includes(ps)),
    ).length;
    const majorHit = Boolean(
      major && (job.required_majors ?? []).some((m) => m.toLowerCase().includes(major) || major.includes(m.toLowerCase())),
    );
    return { job, relevance: skillHits * 2 + (majorHit ? 3 : 0) };
  });

  const relevant = scored.filter((s) => s.relevance > 0).sort((a, b) => b.relevance - a.relevance).map((s) => s.job);
  return relevant.length >= 15 ? relevant.slice(0, 60) : jobs.slice(0, 80);
}

/**
 * Deterministic fallback, used when the API key is absent or the call
 * fails — same tier-of-degradation approach as server/lib/claude.js's
 * recommendMajorsFallback. Scores every job by skill/major overlap rather
 * than the nuanced read Claude gives (e.g. it can't infer "Backend
 * experience" from a work-history description the way Claude can).
 */
export function matchJobsFallback({ profile, jobs }) {
  const skills = (profile.skills ?? []).map((s) => s.toLowerCase());
  const major = (profile.major ?? '').toLowerCase();

  const scored = jobs.map((job) => {
    const jobSkills = job.required_skills ?? [];
    const matchedSkills = jobSkills.filter((s) =>
      skills.some((ps) => ps.includes(s.toLowerCase()) || s.toLowerCase().includes(ps)),
    );
    const majorMatch = Boolean(
      major && (job.required_majors ?? []).some((m) => m.toLowerCase().includes(major) || major.includes(m.toLowerCase())),
    );

    const requirements = [
      ...jobSkills.slice(0, 5).map((s) => ({ label: s, met: matchedSkills.includes(s) })),
      ...(job.required_majors?.length ? [{ label: job.required_majors[0], met: majorMatch }] : []),
    ];

    const skillRatio = jobSkills.length ? matchedSkills.length / jobSkills.length : 0;
    const match_score = Math.round(Math.min(100, skillRatio * 70 + (majorMatch ? 30 : 0)));

    return {
      job_id: job.id,
      match_score,
      requirements,
      why: jobSkills.length
        ? `${matchedSkills.length} of ${jobSkills.length} listed skills match your profile.`
        : 'Matched mainly on major — this listing has no specific skills on file.',
    };
  });

  const matches = scored.sort((a, b) => b.match_score - a.match_score).slice(0, 10);

  return {
    data: { matches },
    model: 'rule-based-fallback',
    source: 'fallback',
  };
}
