-- DARBI schema (PostgreSQL)
-- Applied by: npm run db:migrate   (scripts/migrate.mjs)
-- Safe to re-run: every statement is IF NOT EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------- accounts --
-- One row per login. `role` drives which portal the user lands in.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,          -- always stored lowercased
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'company', 'career')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  level         TEXT CHECK (level IN ('highschool', 'undergraduate', 'graduate')),
  interests     TEXT[] NOT NULL DEFAULT '{}',
  gpa           NUMERIC(3, 2) CHECK (gpa >= 0 AND gpa <= 4),
  location      TEXT,
  salary_pref   TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  industry      TEXT,
  website       TEXT
);

CREATE TABLE IF NOT EXISTS career_profiles (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  current_title     TEXT,
  years_experience  INTEGER CHECK (years_experience >= 0),
  major             TEXT,
  skills            TEXT[] NOT NULL DEFAULT '{}',
  career_goals      TEXT[] NOT NULL DEFAULT '{}'
);

-- ------------------------------------------------------- reference catalog --
-- Extracted from the spreadsheets rather than hand-entered: `source_files`
-- records which files mention the institution, `website_source` which file the
-- domain came from. Every field is traceable when a judge asks.
CREATE TABLE IF NOT EXISTS universities (
  id             SERIAL PRIMARY KEY,
  code           TEXT UNIQUE,                  -- JUST, UJ, GJU, PSUT, HTU, LTUC
  name           TEXT NOT NULL,
  city           TEXT,                         -- null: no source file states it
  website        TEXT,
  website_source TEXT,
  source_files   TEXT[] NOT NULL DEFAULT '{}',
  programs_note  TEXT                          -- verbatim degree text, where stated
);

-- Salary columns are intentionally nullable: the salary dataset was a Week-1
-- deliverable that did not land. `data_quality` records why. Never populate
-- these with estimates — judges fact-check against the cited source.
CREATE TABLE IF NOT EXISTS majors (
  id                 SERIAL PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  faculty            TEXT,
  duration_years     NUMERIC(2, 1),
  entry_requirements TEXT,
  salary_entry_jod   INTEGER,
  salary_3yr_jod     INTEGER,
  salary_5yr_jod     INTEGER,
  salary_source      TEXT,
  top_jobs           TEXT[] NOT NULL DEFAULT '{}',
  data_quality       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (data_quality IN ('high', 'medium', 'low', 'pending'))
);

-- `relation` is deliberately narrow. The spreadsheets prove an institution
-- *teaches courses* in a subject; they do not prove it grants a degree in it.
-- Don't upgrade a row to 'offers_degree' without a source that says so.
CREATE TABLE IF NOT EXISTS university_majors (
  university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  major_id      INTEGER NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  relation      TEXT NOT NULL DEFAULT 'provides_courses'
                CHECK (relation IN ('provides_courses', 'offers_degree')),
  course_count  INTEGER NOT NULL DEFAULT 0,
  evidence      TEXT,                          -- the provider string it came from
  PRIMARY KEY (university_id, major_id)
);

-- cost_raw preserves the original spreadsheet string ("250-350", "Contact
-- academy"); cost_min/max are parsed only when unambiguous.
CREATE TABLE IF NOT EXISTS courses (
  id             SERIAL PRIMARY KEY,
  major_id       INTEGER REFERENCES majors(id) ON DELETE SET NULL,
  major_name     TEXT NOT NULL,
  sub_field      TEXT,
  name           TEXT NOT NULL,
  provider       TEXT,
  accreditation  TEXT,
  cost_raw       TEXT,
  cost_min_jod   INTEGER,
  cost_max_jod   INTEGER,
  duration       TEXT,
  qualifications TEXT,
  notes          TEXT,
  source_file    TEXT NOT NULL
);

-- Career-track reference data (Coursera / Udemy / accredited Jordan centres).
CREATE TABLE IF NOT EXISTS career_paths (
  id              SERIAL PRIMARY KEY,
  track           TEXT NOT NULL,               -- sheet name it came from
  title           TEXT NOT NULL,
  skills          TEXT,
  coursera        TEXT,
  udemy           TEXT,
  jordan_centers  TEXT
);

CREATE TABLE IF NOT EXISTS training_centers (
  id          SERIAL PRIMARY KEY,
  field       TEXT,
  name        TEXT NOT NULL,
  study_type  TEXT,
  details     TEXT,
  contact     TEXT
);

-- ---------------------------------------------------------------- job board --
-- Seeded rows have company_id NULL (scraped listings, no account behind them).
-- Rows posted through the company portal carry company_id.
CREATE TABLE IF NOT EXISTS jobs (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER REFERENCES companies(user_id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL,
  title           TEXT NOT NULL,
  required_majors TEXT[] NOT NULL DEFAULT '{}',
  min_gpa         NUMERIC(3, 2),
  salary_raw      TEXT,
  salary_min_jod  INTEGER,
  salary_max_jod  INTEGER,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  location        TEXT,
  description     TEXT,
  source          TEXT,
  verified        BOOLEAN NOT NULL DEFAULT false,
  posted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_majors (
  student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  major_id        INTEGER NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_user_id, major_id)
);

-- Claude responses are cached so a repeat dashboard visit costs nothing and the
-- demo still works if the API is unreachable mid-presentation.
CREATE TABLE IF NOT EXISTS recommendations (
  id              SERIAL PRIMARY KEY,
  student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_hash    TEXT NOT NULL,
  payload         JSONB NOT NULL,
  model           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_major       ON courses(major_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company        ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_majors         ON jobs USING GIN (required_majors);
CREATE INDEX IF NOT EXISTS idx_students_gpa        ON students(gpa);
CREATE INDEX IF NOT EXISTS idx_recs_student        ON recommendations(student_user_id, profile_hash);
