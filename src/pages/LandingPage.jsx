import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { Wisps, PURPLE, GOLD, GRADIENT } from '../components/common/ui.jsx';

/**
 * The public home page — shown to anyone who isn't signed in yet (App.jsx's
 * Home only renders this when there's no user). There wasn't one before:
 * "/" just bounced straight to the student login form, so a first-time
 * visitor never saw a pitch before being asked for a password.
 *
 * The centerpiece — a real grounded answer typed out live, with its sources
 * attached as tappable-looking chips — is adapted from a design mockup
 * (HP.html) built for this same idea, but every number here is fetched from
 * DARBI's actual seeded catalog (GET /api/pathways/:slug, already public and
 * already powering PathwayCard) rather than invented, and it's rebuilt in
 * DARBI's own cyan/orange theme rather than that mockup's separate "engineering
 * datasheet" system, since running two visual languages in one app reads as
 * broken, not as two options.
 */
const ROLES = [
  {
    role: 'student',
    icon: '🎓',
    title: "I'm a student",
    blurb: 'Chat with the advisor, build a pathway, track your own courses',
  },
  {
    role: 'company',
    icon: '🏢',
    title: "I'm hiring",
    blurb: 'Post a role, filter students by major, GPA, and skills',
  },
  {
    role: 'career',
    icon: '📈',
    title: 'Career Boost',
    blurb: 'Close a named skill gap with courses that actually lead somewhere',
  },
];

// Tried in a random order each load — whichever one actually has salary
// data and a job listing wins, so the specimen never shows a "—" instead
// of a number.
const SPECIMEN_SLUGS = [
  'computer-science', 'civil-engineering', 'mechanical-engineering',
  'electrical-engineering', 'chemical-engineering', 'biomedical-engineering',
];

export default function LandingPage() {
  const [stats, setStats] = useState(null);
  const [specimen, setSpecimen] = useState(null);

  useEffect(() => {
    Promise.all([api('/majors', { auth: false }), api('/jobs', { auth: false })])
      .then(([majors, jobs]) =>
        setStats({
          majors: majors.length,
          courses: majors.reduce((n, m) => n + m.course_count, 0),
          jobs: jobs.length,
        }),
      )
      .catch(() => {});

    let cancelled = false;
    (async () => {
      const order = [...SPECIMEN_SLUGS].sort(() => Math.random() - 0.5);
      for (const slug of order) {
        try {
          const data = await api(`/pathways/${slug}`, { auth: false });
          if (data.salary?.available && data.career?.roles?.length) {
            if (!cancelled) setSpecimen(data);
            return;
          }
        } catch {
          // try the next one
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0f172a' }}>
      <Wisps palette={[PURPLE, GOLD]} opacity={0.5} fixed />

      <div className="relative z-10 darbi-container py-10 md:py-16">
        <div className="flex items-center gap-2 mb-12 md:mb-16">
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg"
            style={{ background: GRADIENT, color: '#0f172a' }}
          >
            D
          </span>
          <span className="text-xl font-extrabold text-white tracking-tight">Darbi</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <section className="flex flex-col gap-8">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-4"
                style={{ color: '#67e8f9' }}
              >
                JSYP 2026 · Team Sparks
              </p>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Career advice you can{' '}
                <span
                  style={{
                    background: GRADIENT,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  actually check.
                </span>
              </h1>
              <p className="text-gray-400 text-lg mt-4 max-w-lg">
                Darbi grounds every major, salary, and job it names in verified Jordanian
                data — never a guess. Pick how you're using it.
              </p>
            </div>

            <div className="grid gap-3">
              {ROLES.map((r) => (
                <Link
                  key={r.role}
                  to={`/portal/${r.role}`}
                  className="group flex items-center gap-4 rounded-2xl p-4 transition"
                  style={{
                    background: 'rgba(30,41,59,0.7)',
                    border: `1px solid ${PURPLE}30`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${PURPLE}90`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 12px 30px -12px ${PURPLE}55`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${PURPLE}30`;
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span className="text-2xl shrink-0">{r.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-white">{r.title}</span>
                    <span className="block text-sm text-gray-400 mt-0.5">{r.blurb}</span>
                  </span>
                  <span
                    className="text-lg shrink-0 transition-transform group-hover:translate-x-1"
                    style={{ color: PURPLE }}
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>

            {stats && (
              <p className="text-sm text-gray-500 font-mono">
                <CountUp to={stats.majors} /> majors · <CountUp to={stats.courses} /> verified
                courses · <CountUp to={stats.jobs} /> verified job listings — every figure
                traced to a source.
              </p>
            )}
          </section>

          <section
            className="rounded-3xl p-7 lg:sticky lg:top-10"
            style={{
              background: 'rgba(15,23,42,0.9)',
              border: `1px solid ${PURPLE}40`,
              boxShadow: `0 0 60px ${PURPLE}1f`,
            }}
          >
            <p
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: GOLD }}
            >
              What the advisor actually gives you
            </p>
            <Specimen data={specimen} />
          </section>
        </div>
      </div>
    </div>
  );
}

/** Types the grounded answer out live, then reveals its evidence chips. */
function Specimen({ data }) {
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const sentence = data ? buildSentence(data) : '';
  const started = useRef(false);

  useEffect(() => {
    if (!sentence || started.current) return;
    started.current = true;
    let i = 0;
    const timer = setInterval(() => {
      i += 2;
      setTyped(sentence.slice(0, i));
      if (i >= sentence.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [sentence]);

  if (!data) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 rounded bg-white/10 w-full" />
        <div className="h-4 rounded bg-white/10 w-5/6" />
        <div className="h-4 rounded bg-white/10 w-2/3" />
      </div>
    );
  }

  const chips = buildChips(data);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ background: GRADIENT }}>
          💬
        </span>
        <span className="text-xs font-mono uppercase tracking-wide text-gray-500">Darbi advisor</span>
      </div>
      <p className="text-white text-[15.5px] leading-relaxed min-h-[4.5rem]">
        {typed}
        {!done && (
          <span
            className="inline-block w-2 align-middle ml-0.5"
            style={{ height: '1.1em', background: GOLD, animation: 'darbi-blink 0.9s steps(2) infinite' }}
          />
        )}
      </p>

      {done && (
        <>
          <p className="text-xs text-gray-500 mt-4 mb-2">Sources for this answer</p>
          <div className="flex flex-wrap gap-2">
            {chips.map((c, i) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full text-gray-200"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  animation: `darbi-chip-in 0.35s ease-out backwards`,
                  animationDelay: `${i * 120}ms`,
                }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background: 'var(--darbi-purple, #06b6d4)', color: '#0f172a' }}
                >
                  {i + 1}
                </span>
                {c.label}
              </span>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes darbi-blink { 50% { opacity: 0; } }
        @keyframes darbi-chip-in { from { opacity: 0; transform: translateY(6px); } }
      `}</style>
    </div>
  );
}

function buildSentence({ major, salary, study }) {
  const uni = study.taught_at?.[0];
  let s = `${major.name} graduates in Jordan start at ${salary.entry.min}–${salary.entry.max} JOD a month.`;
  if (uni?.competitive_average != null) {
    s += ` ${uni.code} admitted its last cohort at a ${uni.competitive_average}% Tawjihi average.`;
  } else if (uni) {
    s += ` It's taught at ${uni.code} and ${study.taught_at.length - 1} other Jordanian universit${study.taught_at.length === 2 ? 'y' : 'ies'}.`;
  }
  return s;
}

function buildChips({ major, salary, study, career }) {
  const uni = study.taught_at?.[0];
  const role = career.roles?.[0];
  return [
    { label: `${major.name} · entry ${salary.entry.min}–${salary.entry.max} JOD/mo` },
    uni && { label: `${uni.code} · ${uni.competitive_average != null ? `${uni.competitive_average}% Tawjihi` : 'average not published'}` },
    role && { label: `${role.title} · ${role.company_name}` },
  ].filter(Boolean);
}

/** Counts up from 0 to `to` once, the moment it first has a real number. */
function CountUp({ to }) {
  const [n, setN] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !to) return;
    started.current = true;
    const start = performance.now();
    const duration = 700;
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      setN(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [to]);

  return <span className="text-gray-300 font-semibold">{n}</span>;
}
