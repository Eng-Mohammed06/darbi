import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Wisps, PURPLE, GOLD, ThemeLangSwitcher } from '../components/common/ui.jsx';
import { useLang } from '../i18n/index.jsx';
import darbiLogoIcon from '../assets/darbi-logo-icon.png';

/**
 * Public "sources and methodology" page — the single highest-value addition
 * flagged in the 17 Aug edit-list review, given how hard the homepage leans
 * on "verified Jordanian data" with nowhere to actually check that claim.
 *
 * The four source files, their owners, and what each contributes are exactly
 * what CLAUDE.md documents as the approved Phase 2 deliverable set — nothing
 * here is invented; the catalog counts are fetched live from the same public
 * endpoints the landing page uses, so this page can never drift out of sync
 * with what's actually seeded.
 */
export default function AboutDataPage() {
  const { t, lang } = useLang();
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    Promise.all([
      api('/majors', { auth: false }),
      api('/universities', { auth: false }),
      api('/jobs', { auth: false }),
      api('/courses', { auth: false }),
    ])
      .then(([majors, universities, jobs, courses]) => {
        setCounts({
          majors: majors.length,
          universities: universities.length,
          jobs: jobs.length,
          courses: courses.length,
          withSalary: majors.filter((m) => m.salary_entry_min_jod != null).length,
          estimatedJobs: jobs.filter((j) => j.salary_is_estimate).length,
        });
      })
      .catch(() => {});
  }, []);

  const c = t('aboutData');

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      <Wisps palette={[PURPLE, GOLD]} opacity={0.28} fixed />

      <header
        className="text-white relative z-10"
        style={{ background: 'color-mix(in srgb, var(--darbi-bg) 85%, transparent)', borderBottom: '1px solid var(--darbi-border)' }}
      >
        <div className="darbi-container py-5 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src={darbiLogoIcon} alt="" className="h-8 w-auto" />
            <span className="text-xl font-extrabold text-white tracking-tight">Darbi</span>
          </Link>
          <h1 className="text-lg font-bold flex-1">{c.title}</h1>
          <ThemeLangSwitcher dark />
        </div>
      </header>

      <main className="darbi-container py-10 relative z-10">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-gray-300">{c.intro}</p>

          {counts && (
            <div className="darbi-box">
              <p className="text-sm text-gray-300">
                {c.liveCounts(counts.majors, counts.universities, counts.courses, counts.jobs)}
              </p>
            </div>
          )}

          <section className="darbi-box">
            <h2 className="text-lg font-bold text-darbi-navy mb-3">{c.sourcesTitle}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-xs uppercase tracking-wide text-gray-500" style={{ borderBottom: '1px solid var(--darbi-border)' }}>
                    <th className="pb-2 pe-4 font-semibold">{c.fileHeader}</th>
                    <th className="pb-2 pe-4 font-semibold">{c.ownerHeader}</th>
                    <th className="pb-2 font-semibold">{c.givesHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.sources.map((row) => (
                    <tr key={row.file} style={{ borderBottom: '1px solid var(--darbi-border)' }}>
                      <td className="py-2.5 pe-4 font-mono text-xs text-gray-300 whitespace-nowrap">{row.file}</td>
                      <td className="py-2.5 pe-4 text-gray-400 whitespace-nowrap">{row.owner}</td>
                      <td className="py-2.5 text-gray-300">{row.gives}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="darbi-box">
            <h2 className="text-lg font-bold text-darbi-navy mb-2">{c.qualityTitle}</h2>
            <p className="text-sm text-gray-300 mb-3">{c.qualityBody}</p>
            <ul className="text-sm text-gray-300 space-y-2 list-none ps-0">
              <li>• {c.qualityMinVsCompetitive}</li>
              <li>• {c.qualityEstimate}</li>
              <li>• {c.qualityNotStated}</li>
              <li>• {c.qualityDataQuality}</li>
            </ul>
          </section>

          <section className="darbi-box">
            <h2 className="text-lg font-bold text-darbi-navy mb-2">{c.disclosureTitle}</h2>
            <p className="text-sm text-gray-300">{c.disclosureBody}</p>
          </section>

          <p className="text-xs text-gray-500 text-center">
            {c.dataUseNote}
          </p>
        </div>
      </main>
    </div>
  );
}
