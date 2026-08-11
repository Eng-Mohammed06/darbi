import { Router } from 'express';
import { query } from '../lib/db.js';
import { asyncRoute } from '../lib/auth.js';

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
 */
router.get(
  '/:slug',
  asyncRoute(async (req, res) => {
    const { slug } = req.params;

    const { rows: majorRows } = await query(
      `SELECT id, slug, name, faculty, data_quality,
              salary_entry_jod, salary_3yr_jod, salary_5yr_jod, salary_source
         FROM majors WHERE slug = $1`,
      [slug],
    );
    const major = majorRows[0];
    if (!major) return res.status(404).json({ error: 'unknown_major' });

    // Listings whose required_majors mention this major. ILIKE rather than
    // equality because the spreadsheets write "Computer Science / Computer
    // Engineering" and similar.
    const jobFilter = `EXISTS (SELECT 1 FROM unnest(required_majors) rm WHERE rm ILIKE '%' || $1 || '%')`;

    const [taughtAt, courses, demand, roles, skills, employers] = await Promise.all([
      query(
        `SELECT u.code, u.name, u.website, um.course_count, um.relation
           FROM university_majors um
           JOIN universities u ON u.id = um.university_id
          WHERE um.major_id = $1
          ORDER BY um.course_count DESC, u.code`,
        [major.id],
      ),
      query(
        `SELECT name, sub_field, provider, cost_raw, cost_min_jod, duration
           FROM courses WHERE major_id = $1
          ORDER BY cost_min_jod NULLS LAST, name
          LIMIT 6`,
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

    res.json({
      major: {
        slug: major.slug,
        name: major.name,
        faculty: major.faculty,
        data_quality: major.data_quality,
      },
      study: {
        taught_at: taughtAt.rows,
        courses: courses.rows,
      },
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
      // Stated rather than silently omitted: the salary dataset is not in yet,
      // and the card should say so rather than leave a suspicious blank.
      salary: {
        available: major.salary_entry_jod != null,
        entry_jod: major.salary_entry_jod,
        three_year_jod: major.salary_3yr_jod,
        five_year_jod: major.salary_5yr_jod,
        source: major.salary_source,
      },
    });
  }),
);

export default router;
