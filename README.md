# DARBI 🎓

AI-powered career and job-matching platform for Jordanian engineering students.
JSYP 2026 Hackathon — Team Sparks.

Three portals on one login: **Student** (find your major), **Company** (find
talent), **Career Boost** (advance your career).

## Requirements

- Node 20+
- Docker (local Postgres only — Railway provides it in production)
- Python 3 (only to re-convert spreadsheets; stdlib only, nothing to install)

## Run it locally

```bash
npm install
cp .env.example .env      # then set ANTHROPIC_API_KEY
npm run db:up             # Postgres in Docker, host port 5434
npm run db:migrate        # create tables
npm run db:seed           # load data/*.json + demo accounts
npm run dev               # API :3000, web :5174
```

Open http://localhost:5174.

Demo logins (password `darbi2026`): `student@darbi.jo`, `company@darbi.jo`,
`career@darbi.jo`.

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

The spreadsheets are the source of truth; `data/*.json` is generated from them.

```bash
python3 scripts/convert_xlsx.py /path/to/xlsx-folder   # → data/*.json
npm run db:seed                                        # → Postgres
```

The converter reports every value it could not parse instead of guessing. Both
scripts are idempotent — safe to re-run against a live database.

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

Every course, job, and training centre carries the source it was gathered from.
Salary and university datasets are **not yet populated** — those fields are
`NULL` with `data_quality = 'pending'` rather than estimated. See `CLAUDE.md`
for the full gap list.

## Project layout

```
db/schema.sql   schema (single source of truth)
server/         Express API + static host
src/            React app
scripts/        convert_xlsx.py, migrate.mjs, seed.mjs
data/           normalized JSON (committed)
docs/           design PDF, sprint plan, submission docs
```
