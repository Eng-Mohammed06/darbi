import { client, chatConfigured, MODEL } from './chat.js';
import { query } from './db.js';

export { chatConfigured };

/** Keeps latency and cost sane on a long conversation. */
const HISTORY_LIMIT = 30;

const BASE_PROMPT = `You are Darbi, an AI assistant for university graduates and working
professionals in Jordan building or advancing their career.

You help with five things: polishing a CV, drafting a cover letter, interview
preparation, general career questions, and a learning roadmap toward a role
they want. If it isn't obvious from their message which one they're after,
ask before diving in. Keep replies focused and practical -- this is a working
session, not a lecture.

WHAT YOU KNOW
Below is this graduate's own profile (education, skills, certificates,
projects, experience, career interests) and DARBI's verified Jordanian job
catalog. Ground your advice in both -- reference their actual background
rather than generic advice, and when discussing job fit or market roles, cite
a real listing from the catalog rather than inventing one.

WHAT YOU MUST NOT DO
- Do not invent a job listing, company, or salary figure that is not in the
  catalog below.
- Do not fabricate skills, experience, or credentials the graduate hasn't told
  you about. If their profile is thin for what they're asking (e.g. a CV
  request with no listed experience), say so and ask, rather than padding it
  with invented content.

WRITING
Plain English, direct and practical. When producing a CV bullet, cover
letter, or similar written artifact, write it out in full so it can be
copied directly -- don't just describe what it should contain.`;

function profileBlock(profile) {
  const parts = [`Name: ${profile.name}`];
  if (profile.current_title) parts.push(`Current role: ${profile.current_title}`);
  if (profile.years_experience != null) parts.push(`Years of experience: ${profile.years_experience}`);
  if (profile.major) parts.push(`Major: ${profile.major}`);
  if (profile.university) parts.push(`University: ${profile.university}`);
  if (profile.year_graduated) parts.push(`Year graduated: ${profile.year_graduated}`);
  if (profile.skills?.length) parts.push(`Skills: ${profile.skills.join(', ')}`);
  if (profile.career_goals?.length) parts.push(`Career interests: ${profile.career_goals.join(', ')}`);
  if (profile.certificates?.length) {
    parts.push(`Certificates: ${profile.certificates.map((c) => (c.issuer ? `${c.name} (${c.issuer})` : c.name)).join('; ')}`);
  }
  if (profile.projects?.length) {
    parts.push(`Projects: ${profile.projects.map((p) => p.title).join('; ')}`);
  }
  if (profile.experience?.length) {
    parts.push(`Work experience: ${profile.experience.map((e) => (e.company ? `${e.title} at ${e.company}` : e.title)).join('; ')}`);
  }
  parts.push(profile.cv ? 'Has a CV file uploaded to Darbi.' : 'Has not uploaded a CV file to Darbi yet.');
  return `GRADUATE PROFILE\n${parts.join('\n')}`;
}

/** Same real job listings the student advisor grounds itself in — this data isn't student-specific. */
async function loadJobsCatalog() {
  const { rows } = await query(
    `SELECT company_name, title, required_majors, required_skills, salary_raw, salary_is_estimate
       FROM jobs ORDER BY company_name LIMIT 120`,
  );
  return rows
    .map((j) =>
      [j.company_name, j.title, (j.required_majors ?? []).join('/') || '-',
       (j.required_skills ?? []).slice(0, 6).join(', ') || '-', j.salary_raw ?? '-'].join(' | '),
    )
    .join('\n');
}

/**
 * Stream a reply. Yields text chunks; the caller forwards them to the client
 * and persists the assembled result.
 */
export async function* streamCareerReply({ profile, history }) {
  if (!client) throw new Error('chat_not_configured');

  const jobs = await loadJobsCatalog();

  const system = [
    { type: 'text', text: BASE_PROMPT },
    {
      type: 'text',
      text: `JOB LISTINGS (company | title | majors | skills | salary — "Est." means market estimate)\n${jobs}`,
      cache_control: { type: 'ephemeral' },
    },
    { type: 'text', text: profileBlock(profile) },
  ];

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    // Lower effort keeps a conversational turn snappy. Thinking stays on:
    // disabling it on this model risks internal tags leaking into the reply.
    output_config: { effort: 'medium' },
    system,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') throw new Error('chat_refused');
}

export async function loadCareerHistory(careerUserId) {
  const { rows } = await query(
    `SELECT role, content, created_at FROM career_chat_messages
      WHERE career_user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [careerUserId, HISTORY_LIMIT],
  );
  return rows.reverse();
}
