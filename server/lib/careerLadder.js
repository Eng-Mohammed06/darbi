import { client, chatConfigured, MODEL } from './chat.js';

export { chatConfigured };

/** Shape Claude must return. Enforced server-side, so no parsing guesswork. */
const LADDER_SCHEMA = {
  type: 'object',
  properties: {
    rungs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Job title at this rung, e.g. "Junior Software Engineer"' },
          typical_years: { type: 'string', description: 'Typical years of experience to reach this rung, e.g. "0-2 years"' },
          focus: { type: 'string', description: '1-2 sentences on what this rung is about and the skills that matter most here' },
        },
        required: ['title', 'typical_years', 'focus'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string', description: 'One short paragraph of guidance for climbing this ladder, grounded in the graduate’s actual background' },
  },
  required: ['rungs', 'summary'],
  additionalProperties: false,
};

const SYSTEM = `You map out realistic career progression ladders for university graduates
and working professionals in Jordan.

You will be given a graduate's profile (major, current role, years of
experience, skills, certificates, projects, work experience, career
interests) and a sample of real Jordanian job listings for grounding on
realistic titles and market context.

Build a 4-5 rung career ladder starting from roughly where they are now (or
an entry point into their field if they have no current role yet) up through
a senior/lead-level destination. Each rung needs a realistic job title, a
typical years-of-experience range, and 1-2 sentences on what that rung is
about and what skills matter most there.

Ground the ladder in their ACTUAL major and any current role/experience they
have -- do not propose an unrelated field. If they have real experience or
skills listed, factor that into where they currently sit on the ladder and
what the summary advises. Write the summary directly to the graduate.`;

/**
 * Ask Claude for a personalized career ladder.
 * Throws on API failure — the caller falls back to a generic template.
 */
export async function generateCareerLadder({ profile, jobsSample }) {
  if (!client) throw new Error('chat_not_configured');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: LADDER_SCHEMA } },
    messages: [
      {
        role: 'user',
        content:
          `Graduate profile:\n${JSON.stringify(profile, null, 2)}\n\n` +
          `Sample Jordanian job listings for grounding:\n${JSON.stringify(jobsSample)}\n\n` +
          `Build this graduate's career ladder.`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('chat_refused');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('empty_response');

  return { data: JSON.parse(text), model: response.model, source: 'claude' };
}

/** Falls back to a role name per major when there's no current title to anchor on. */
const MAJOR_ROLE = {
  'Computer Science': 'Software Engineer',
  'Computer Engineering': 'Software Engineer',
  'Software Engineering': 'Software Engineer',
  'Electrical Engineering': 'Electrical Engineer',
  'Mechanical Engineering': 'Mechanical Engineer',
  'Civil Engineering': 'Civil Engineer',
  'Chemical Engineering': 'Chemical Engineer',
  'Biomedical Engineering': 'Biomedical Engineer',
  'Mechatronics Engineering': 'Mechatronics Engineer',
  'Semiconductor Engineering': 'Semiconductor Engineer',
};

/**
 * Deterministic fallback, used when the API key is absent or the call fails
 * — same tier-of-degradation approach as server/lib/claude.js's
 * recommendMajorsFallback. A generic 4-rung template anchored on the
 * graduate's current title (or a role inferred from their major), rather
 * than one personalized to their actual background.
 */
export function generateCareerLadderFallback({ profile }) {
  const base = profile.current_title?.trim() || MAJOR_ROLE[profile.major] || profile.major || 'Engineer';
  const role = base.replace(/^(junior|senior|lead|principal|associate|staff)\s+/i, '').trim() || base;

  const rungs = [
    {
      title: `Junior ${role}`,
      typical_years: '0-2 years',
      focus: `Building core skills in ${role.toLowerCase()} work, learning your team's tools and systems under guidance.`,
    },
    {
      title: role,
      typical_years: '2-5 years',
      focus: 'Owning features or projects independently and starting to mentor newer teammates.',
    },
    {
      title: `Senior ${role}`,
      typical_years: '5-8 years',
      focus: "Leading complex projects, setting technical direction, and reviewing others' work.",
    },
    {
      title: `${role} Lead`,
      typical_years: '8+ years',
      focus: 'Leading a team, shaping strategy, and balancing technical and people responsibilities.',
    },
  ];

  return {
    data: {
      rungs,
      summary:
        `A general progression for ${role} roles. AI-personalized guidance is unavailable right now, ` +
        'so this is a generic ladder rather than one tailored to your specific background.',
    },
    model: 'rule-based-fallback',
    source: 'fallback',
  };
}
