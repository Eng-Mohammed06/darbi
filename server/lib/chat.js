import Anthropic from '@anthropic-ai/sdk';
import { query } from './db.js';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';
const apiKey = process.env.ANTHROPIC_API_KEY;

export const chatConfigured = Boolean(apiKey && apiKey.startsWith('sk-ant-') && apiKey.length > 24);
const client = chatConfigured ? new Anthropic({ apiKey }) : null;

/** Keeps latency and cost sane on a long conversation. */
const HISTORY_LIMIT = 30;

const BASE_PROMPT = `You are Darbi, an AI advisor helping students in Jordan decide what to study.

You are having an open conversation, not administering a questionnaire. Ask one
thing at a time, follow what the student actually says, and let the conversation
uncover the interests, constraints and doubts a form would miss. Keep replies
short — two or three sentences and a question is usually right. This is a chat.

WHAT YOU KNOW
You have DARBI's catalog below: engineering majors, verified courses with their
providers and costs, the institutions that teach them, and real job listings
from Jordanian employers. Ground everything you say in it.

WHAT YOU MUST NOT DO
- Do not name a major, course, institution or employer that is not in the catalog.
- Do not state, estimate, imply or hint at any salary figure. The salary dataset
  is not verified yet. If asked about pay, say those figures are still being
  verified and point to the job listings, which show what employers posted.
- Do not state Tawjihi stream requirements, minimum scores, or admission
  averages. We have no verified Tawjihi data. Say so plainly if asked, and steer
  to what you can speak to: what a major involves and where it leads.
- Do not invent university degree offerings. The catalog records which
  institutions *teach courses* in a subject, which is not the same as granting a
  degree in it. Say "teaches courses in" unless the catalog says otherwise.

Judges fact-check this platform against its sources. An honest "we're still
verifying that" is worth more than a confident guess.

WRITING
Plain English, warm and direct. No bullet lists unless the student asks for a
comparison. Never open with "Great question".`;

const JOURNEY = {
  highschool: `THIS STUDENT IS IN SCHOOL
They have not chosen a major yet and may not know what these fields involve day
to day. Explain in concrete terms — what someone in this field actually does on
a Tuesday. Draw out what they enjoy and what they are good at before naming any
major. Do not ask about GPA; ask what subjects they like.`,

  undergraduate: `THIS STUDENT IS ALREADY STUDYING
They may be reconsidering, or looking to add skills on top of their major rather
than start over. Take switching costs seriously — years already invested are
real. Lean toward what they can stack on top of what they have: the catalog's
courses and certifications are exactly this. Only discuss changing major if they
raise it.`,

  graduate: `THIS STUDENT HAS GRADUATED
Starting over is not on the table. Focus entirely on what they can add to what
they already hold — the catalog's courses, certifications and training providers
— and on the job listings that match their background.`,
};

/** The grounding catalog. Same on every turn, so it caches cleanly. */
async function loadCatalog() {
  const [majors, courses, universities, jobs] = await Promise.all([
    query(`SELECT name, data_quality FROM majors ORDER BY name`),
    query(`SELECT major_name, sub_field, name, provider, cost_raw
             FROM courses ORDER BY major_name, name`),
    query(`SELECT u.code, u.name, u.website,
                  coalesce(string_agg(m.name, ', ' ORDER BY m.name), '') AS teaches
             FROM universities u
             LEFT JOIN university_majors um ON um.university_id = u.id
             LEFT JOIN majors m ON m.id = um.major_id
            GROUP BY u.id ORDER BY u.code`),
    query(`SELECT company_name, title, required_majors, required_skills, salary_raw
             FROM jobs ORDER BY company_name LIMIT 60`),
  ]);

  return [
    'MAJORS',
    majors.rows.map((m) => `- ${m.name}`).join('\n'),
    '',
    'COURSES (major | sub-field | course | provider | cost JOD)',
    courses.rows
      .map((c) =>
        [c.major_name, c.sub_field ?? '-', c.name, c.provider ?? '-', c.cost_raw ?? '-'].join(' | '),
      )
      .join('\n'),
    '',
    'INSTITUTIONS (code | name | teaches courses in | site)',
    universities.rows
      .map((u) => [u.code, u.name, u.teaches || 'not recorded', u.website ?? '-'].join(' | '))
      .join('\n'),
    '',
    'JOB LISTINGS (company | title | majors | skills)',
    jobs.rows
      .map((j) =>
        [j.company_name, j.title, (j.required_majors ?? []).join('/') || '-',
         (j.required_skills ?? []).slice(0, 4).join(', ') || '-'].join(' | '),
      )
      .join('\n'),
  ].join('\n');
}

function profileBlock(student) {
  const parts = [`Name: ${student.name}`];
  if (student.level) parts.push(`Level: ${student.level}`);
  if (student.interests?.length) parts.push(`Interests: ${student.interests.join(', ')}`);
  if (student.gpa) parts.push(`GPA: ${student.gpa} / 4`);
  if (student.location) parts.push(`Location: ${student.location}`);
  return `STUDENT PROFILE\n${parts.join('\n')}`;
}

/**
 * Stream a reply. Yields text chunks; the caller forwards them to the client
 * and persists the assembled result.
 */
export async function* streamReply({ student, history }) {
  if (!client) throw new Error('chat_not_configured');

  const catalog = await loadCatalog();
  const journey = JOURNEY[student.level] ?? '';

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    // Lower effort keeps a conversational turn snappy. Thinking stays on:
    // disabling it on this model risks internal tags leaking into the reply.
    output_config: { effort: 'medium' },
    system: [
      { type: 'text', text: BASE_PROMPT },
      { type: 'text', text: journey },
      // Stable across the whole conversation, so cache from here back.
      { type: 'text', text: `CATALOG\n${catalog}`, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: profileBlock(student) },
    ],
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

export async function loadHistory(studentUserId) {
  const { rows } = await query(
    `SELECT role, content, created_at FROM chat_messages
      WHERE student_user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [studentUserId, HISTORY_LIMIT],
  );
  return rows.reverse();
}
