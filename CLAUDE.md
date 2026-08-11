# DARBI

AI-powered career and job-matching platform for Jordanian engineering students.
Built for the JSYP 2026 Hackathon by Team Sparks. **Deadline: 15 Aug 2026.**

## The bet

The defensible asset is **verified Jordanian data** — real universities, majors,
salaries, companies. The sprint plan says it outright: *"Judges will fact-check
this."* The AI layer is table stakes.

**Never invent a data point.** No estimated salaries, no plausible-looking
company names, no filled-in GPA requirements. Every row carries a `source`, and
unknowns stay `NULL` with `data_quality = 'pending'`. A gap we disclose is
survivable; a fabricated figure a judge checks is not.

## Three portals, one login

`users.role` drives which dashboard a user lands in:

| role | who | what they do |
|---|---|---|
| `student` | high-schoolers, undergrads | profile → Claude recommends majors → courses, salaries, jobs |
| `company` | employers | post jobs → filter students by major / GPA / skills |
| `career` | graduates, professionals | AI mentorship, skills-gap assessment, networking |

## Stack

Everything lives in one Railway project: Postgres + a single Node service that
serves **both** the API and the built React app. One URL for judges, no CORS.

- React 19 + Vite → `dist/`, served by Express in production
- Express 5 + `pg` (raw SQL, no ORM)
- Auth: `users` table + bcryptjs + JWT. **Not** Firebase — we moved off it.
- Claude via `@anthropic-ai/sdk`, **server-side only**

## Commands

```bash
npm run db:up        # local Postgres in Docker (host port 5434)
npm run db:migrate   # apply db/schema.sql (idempotent)
npm run db:seed      # load data/*.json + demo accounts (idempotent)
npm run db:reset     # drop everything, re-migrate, re-seed
npm run dev          # API :3000 + Vite :5174 concurrently
npm run build        # → dist/
npm start            # production: one server, both jobs
```

Ports 5432, 5433 and 5173 are taken by the user's other projects — hence 5434
and 5174. Don't "fix" these back to defaults.

## Hard rules

1. **The Anthropic key never reaches the browser.** It is `ANTHROPIC_API_KEY`,
   read only in `server/`. Anything named `VITE_*` is compiled into the public
   bundle. If you ever see `VITE_ANTHROPIC_*` or `VITE_CLAUDE_*`, that is a
   leak — fix it, don't work around it.
2. **Model is `claude-opus-5`** (via `ANTHROPIC_MODEL`). Don't downgrade for cost.
3. **Parameterised SQL only** — `$1`, `$2`. Never string-interpolate user input.
4. `npm run db:migrate -- --drop` refuses to run against a non-local database
   unless `ALLOW_DESTRUCTIVE=1`. Leave that guard in place.
5. Reference data is regenerated, not hand-edited: fix the spreadsheet, re-run
   `python3 scripts/convert_xlsx.py <dir>`, then `npm run db:seed`.

## Data pipeline

```
team's *.xlsx  →  scripts/convert_xlsx.py  →  data/*.json  →  scripts/seed.mjs  →  Postgres
```

`data/*.json` is committed — it is the actual deliverable dataset. Runtime never
reads `.xlsx`. The converter is stdlib-only Python (no pip install) and reports
every value it could not parse rather than guessing.

Current contents: 8 majors, 108 courses, 50 jobs (36 companies), 21 career
paths, 13 training centres.

### Known gaps — disclose, don't fill

These were Week-1 deliverables that never landed:

- **No salary data.** All 8 majors have `salary_*_jod = NULL`,
  `data_quality = 'pending'`. The student results page must degrade gracefully.
- **No universities.** `universities` is empty; `data/universities.json` is `[]`.
- **No GPA requirements.** All 50 seeded jobs have `min_gpa = NULL` (every
  spreadsheet row said "Not stated"), so the company portal's GPA filter has
  nothing to bite on yet. Filter logic treats `NULL` as "no requirement".

### Data quirks already handled

- `companies_jobs_FINAL.xlsx` (33 rows) is a **subset** of `companies_jobs.xlsx`
  (50 rows), not a newer version. Both are entirely `Verified`. The converter
  takes the union, deduped on (company, title).
- Two spreadsheets pack two majors into one sheet, split where the `1. / 2. /
  3.` sub-field numbering resets. Verified split: Civil/Computer Science and
  Software/Computer Engineering, 8 courses each.
- One salary reads `000-1,600` (a typo for `1,000-1,600`). Left unparsed with
  `salary_raw` preserved — do not "correct" it without a source.
- `0-100` costs are genuine (free-to-100-JOD online courses), not typos.
- `current_role` is a reserved word in Postgres. The column is `current_title`.

## Layout

```
db/schema.sql        single source of truth for the schema
server/index.js      Express: /api/* then static dist/
server/lib/db.js     pg pool, query(), withTransaction()
server/routes/       auth, students, companies, recommend   (day 2)
src/                 React app
scripts/             convert_xlsx.py, migrate.mjs, seed.mjs
data/                normalized JSON (committed)
docs/                design PDF, sprint plan, submission docs
```

## Deploying to Railway

Two services in one project: **Postgres** and the app. On the app service set
`DATABASE_URL = ${{Postgres.DATABASE_URL}}` (a reference variable, not a paste),
plus `JWT_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DEMO_PASSWORD`.
`railway.json` runs migrate on every deploy and health-checks `/api/health`.

## Demo accounts

`student@darbi.jo`, `company@darbi.jo`, `career@darbi.jo` — password from
`DEMO_PASSWORD` (default `darbi2026`). Recreated by `npm run db:seed`. Judges
use these; keep them working.

## The pitch deck is the spec

`docs/Darbi - v2 - Final View.pptx` is the newest artifact and outranks the
sprint plan where they disagree. It pitches a **conversational advisor**, not a
form — slide 4 says "conversational, not a quiz… a static form would miss"
those constraints and doubts. Slide 9's final deliverable is a *"live demo of
both student journeys."*

Two consequences:

- **Chat is the product**, and it is the student dashboard's default tab.
- **The Company and Career Boost portals appear nowhere in the deck.** They are
  built and working, and cost nothing to leave in — but don't demo them, and
  don't invest more in them.

Slide 8's build commitments, and where they stand:

| Commitment | Status |
|---|---|
| Chat interface with AI advisor logic | done — needs API credit |
| Adaptive flow: school vs undergrad | done — `students.level` branches prompt + openers |
| Admin-curated database | done — 8 majors, 6 institutions, 108 courses, 50 jobs |
| Visual pathway output card | done — `/api/pathways/:slug` + Pathways tab |

The deck scopes "3-4 majors, 2-3 universities". We carry all 8 majors and all 6
institutions found in the files — deliberately more than promised.

## Three failure tiers, by design

Judges see something working at every level of degradation:

1. **Full** — chat advisor answers, grounded in the catalog.
2. **No API credit** — chat shows a specific billing message and links across to
   Recommendations, which fall back to deterministic rule-based ranking.
3. **Pathway card** — computed entirely in SQL, no model call at all. It renders
   identically whether or not the key works. This is the safest thing to demo.

Keep it that way. Don't make the pathway card depend on a model call.

## Status

Done: repo, schema, data pipeline, seed, auth, three dashboards, recommendation
endpoint with rule-based fallback, university extraction, streaming chat
advisor, pathway card.

Not done: deploy to Railway; Tawjihi data (blocks the school journey as the deck
describes it); salary bands; university links for six of eight majors.

`scripts/smoke.sh` covers the API end to end (29 checks) and cleans up after
itself — it used to leave a fake job on the board and inflate the pathway
demand counts.
