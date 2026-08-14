# DARBI

AI-powered career and job-matching platform for Jordanian engineering students.
Built for the JSYP 2026 Hackathon by Team Sparks. **Deadline: 15 Aug 2026.**

## The bet

The defensible asset is **verified Jordanian data** — real universities, majors,
salaries, companies. The sprint plan says it outright: *"Judges will fact-check
this."* The AI layer is table stakes.

**Never invent a data point.** The figures now in the database are approved and
verified, so use them freely — but never add one the files do not contain. Every
row carries its source; unknowns stay `NULL`. A gap we disclose is survivable; a
fabricated figure a judge checks is not.

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
5. Reference data (majors, courses, university entry averages) is normally
   regenerated, not hand-edited: fix the spreadsheet, re-run
   `python3 scripts/convert_xlsx.py <dir>`, then `npm run db:seed`. **Updated:**
   the admin panel (`/portal/admin`, `server/routes/admin.js`) now also
   allows direct add/edit/delete on this catalog — the project owner
   explicitly asked for this and chose not to visually flag admin-added rows
   as distinct from spreadsheet-sourced ones. Prefer the spreadsheet+reseed
   path when a fix belongs there (it's still the source of truth for the
   original approved deliverables); use the admin panel for changes that
   don't have a spreadsheet to go back to, like adding a major only the
   admin knows about, or nudging a competitive average for a new year.

## Data pipeline

```
docs/deliverables/**.xlsx → scripts/convert_xlsx.py → data/*.json → scripts/seed.mjs → Postgres
```

`docs/deliverables/` is the **approved Phase 2 deliverable set** and the first
source of truth. `data/*.json` is committed and generated from it; runtime never
reads `.xlsx`. The converter is stdlib-only Python and reports every value it
could not parse rather than guessing.

Four approved source files, one per team member:

| File | Owner | Gives us |
|---|---|---|
| `salaries_data.xlsx` | Shadi | 9 majors × entry/3-yr/5-yr bands, top jobs, cited sources, self-graded confidence |
| `Universities_majors.xlsx` | Khaleel | 6 universities, 39 degree programmes, **Tawjihi admission averages** |
| `companies_jobs.xlsx` | Hussam | 176 listings from 147 companies + 17 fresh-grad benchmarks |
| `All Courses.xlsx` | — | 139 courses, 40 career paths, 39 centres, 20 online platforms |

Current totals: 10 majors, 6 universities, 39 programmes, 139 courses, 176 jobs.
Coverage: 9/10 majors have a salary band, 10/10 are taught somewhere, 28
programmes carry a competitive Tawjihi average.

### Two averages, never conflate them

`university_majors` holds both. `minimum_average` is the floor to apply;
`competitive_average` is what the last admitted student actually scored. A NULL
competitive average means **not published**, not "no bar". The advisor prompt
says this explicitly because students confuse the two constantly.

### Data quirks already handled

- `Universities_majors.xlsx` spells JUST as *"Jodan University of Science and
  Technology"*. Corrected for display; `universities.name_in_source` keeps the
  original.
- Majors appear under short names in the universities file (`Computer`, `CS`,
  `Medical`, `Semi Conductors`) and full names elsewhere. `MAJORS` in the
  converter is the alias map — add to it rather than renaming source data.
- BAU offers two Civil and two Electrical programmes, so a naive `array_agg` of
  university codes double-counts. Queries use `array_agg(DISTINCT …)`.
- 33 of 176 job salaries are prefixed `Est.` — market estimates, not employer
  figures. `jobs.salary_is_estimate` flags them and the advisor is told not to
  present them as confirmed.
- Every job row still says `Min GPA: Not stated`, so `min_gpa` is NULL across
  the board and the company GPA filter has nothing to bite on.
- `current_role` is a reserved word in Postgres. The column is `current_title`.

## Design system — from the approved wireframe

`docs/deliverables/Wireframes & Design/` is authoritative for layout. Tokens live
in `src/styles/global.css` with the PDF's wording quoted beside each:

| | |
|---|---|
| Navy / Gold | `#001a33` / `#d4af37` |
| Max width | **800px, centred** (`.darbi-container`) |
| Box padding | 20px (`.darbi-box`) |
| Section gap | 30px (`.darbi-section`) |
| Button height | 45px, 5px radius (`.darbi-btn`) |
| Input padding | 10px, gold focus border (`.darbi-input`) |

Use those classes rather than ad-hoc Tailwind spacing. The results card in
`RecommendationCard.jsx` reproduces the wireframe's structure exactly: rank,
MAJOR NAME, Average Salary, Universities, Top Jobs, [Learn more] [Save], with
[Show all majors] beneath the top 3.

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

Not done: deploy to Railway; mobile testing on a real device.

Closed by the approved deliverables: salary bands, universities, Tawjihi
averages. The advisor's old "never state a salary" and "no Tawjihi data"
guardrails are gone — that data is signed off now.

`scripts/smoke.sh` covers the API end to end (29 checks) and cleans up after
itself — it used to leave a fake job on the board and inflate the pathway
demand counts.
