import Anthropic from '@anthropic-ai/sdk';
import { query } from './db.js';

export const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';
const apiKey = process.env.ANTHROPIC_API_KEY;

export const chatConfigured = Boolean(apiKey && apiKey.startsWith('sk-ant-') && apiKey.length > 24);
// Exported so server/lib/careerChat.js (the Graduate Portal's AI Assistant)
// can share the same client/config check rather than re-deriving it.
export const client = chatConfigured ? new Anthropic({ apiKey }) : null;

/** Keeps latency and cost sane on a long conversation. */
const HISTORY_LIMIT = 30;

const BASE_PROMPT = `You are Darbi, an AI advisor helping students in Jordan decide what to study.

You are having an open conversation, not administering a questionnaire. Ask one
thing at a time, follow what the student actually says, and let the conversation
uncover the interests, constraints and doubts a form would miss. Keep replies
short — two or three sentences and a question is usually right. This is a chat.

WHAT YOU KNOW
The catalog below is DARBI's verified Jordanian dataset, signed off by the team:
engineering majors with real salary bands, the universities that grant each
degree with their Tawjihi admission averages, courses with providers and costs,
and job listings from Jordanian employers. Ground everything you say in it.

Use these figures freely — that is what they are for. Quote a salary band as a
range, not a single number, and say which stage it is (entry, 3-year, 5-year).

HOW TO HANDLE ADMISSION AVERAGES
Each programme has a minimum average (the floor to apply) and, where published,
a competitive average (what the last admitted student actually scored). Those
are different numbers and students confuse them constantly — be explicit about
which one you mean. Where the competitive average is missing the university has
not published one; say that rather than implying there is no bar.

WHAT YOU MUST NOT DO
- Do not name a major, course, institution or employer that is not in the catalog.
- Do not invent a salary figure or an admission average that is not listed. If a
  major has no band, say so.
- Do not present an estimated job salary as confirmed. Listings marked "Est."
  are market estimates, not what the employer published.

Judges fact-check this platform against its sources. Every figure you quote can
be traced back to a cited source, so quote them accurately and never round a
range into a single confident number.

TRACKING COURSE PROGRESS
Once a major or course comes up, ask what the student has already completed,
what they're currently taking, and what they're considering enrolling in next
— one question at a time, same as everything else. You don't need to do
anything to record their answer; it's checked off automatically. If COURSE
PROGRESS SO FAR is present below, that's already known — don't ask about
those again, and don't contradict it. Once you know their major and what
they've done, recommend which catalog course to start with next and say why
in a sentence or two, grounded in their onboarding analysis and constraints
below — not a generic "start with the intro course" answer.

WRITING
Plain English, warm and direct. No bullet lists unless the student asks for a
comparison. Never open with "Great question".`;

const JOURNEY = {
  highschool: `THIS STUDENT IS IN SCHOOL
They have not chosen a major yet and may not know what these fields involve day
to day. Explain in concrete terms — what someone in this field actually does on
a Tuesday. Draw out what they enjoy and what they are good at before naming any
major. Do not ask about university GPA — they do not have one. Their Tawjihi
average is the number that gates admission, so if they share it, tell them which
programmes it actually opens and which are out of reach this year.`,

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
  const [majors, programmes, courses, jobs, benchmarks] = await Promise.all([
    query(`SELECT name, data_quality, top_jobs,
                  salary_entry_min_jod, salary_entry_max_jod,
                  salary_3yr_min_jod, salary_3yr_max_jod,
                  salary_5yr_min_jod, salary_5yr_max_jod
             FROM majors ORDER BY name`),
    query(`SELECT u.code, m.name AS major, um.program_name, um.duration_years,
                  um.minimum_average, um.competitive_average
             FROM university_majors um
             JOIN universities u ON u.id = um.university_id
             JOIN majors m ON m.id = um.major_id
            ORDER BY m.name, u.code`),
    query(`SELECT major_name, track, name, provider, cost_raw
             FROM courses ORDER BY major_name, name`),
    query(`SELECT company_name, title, required_majors, required_skills,
                  salary_raw, salary_is_estimate
             FROM jobs ORDER BY company_name LIMIT 80`),
    query(`SELECT role_family, range_raw, source FROM salary_benchmarks ORDER BY role_family`),
  ]);

  const band = (lo, hi) => (lo == null ? '—' : lo === hi ? `${lo}` : `${lo}-${hi}`);

  return [
    'MAJORS (name | entry JOD/mo | 3-yr | 5-yr | confidence)',
    majors.rows
      .map((m) =>
        [m.name,
         band(m.salary_entry_min_jod, m.salary_entry_max_jod),
         band(m.salary_3yr_min_jod, m.salary_3yr_max_jod),
         band(m.salary_5yr_min_jod, m.salary_5yr_max_jod),
         m.data_quality].join(' | '),
      )
      .join('\n'),
    '',
    'TOP JOBS PER MAJOR',
    majors.rows
      .filter((m) => m.top_jobs?.length)
      .map((m) => `${m.name}: ${m.top_jobs.join('; ')}`)
      .join('\n'),
    '',
    'DEGREE PROGRAMMES (university | major | programme | years | min avg | competitive avg)',
    programmes.rows
      .map((p) =>
        [p.code, p.major, p.program_name, p.duration_years ?? '-',
         p.minimum_average ?? '-', p.competitive_average ?? 'not published'].join(' | '),
      )
      .join('\n'),
    '',
    'COURSES (major | track | course | provider | cost JOD)',
    courses.rows
      .map((c) =>
        [c.major_name ?? 'any', c.track ?? '-', c.name, c.provider ?? '-', c.cost_raw ?? '-'].join(' | '),
      )
      .join('\n'),
    '',
    'FRESH-GRAD BENCHMARKS (role family | JOD/mo)',
    benchmarks.rows.map((b) => `${b.role_family} | ${b.range_raw}`).join('\n'),
    '',
    'JOB LISTINGS (company | title | majors | skills | salary — "Est." means market estimate)',
    jobs.rows
      .map((j) =>
        [j.company_name, j.title, (j.required_majors ?? []).join('/') || '-',
         (j.required_skills ?? []).slice(0, 4).join(', ') || '-',
         j.salary_raw ?? '-'].join(' | '),
      )
      .join('\n'),
  ].join('\n');
}

function profileBlock(student) {
  const parts = [`Name: ${student.name}`];
  if (student.level) parts.push(`Level: ${student.level}`);
  if (student.major_name) parts.push(`Major: ${student.major_name}`);
  if (student.university_name) parts.push(`University: ${student.university_name}`);
  if (student.interests?.length) parts.push(`Interests: ${student.interests.join(', ')}`);
  // Some Jordanian universities grade out of 100 rather than the standard
  // 4.0 scale — gpa_scale (set at profile setup) says which this student used.
  if (student.gpa) parts.push(`University GPA: ${student.gpa} / ${student.gpa_scale === '100' ? '100' : '4'}`);
  if (student.tawjihi_average) parts.push(`Tawjihi average: ${student.tawjihi_average}%`);
  if (student.location) parts.push(`Location: ${student.location}`);
  return `STUDENT PROFILE\n${parts.join('\n')}`;
}

/**
 * The structured read on the student's onboarding answers (see
 * server/lib/onboarding.js), folded in so the advisor already knows this
 * before the first message — not something to re-derive fact by fact.
 */
function analysisBlock(analysis) {
  const parts = [];
  if (analysis.interest_summary) parts.push(`Interests: ${analysis.interest_summary}`);
  if (analysis.strengths?.length) parts.push(`Strengths: ${analysis.strengths.join(', ')}`);
  if (analysis.values_priorities?.length) parts.push(`Career priorities: ${analysis.values_priorities.join(', ')}`);
  if (analysis.constraints?.length) parts.push(`Constraints: ${analysis.constraints.join(', ')}`);
  if (analysis.suggested_focus_areas?.length) {
    parts.push(`Focus areas worth exploring: ${analysis.suggested_focus_areas.join(', ')}`);
  }
  if (analysis.advisor_notes) parts.push(`Notes: ${analysis.advisor_notes}`);
  if (!parts.length) return '';
  return `ONBOARDING ANALYSIS (from this student's signup questions — use it to personalize, ` +
    `but still ground every fact in the catalog above)\n${parts.join('\n')}`;
}

/**
 * What the student has told us (or the checkbox in the Majors tab recorded)
 * about specific courses, folded in so the advisor doesn't re-ask for
 * something it already knows and can ground its "start with X" advice in it.
 */
function courseProgressBlock(progress) {
  if (!progress?.length) return '';
  const byStatus = { completed: [], in_progress: [], planned: [] };
  for (const p of progress) byStatus[p.status]?.push(p.name);

  const parts = [];
  if (byStatus.completed.length) parts.push(`Completed: ${byStatus.completed.join(', ')}`);
  if (byStatus.in_progress.length) parts.push(`Currently taking: ${byStatus.in_progress.join(', ')}`);
  if (byStatus.planned.length) parts.push(`Considering enrolling in: ${byStatus.planned.join(', ')}`);
  if (!parts.length) return '';
  return `COURSE PROGRESS SO FAR\n${parts.join('\n')}`;
}

/**
 * Stream a reply. Yields text chunks; the caller forwards them to the client
 * and persists the assembled result.
 */
export async function* streamReply({ student, analysis, history, courseProgress }) {
  if (!client) throw new Error('chat_not_configured');

  const catalog = await loadCatalog();
  const journey = JOURNEY[student.level] ?? '';

  const system = [
    { type: 'text', text: BASE_PROMPT },
    journey && { type: 'text', text: journey },
    // Stable across the whole conversation, so cache from here back.
    { type: 'text', text: `CATALOG\n${catalog}`, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: profileBlock(student) },
    analysis && { type: 'text', text: analysisBlock(analysis) },
    courseProgress?.length && { type: 'text', text: courseProgressBlock(courseProgress) },
  ].filter((block) => block && block.text);

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

const COURSE_STATUS_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          course_id: { type: 'integer' },
          status: { type: 'string', enum: ['completed', 'in_progress', 'planned'] },
        },
        required: ['course_id', 'status'],
        additionalProperties: false,
      },
    },
  },
  required: ['matches'],
  additionalProperties: false,
};

/**
 * Best-effort, non-streaming side read of the student's latest message: did
 * they just say they finished, are taking, or are considering a specific
 * catalog course? If so, server/routes/chat.js checks it for them in the
 * Majors tab instead of making them find and tick it by hand. Called in
 * parallel with streamReply — never blocks or breaks the visible chat reply,
 * since a missed extraction here is far cheaper than a broken one there.
 */
export async function extractCourseProgress({ message, courseManifest, currentProgress }) {
  if (!client || !courseManifest.length) return [];

  const known = currentProgress?.length
    ? `\n\nALREADY TRACKED (id: status) — don't downgrade one of these unless the student clearly ` +
      `says otherwise (e.g. retaking it):\n${currentProgress.map((p) => `${p.course_id}: ${p.status}`).join('\n')}`
    : '';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    output_config: { format: { type: 'json_schema', schema: COURSE_STATUS_SCHEMA } },
    system:
      'Read the student message and match it against this course list by id. Only include a ' +
      'course the student clearly referred to as something they finished/took, are currently ' +
      'taking, or are considering enrolling in next. If nothing matches, return an empty array. ' +
      'Never invent a course_id that is not in the list.\n\nCOURSES (id | name)\n' +
      courseManifest.map((c) => `${c.id} | ${c.name}`).join('\n') + known,
    messages: [{ role: 'user', content: message }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) return [];

  const validIds = new Set(courseManifest.map((c) => c.id));
  return JSON.parse(text).matches.filter((m) => validIds.has(m.course_id));
}
