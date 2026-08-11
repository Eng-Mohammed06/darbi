# DARBI 🎓

AI-powered career and job-matching platform for Jordanian engineering students.
JSYP 2026 Hackathon — Team Sparks.

A **conversational AI advisor** grounded in verified Jordanian data: real salary
bands, the universities that grant each degree with their Tawjihi admission
averages, courses with providers and costs, and 176 job listings from Jordanian
employers.

Three portals on one login: **Student** (talk to the advisor, build a pathway),
**Company** (post jobs, filter students), **Career Boost** (learning paths).

## Requirements

- Node 20+
- Docker (local Postgres only — Railway provides it in production)
- Python 3 (only to re-convert spreadsheets; stdlib only, nothing to install)

## Run it locally

```bash
npm install
cp .env.example .env      # then set ANTHROPIC_API_KEY and JWT_SECRET
npm run db:up             # Postgres in Docker, host port 5434
npm run db:migrate        # create tables
npm run db:seed           # load data/*.json + demo accounts
npm run dev               # API :3000, web :5174
```

Open http://localhost:5174.

Demo logins (password `darbi2026`): `student@darbi.jo`, `company@darbi.jo`,
`career@darbi.jo`.

Ports 5434 and 5174 are deliberate — 5432/5433/5173 collide with other projects
on the original dev machine. Change them in `docker-compose.yml`, `.env` and
`vite.config.js` together if you need to.

### Check the install

```bash
bash scripts/smoke.sh     # 29 API checks, cleans up after itself
```

The seed also prints a coverage report. A healthy install shows **9/10** majors
with a salary band, **10/10** taught at a university, and **28** programmes with
a competitive Tawjihi average.

### Without an Anthropic key

The app still runs. The chat advisor is the only thing that needs the API:
recommendations fall back to deterministic rule-based ranking, and the pathway
card is pure SQL. If the key is set but the account has no credit, the advisor
says so explicitly rather than looking broken.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + Tailwind |
| Backend | Express 5, raw SQL via `pg` |
| Database | PostgreSQL 17 |
| Auth | bcryptjs + JWT |
| AI | Claude (`claude-opus-5`), server-side only |
| Hosting | Railway — database and app in one project |

In production a single Express process serves both `/api/*` and the built React
app, so there is one URL and no CORS.

## Updating the data

`docs/deliverables/` holds the approved Phase 2 files and is the source of
truth; `data/*.json` is generated from them and committed.

```bash
python3 scripts/convert_xlsx.py docs/deliverables   # → data/*.json
npm run db:seed                                     # → Postgres
```

The converter reports every value it could not parse instead of guessing. Both
scripts are idempotent — safe to re-run against a live database. A re-seed
preserves jobs posted through the company portal and any saved majors.

## Deploy to Railway

1. Push this repo to GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Add a **Postgres** service to the same project.
4. On the app service, set variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference, not a paste)
   - `JWT_SECRET` = `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-opus-5`, `DEMO_PASSWORD`
5. Deploy. `railway.json` migrates on boot and health-checks `/api/health`.
6. Run the seed once against production:
   `railway run npm run db:seed`

## Data provenance

Judges fact-check this platform, so every figure is traceable:

| Table | Carries |
|---|---|
| `majors` | `salary_source` (the cited references) and `salary_confidence` — the grade the salary sheet gave its own numbers |
| `university_majors` | `minimum_average` (floor to apply) and `competitive_average` (what the last admitted student scored). A NULL competitive average means **not published**, not "no bar" |
| `jobs` | `source` per listing, and `salary_is_estimate` — 33 of 176 salaries are market estimates, not employer figures |
| `courses` | `provider`, `cost_raw` (the original string) and `source_sheet` |
| `salary_references` | The `[R1]…[R18]` citations the salary figures point at |

Known gaps: Semiconductor Engineering has no salary band, and every job listing
says "Min GPA: Not stated", so the company GPA filter has nothing to match on.
See `CLAUDE.md` for the full list and the data quirks already handled.

## Project layout

```
db/schema.sql       schema (single source of truth)
server/             Express API + static host
  lib/chat.js       the advisor: prompt, grounding catalog, streaming
  routes/           auth, students, companies, recommend, chat, pathways
src/                React app
  components/       common/ui.jsx carries the wireframe design tokens
scripts/            convert_xlsx.py, migrate.mjs, seed.mjs, smoke.sh
data/               normalized JSON (committed, generated)
docs/deliverables/  the approved source files + wireframes PDF
```

`CLAUDE.md` is the project brief for anyone — human or agent — picking this up.
