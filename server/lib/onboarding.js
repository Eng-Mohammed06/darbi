import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';
const apiKey = process.env.ANTHROPIC_API_KEY;

export const onboardingConfigured = Boolean(apiKey && apiKey.startsWith('sk-ant-') && apiKey.length > 24);
const client = onboardingConfigured ? new Anthropic({ apiKey }) : null;

/**
 * Asked once, right after signup. Kept to four — enough for Claude to read
 * genuine signal (interests, strengths, priorities, constraints) without
 * turning signup into a form long enough to abandon halfway through.
 */
export const ONBOARDING_QUESTIONS = [
  {
    id: 'enjoy',
    question:
      'What subjects, hobbies, or activities do you enjoy most — and what is it about them that pulls you in?',
    required: true,
  },
  {
    id: 'strengths',
    question: 'What are you naturally good at, or what do teachers, friends, or family often compliment you on?',
    required: true,
  },
  {
    id: 'priorities',
    question:
      'When you picture your future career, what matters most to you — salary, stability, creativity, helping people, prestige, something else? Say a bit about why.',
    required: true,
  },
  {
    id: 'constraints',
    question:
      "Anything I should factor in — a location you're tied to, a budget for study, family expectations, or subjects you'd rather avoid?",
    required: false,
  },
];

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    interest_summary: {
      type: 'string',
      description: 'One or two sentences on what genuinely interests this student.',
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short phrases, drawn only from what the student actually said.',
    },
    values_priorities: {
      type: 'array',
      items: { type: 'string' },
      description: 'What the student values in a career, ordered most to least important.',
    },
    constraints: {
      type: 'array',
      items: { type: 'string' },
      description: 'Practical constraints or preferences the student mentioned; empty array if none.',
    },
    suggested_focus_areas: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Broad fields worth exploring first based on the answers (e.g. "software", "renewable energy") — general areas, not exact catalog major names.',
    },
    advisor_notes: {
      type: 'string',
      description: 'One or two sentences telling the chat advisor how to talk to this student — tone, what to lead with, what to avoid.',
    },
  },
  required: [
    'interest_summary',
    'strengths',
    'values_priorities',
    'constraints',
    'suggested_focus_areas',
    'advisor_notes',
  ],
  additionalProperties: false,
};

const SYSTEM = `You read a Jordanian engineering student's onboarding answers and turn them into a short structured profile for another AI advisor to use later.

Base every field only on what the student actually wrote. Do not invent interests, strengths, or constraints they did not mention. If an answer is thin or missing, leave the corresponding field sparse or empty rather than guessing.`;

/**
 * Ask Claude to turn the raw onboarding answers into a structured profile.
 * Throws on failure — the caller falls back to storing the answers unprocessed.
 */
export async function analyzeOnboarding({ name, answers }) {
  if (!client) throw new Error('onboarding_not_configured');

  const transcript = answers
    .map((a) => `Q: ${a.question}\nA: ${a.answer || '(no answer given)'}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: ANALYSIS_SCHEMA } },
    messages: [{ role: 'user', content: `Student name: ${name}\n\nOnboarding answers:\n\n${transcript}` }],
  });

  if (response.stop_reason === 'refusal') throw new Error('onboarding_refused');

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('onboarding_empty_response');

  return { data: JSON.parse(text), model: response.model, source: 'claude' };
}

/**
 * Deterministic fallback used when Claude is unreachable or unconfigured.
 * Keeps the student's own words rather than inventing structure around them —
 * consistent with the rest of DARBI never presenting a guess as an analysis.
 */
export function analyzeOnboardingFallback(answers) {
  const byId = Object.fromEntries(answers.map((a) => [a.id, a.answer]));
  return {
    data: {
      interest_summary: byId.enjoy || '',
      strengths: [],
      values_priorities: byId.priorities ? [byId.priorities] : [],
      constraints: byId.constraints ? [byId.constraints] : [],
      suggested_focus_areas: [],
      advisor_notes:
        'AI analysis was unavailable at signup, so this profile was not summarized — treat the ' +
        "fields above as the student's own words, unprocessed.",
    },
    model: 'raw-fallback',
    source: 'fallback',
  };
}
