-- DARBI schema (PostgreSQL)
-- Applied by: npm run db:migrate   (scripts/migrate.mjs)
-- Safe to re-run: every statement is IF NOT EXISTS.
--
-- Shape follows the approved Phase 2 deliverables (docs/deliverables). Where a
-- figure came from a spreadsheet, the row keeps both the parsed number and the
-- original string, plus the source the file cited — judges fact-check this.

-- ---------------------------------------------------------------- accounts --
-- One row per login. `role` drives which portal the user lands in.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,          -- always stored lowercased
  username      TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'company', 'career')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 'admin' is a single account auto-provisioned at server boot from
-- ADMIN_EMAIL/ADMIN_PASSWORD (server/index.js) -- never created via the
-- public POST /api/auth/signup (server/routes/auth.js's ROLES array still
-- only lists student/company/career), and has no role-specific profile
-- table of its own (server/routes/auth.js's loadProfile returns null for it).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'company', 'career', 'admin'));

-- Added after the initial launch, so a database created before this line
-- needs it bolted on; existing rows get a generated handle since none of
-- them collected one at signup.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
UPDATE users SET username = split_part(email, '@', 1) || '-' || id::text
  WHERE username IS NULL;

-- Email verification (post-signup) and password reset both use a short-lived
-- 6-digit code emailed to the address on file, rather than a link token.
-- `email_verified` gates nothing (soft reminder only, not a login block) so
-- existing sessions and the demo accounts are unaffected.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMPTZ;

-- Profile picture, stored as a data: URI (base64 PNG/JPEG) directly in the
-- row rather than an external object store -- there's no S3/Cloudinary
-- configured for this deploy, and server/routes/auth.js caps the decoded
-- size, so a TEXT column is the simplest thing that actually works here.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Dual-role admin access: an existing student/company/career account can be
-- granted admin capability without changing its base `role` (which still
-- decides its normal portal). The original 'admin' role value is unchanged
-- and still means "pure admin, no other portal" (the one account
-- auto-provisioned from ADMIN_EMAIL/ADMIN_PASSWORD). `is_admin` is the new,
-- separate flag for everyone else — a role='student' row with is_admin=true
-- is asked at login which portal to enter (server/routes/auth.js,
-- src/pages/AuthPage.jsx). requireAdmin (server/lib/auth.js) checks this
-- column fresh on every request rather than trusting a JWT claim, so
-- granting or revoking access takes effect immediately, not after the
-- token's 7-day expiry.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Surfaced in the admin panel's per-user detail view ("time of login").
-- Written by server/routes/auth.js's /login handler on every successful
-- login; NULL until a user's first login after this column existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Display name for the pure-admin account only. Every other role stores its
-- name on its own profile table (students.name, companies.name,
-- career_profiles.name) -- admin has no such table, so its name lives
-- directly here instead (server/routes/auth.js's loadProfile/PUT /auth/name).
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

CREATE TABLE IF NOT EXISTS students (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  level         TEXT CHECK (level IN ('highschool', 'undergraduate', 'graduate')),
  interests     TEXT[] NOT NULL DEFAULT '{}',
  gpa           NUMERIC(3, 2) CHECK (gpa >= 0 AND gpa <= 4),
  -- Tawjihi percentage, for the school-student journey. Distinct from `gpa`,
  -- which is a university GPA out of 4.
  tawjihi_average NUMERIC(5, 2) CHECK (tawjihi_average >= 0 AND tawjihi_average <= 100),
  location      TEXT,
  salary_pref   TEXT
);

-- Some Jordanian universities grade out of 100 rather than the standard 4.0
-- scale, so `gpa` alone is ambiguous -- `gpa_scale` says which one a value
-- was entered in. NUMERIC(3,2) could only ever hold up to 9.99, so it's
-- widened to match tawjihi_average's range; the DROP+ADD is how you change a
-- CHECK constraint's bound in place, and is safe to re-run.
ALTER TABLE students ALTER COLUMN gpa TYPE NUMERIC(5, 2);
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_gpa_check;
ALTER TABLE students ADD CONSTRAINT students_gpa_check CHECK (gpa >= 0 AND gpa <= 100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS gpa_scale TEXT CHECK (gpa_scale IN ('4', '100'));

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

-- "My CV" tab (src/pages/CareerDashboard.jsx): a few more profile fields
-- a graduate can fill in after signup, plus the actual CV file. Stored as a
-- data: URI directly in the row, same rationale as users.avatar -- no
-- object store configured for this deploy, and server/routes/career.js caps
-- the decoded size.
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS university TEXT;
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS year_graduated INTEGER;
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS cv TEXT;
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS cv_filename TEXT;
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS cv_uploaded_at TIMESTAMPTZ;

-- Certificates/Projects/Experience are each a small list of structured
-- entries (a few short fields apiece) rather than one flat value, so they're
-- JSONB arrays instead of more columns -- no separate table + FK needed for
-- something this simple, and the whole list is always read/written together
-- from the Profile tab. `career_goals` (declared with the original table
-- above) already covers "Career interests" and needed no new column.
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS certificates JSONB NOT NULL DEFAULT '[]';
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS projects JSONB NOT NULL DEFAULT '[]';
ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS experience JSONB NOT NULL DEFAULT '[]';

-- ------------------------------------------------------- reference catalog --
CREATE TABLE IF NOT EXISTS universities (
  id             SERIAL PRIMARY KEY,
  code           TEXT UNIQUE,                  -- UJ, JUST, GJU, HU, BAU, PSUT
  name           TEXT NOT NULL,
  name_in_source TEXT,                         -- verbatim, incl. the JUST typo
  city           TEXT,
  website        TEXT,
  website_source TEXT,
  source_files   TEXT[] NOT NULL DEFAULT '{}',
  programs_note  TEXT
);

-- Salary figures come from salaries_data.xlsx, which grades its own confidence
-- per major; `data_quality` mirrors that grade and `salary_confidence` keeps
-- the sheet's full wording. `salary_source` is the citation to show a judge.
CREATE TABLE IF NOT EXISTS majors (
  id                   SERIAL PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  faculty              TEXT,
  duration_years       NUMERIC(2, 1),
  entry_requirements   TEXT,
  top_jobs             TEXT[] NOT NULL DEFAULT '{}',
  salary_entry_min_jod INTEGER,
  salary_entry_max_jod INTEGER,
  salary_entry_raw     TEXT,
  salary_3yr_min_jod   INTEGER,
  salary_3yr_max_jod   INTEGER,
  salary_3yr_raw       TEXT,
  salary_5yr_min_jod   INTEGER,
  salary_5yr_max_jod   INTEGER,
  salary_5yr_raw       TEXT,
  salary_source        TEXT,
  salary_confidence    TEXT,
  data_quality         TEXT NOT NULL DEFAULT 'pending'
                       CHECK (data_quality IN ('high', 'medium', 'low', 'pending'))
);

-- An undergraduate already knows their university and major by the time
-- they sign up (ProfileSetupPage.jsx) -- unlike a high schooler, who is
-- still choosing. Lets the dashboard skip the "explore majors" tabs for
-- them and go straight to their own courses and jobs. Added here, not next
-- to the rest of the `students` table above, because both referenced tables
-- (universities, majors) have to exist first.
ALTER TABLE students ADD COLUMN IF NOT EXISTS university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS major_id INTEGER REFERENCES majors(id) ON DELETE SET NULL;

-- One row per degree programme an institution offers. The averages are Tawjihi
-- admission percentages: `minimum_average` is the floor to apply,
-- `competitive_average` is what the last admitted student actually scored.
-- competitive_average is NULL where the source recorded N/A — that is "not
-- published", not "no requirement".
CREATE TABLE IF NOT EXISTS university_majors (
  university_id       INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  major_id            INTEGER NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  program_name        TEXT,                    -- as the university lists it
  faculty             TEXT,
  duration_years      INTEGER,
  parallel_average    NUMERIC(5, 2),
  competitive_average NUMERIC(5, 2),
  minimum_average     NUMERIC(5, 2),
  relation            TEXT NOT NULL DEFAULT 'offers_degree'
                      CHECK (relation IN ('provides_courses', 'offers_degree')),
  evidence            TEXT,
  PRIMARY KEY (university_id, major_id, program_name)
);

-- Which admission cycle `competitive_average`/`minimum_average` apply to —
-- these thresholds move year to year, and the admin panel edits them per
-- row rather than keeping a full history. NULL means "not specified".
ALTER TABLE university_majors ADD COLUMN IF NOT EXISTS entry_year INTEGER;

CREATE TABLE IF NOT EXISTS courses (
  id                 SERIAL PRIMARY KEY,
  major_id           INTEGER REFERENCES majors(id) ON DELETE SET NULL,
  major_name         TEXT,                     -- null for cross-cutting courses
  track              TEXT,
  name               TEXT NOT NULL,
  what_you_learn     TEXT,
  provider           TEXT,
  accreditation      TEXT,
  online_alternative TEXT,
  duration           TEXT,
  cost_raw           TEXT,
  cost_min_jod       INTEGER,
  cost_max_jod       INTEGER,
  cost_online_usd    TEXT,
  notes              TEXT,
  source_sheet       TEXT NOT NULL
);

-- Per-student course status: 'completed' is the only one the checkbox in the
-- Majors tab sets directly; 'in_progress'/'planned' are inferred by the chat
-- advisor from what the student says (server/lib/chat.js) and shown as
-- read-only badges next to the course.
CREATE TABLE IF NOT EXISTS course_progress (
  student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('completed', 'in_progress', 'planned')),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_user_id, course_id)
);

CREATE TABLE IF NOT EXISTS career_paths (
  id             SERIAL PRIMARY KEY,
  major_id       INTEGER REFERENCES majors(id) ON DELETE SET NULL,
  major_name     TEXT,
  name           TEXT NOT NULL,
  focus          TEXT,
  typical_roles  TEXT,
  tools          TEXT,
  skills         TEXT,
  coursera       TEXT,
  udemy          TEXT,
  jordan_centers TEXT,
  source_sheet   TEXT
);

CREATE TABLE IF NOT EXISTS training_centers (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  field        TEXT,
  location     TEXT,
  specialty    TEXT,
  notes        TEXT,
  website      TEXT,
  source_sheet TEXT
);

CREATE TABLE IF NOT EXISTS online_platforms (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  best_for     TEXT,
  pricing      TEXT,
  notes        TEXT,
  source_sheet TEXT
);

-- Fresh-graduate pay by role family, from the Jobs workbook's second tab.
-- Broader than `majors.salary_*`, which is per-major.
CREATE TABLE IF NOT EXISTS salary_benchmarks (
  id          SERIAL PRIMARY KEY,
  role_family TEXT NOT NULL,
  range_raw   TEXT,
  min_jod     INTEGER,
  max_jod     INTEGER,
  source      TEXT
);

-- The [R1]…[Rn] citations that majors.salary_source points at.
CREATE TABLE IF NOT EXISTS salary_references (
  id        TEXT PRIMARY KEY,
  source    TEXT NOT NULL,
  role      TEXT,
  provided  TEXT,
  link      TEXT
);

-- ---------------------------------------------------------------- job board --
-- Seeded rows have company_id NULL (gathered listings, no account behind them).
-- Rows posted through the company portal carry company_id.
CREATE TABLE IF NOT EXISTS jobs (
  id                 SERIAL PRIMARY KEY,
  company_id         INTEGER REFERENCES companies(user_id) ON DELETE CASCADE,
  company_name       TEXT NOT NULL,
  title              TEXT NOT NULL,
  required_majors    TEXT[] NOT NULL DEFAULT '{}',   -- as the employer wrote them
  canonical_majors   TEXT[] NOT NULL DEFAULT '{}',   -- mapped onto our major list
  min_gpa            NUMERIC(3, 2),
  min_gpa_raw        TEXT,
  salary_raw         TEXT,
  salary_min_jod     INTEGER,
  salary_max_jod     INTEGER,
  salary_is_estimate BOOLEAN NOT NULL DEFAULT false,
  required_skills    TEXT[] NOT NULL DEFAULT '{}',
  location           TEXT,
  description        TEXT,
  source             TEXT,
  verified           BOOLEAN NOT NULL DEFAULT false,
  posted_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_majors (
  student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  major_id        INTEGER NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_user_id, major_id)
);

-- A student's application to a posted job. Only meaningful for jobs a real
-- company account owns (jobs.company_id NOT NULL) — the seeded "verified"
-- listings gathered from public sources have no company account behind
-- them, so the API refuses an apply there rather than recording one that
-- could never reach anyone.
CREATE TABLE IF NOT EXISTS job_applications (
  id              SERIAL PRIMARY KEY,
  job_id          INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_job     ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_student ON job_applications(student_user_id);

-- The advisor conversation. Persisted so a refresh (or a laptop swap between
-- presenters) doesn't lose the thread mid-demo.
CREATE TABLE IF NOT EXISTS chat_messages (
  id              SERIAL PRIMARY KEY,
  student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The Graduate Portal's own AI Assistant conversation (server/lib/careerChat.js,
-- server/routes/career.js) -- kept as its own table rather than reusing
-- chat_messages so the student advisor (server/lib/chat.js) never has to
-- change to accommodate a second, differently-scoped kind of conversation.
CREATE TABLE IF NOT EXISTS career_chat_messages (
  id              SERIAL PRIMARY KEY,
  career_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- The Graduate Portal's Career Path tab (server/lib/careerLadder.js) —
-- same cache-by-profile-hash pattern as recommendations above, just scoped
-- to a graduate's major/current role/skills/experience instead of a
-- student's interests.
CREATE TABLE IF NOT EXISTS career_ladders (
  id              SERIAL PRIMARY KEY,
  career_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_hash    TEXT NOT NULL,
  payload         JSONB NOT NULL,
  model           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The post-signup onboarding questionnaire, plus Claude's structured read on
-- it. One row per student — re-answering overwrites it. The chat advisor
-- folds `analysis` into its system prompt so a conversation starts already
-- knowing what onboarding surfaced. `source` is 'fallback' when Claude was
-- unavailable at analysis time, in which case `analysis` holds the student's
-- own words rather than an inferred summary — never a guess presented as one.
CREATE TABLE IF NOT EXISTS onboarding_analysis (
  student_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers         JSONB NOT NULL,
  analysis        JSONB NOT NULL,
  model           TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'claude' CHECK (source IN ('claude', 'fallback')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_major   ON courses(major_id);
CREATE INDEX IF NOT EXISTS idx_paths_major     ON career_paths(major_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company    ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_majors     ON jobs USING GIN (canonical_majors);
CREATE INDEX IF NOT EXISTS idx_students_gpa    ON students(gpa);
CREATE INDEX IF NOT EXISTS idx_recs_student    ON recommendations(student_user_id, profile_hash);
CREATE INDEX IF NOT EXISTS idx_chat_student    ON chat_messages(student_user_id, created_at);
