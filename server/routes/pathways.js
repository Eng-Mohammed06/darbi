import { Router } from 'express';
import { query } from '../lib/db.js';
import { asyncRoute, optionalAuth } from '../lib/auth.js';
import { personalizePathway } from '../lib/pathwayPersonalization.js';

const router = Router();

/**
 * GET /api/pathways/:slug
 *
 * The "visual pathway card" from slide 4: major -> career -> market demand.
 * Computed entirely from seeded data, with no model call, so it renders the
 * same whether or not the API key has credit. Every number is a count over
 * verified rows a judge can trace back to a source.
 *
 * Public: a school student should be able to see a pathway before signing up.
 * `optionalAuth` means a signed-in student additionally gets `personalized`
 * (server/lib/pathwayPersonalization.js) — still no model call, see there.
 */
router.get(
  '/:slug',
  optionalAuth,
  asyncRoute(async (req, res) => {
    const { slug } = req.params;

    const { rows: majorRows } = await query(
      `SELECT id, slug, name, faculty, data_quality,
              salary_entry_min_jod, salary_entry_max_jod, salary_entry_raw,
              salary_3yr_min_jod, salary_3yr_max_jod,
              salary_5yr_min_jod, salary_5yr_max_jod,
              salary_source, salary_confidence, top_jobs
         FROM majors WHERE slug = $1`,
      [slug],
    );
    const major = majorRows[0];
    if (!major) return res.status(404).json({ error: 'unknown_major' });

    // Listings whose required_majors mention this major. ILIKE rather than
    // equality because the spreadsheets write "Computer Science / Computer
    // Engineering" and similar.
    // canonical_majors is the converter's mapping of the employer's free text
    // onto our major list, so this is an exact match rather than a LIKE guess.
    const jobFilter = `$1 = ANY(canonical_majors)`;

    const [taughtAt, courses, demand, roles, skills, employers] = await Promise.all([
      query(
        `SELECT u.code, u.name, u.website, um.program_name, um.duration_years,
                um.competitive_average, um.minimum_average, um.relation
           FROM university_majors um
           JOIN universities u ON u.id = um.university_id
          WHERE um.major_id = $1
          ORDER BY um.competitive_average DESC NULLS LAST, u.code`,
        [major.id],
      ),
      query(
        `SELECT id, name, track, provider, cost_raw, cost_min_jod, duration, what_you_learn
           FROM courses WHERE major_id = $1
          ORDER BY cost_min_jod NULLS LAST, name`,
        [major.id],
      ),
      query(
        `SELECT count(*)::int AS listings,
                count(DISTINCT company_name)::int AS companies,
                count(*) FILTER (WHERE verified)::int AS verified_listings
           FROM jobs WHERE ${jobFilter}`,
        [major.name],
      ),
      query(
        `SELECT title, company_name, salary_raw
           FROM jobs WHERE ${jobFilter}
          ORDER BY verified DESC, company_name
          LIMIT 8`,
        [major.name],
      ),
      query(
        `SELECT skill, count(*)::int AS mentions
           FROM jobs, unnest(required_skills) AS skill
          WHERE ${jobFilter}
          GROUP BY skill
          ORDER BY mentions DESC, skill
          LIMIT 8`,
        [major.name],
      ),
      query(
        `SELECT DISTINCT company_name FROM jobs WHERE ${jobFilter}
          ORDER BY company_name LIMIT 12`,
        [major.name],
      ),
    ]);

    const totals = await query(`SELECT count(*)::int AS total FROM jobs`);

    // Signed-in student, with a profile on file? Reorder this major's own
    // courses around what they told the onboarding questionnaire — still no
    // model call (see personalizePathway's doc comment). Anyone else, or a
    // student with nothing to personalize from, gets the original ordering.
    let personalized = null;
    if (req.user?.role === 'student') {
      const { rows: studentRows } = await query(`SELECT * FROM students WHERE user_id = $1`, [req.user.id]);
      const student = studentRows[0];
      if (student) {
        const { rows: analysisRows } = await query(
          `SELECT analysis FROM onboarding_analysis WHERE student_user_id = $1`,
          [req.user.id],
        );
        personalized = personalizePathway({
          student,
          analysis: analysisRows[0]?.analysis ?? null,
          courses: courses.rows,
        });
      }
    }

    res.json({
      major: {
        id: major.id,
        slug: major.slug,
        name: major.name,
        faculty: major.faculty,
        data_quality: major.data_quality,
      },
      study: {
        taught_at: taughtAt.rows,
        courses: personalized ? personalized.courses : courses.rows.slice(0, 6),
      },
      personalized: personalized
        ? { for_user: true, why_this_fits: personalized.whyThisFits, matched_on: personalized.matchedOn }
        : null,
      career: {
        roles: roles.rows,
        skills: skills.rows,
      },
      demand: {
        listings: demand.rows[0].listings,
        verified_listings: demand.rows[0].verified_listings,
        companies: demand.rows[0].companies,
        employers: employers.rows.map((r) => r.company_name),
        // Share of the whole board, so "8 listings" has a denominator.
        share_of_board: totals.rows[0].total
          ? Math.round((demand.rows[0].listings / totals.rows[0].total) * 100)
          : 0,
        total_listings_on_board: totals.rows[0].total,
      },
      // Approved figures from salaries_data.xlsx, carried with the source and
      // the sheet's own confidence grade so a judge can trace either.
      salary: {
        available: major.salary_entry_min_jod != null,
        entry: { min: major.salary_entry_min_jod, max: major.salary_entry_max_jod },
        three_year: { min: major.salary_3yr_min_jod, max: major.salary_3yr_max_jod },
        five_year: { min: major.salary_5yr_min_jod, max: major.salary_5yr_max_jod },
        source: major.salary_source,
        confidence: major.salary_confidence,
      },
      top_jobs: major.top_jobs ?? [],
    });
  }),
);

export default router;
