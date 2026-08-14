import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

/**
 * The public home page — shown to anyone who isn't signed in yet (App.jsx's
 * Home only renders this when there's no user). There wasn't one before:
 * "/" just bounced straight to the student login form.
 *
 * Deliberately NOT DARBI's usual cyan/orange theme. This page recreates the
 * actual look of the design mockup it's built from (HP.html) — the
 * "engineering datasheet" system: IBM Plex Mono for every number, eyebrow
 * labels with a trailing rule, evidence chips with numbered badges, a faint
 * background grid. All of it is scoped under .hp-landing (see the <style>
 * block below) so none of it leaks into the rest of the app, which keeps
 * its own theme unchanged.
 *
 * The centerpiece — a real grounded answer typed out live, with its sources
 * attached as tappable-looking chips — mirrors that mockup's landing view,
 * but every number here is fetched from DARBI's actual seeded catalog (GET
 * /api/pathways/:slug, already public) rather than invented.
 */
const ROLES = [
  {
    role: 'student',
    title: "I'm a student",
    blurb: 'Chat with the advisor, build a pathway, track your own courses',
  },
  {
    role: 'company',
    title: "I'm hiring",
    blurb: 'Post a role, filter students by major, GPA, and skills',
  },
  {
    role: 'career',
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
    <div className="hp-landing">
      <style>{HP_CSS}</style>

      <header className="hp-topbar">
        <div className="hp-shell hp-row">
          <span className="hp-brand">
            <span className="hp-brand-mark">D</span>
            Darbi
          </span>
        </div>
      </header>

      <main className="hp-shell" style={{ paddingBlock: 34 }}>
        <div className="hp-grid-2">
          <section className="hp-stack-l">
            <div className="hp-stack">
              <span className="hp-eyebrow">JSYP 2026 · Team Sparks</span>
              <h1>Career advice you can check.</h1>
              <p className="hp-muted" style={{ maxWidth: '46ch' }}>
                Darbi grounds every major, salary, and job it names in verified Jordanian
                data — never a guess. Pick how you're using it.
              </p>
            </div>

            <div className="hp-stack" role="group" aria-label="Choose a portal">
              {ROLES.map((r) => (
                <Link key={r.role} to={`/portal/${r.role}`} className="hp-card">
                  <div className="hp-row">
                    <strong>{r.title}</strong>
                    <span className="hp-spacer" />
                    <span className="hp-mono hp-small hp-arrow">→</span>
                  </div>
                  <span className="hp-small hp-muted">{r.blurb}</span>
                </Link>
              ))}
            </div>

            {stats && (
              <p className="hp-small hp-muted hp-mono">
                <CountUp to={stats.majors} /> majors · <CountUp to={stats.courses} /> verified
                courses · <CountUp to={stats.jobs} /> verified job listings — every figure
                traced to a source.
              </p>
            )}
          </section>

          <section className="hp-card hp-panel-invert">
            <span className="hp-eyebrow">Career advice you can check</span>
            <div style={{ marginBlockStart: 14 }}>
              <div className="hp-msg-who">Darbi advisor</div>
              <Specimen data={specimen} />
            </div>
          </section>
        </div>
      </main>
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
      <p className="hp-mono hp-small" style={{ marginBlock: '8px 0', opacity: 0.5 }}>
        loading…
      </p>
    );
  }

  const chips = buildChips(data);

  return (
    <>
      <p style={{ margin: '8px 0 0', fontSize: 15.5, lineHeight: 1.6 }}>
        {typed}
        {!done && <span className="hp-caret" />}
      </p>

      {done && (
        <>
          <div className="hp-small hp-muted" style={{ marginBlockStart: 14 }}>
            Sources for this answer
          </div>
          <div className="hp-evidence">
            {chips.map((c, i) => (
              <span key={c.label} className="hp-chip" style={{ animationDelay: `${i * 120}ms` }}>
                <span className="hp-chip-idx">{i + 1}</span>
                {c.label}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** "400" when a band's min and max are the same figure, "400–600" otherwise. */
function range(band) {
  return band.min === band.max ? `${band.min}` : `${band.min}–${band.max}`;
}

function buildSentence({ major, salary, study }) {
  const uni = study.taught_at?.[0];
  let s = `${major.name} graduates in Jordan start at ${range(salary.entry)} JOD a month.`;
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
    { label: `${major.name} · entry ${range(salary.entry)} JOD/mo` },
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

  return <span>{n}</span>;
}

/**
 * Scoped recreation of HP.html's stylesheet — "Blueprint Night", the dark
 * variant of its theme system (its default is a light theme; DARBI is dark
 * everywhere else, so this is the one that doesn't jar against the rest of
 * the app when a visitor clicks through into a portal). Every selector is
 * nested under .hp-landing so nothing here can affect any other page.
 */
const HP_CSS = `
.hp-landing {
  --ink: #e6edf3; --ink-2: #9fb0c0; --ink-3: #6d8095;
  --paper: #0e141b; --surface: #17202a; --rule: #27343f; --rule-2: #1e2833;
  --trust: #3fd0a6; --trust-bg: #12302b; --caution: #f5b841; --on-ink: #0e141b;
  --r-sm: 3px; --r-md: 8px; --r-lg: 14px;
  --font-ui: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  min-height: 100vh;
  background-color: var(--paper);
  background-image:
    linear-gradient(var(--rule-2) 1px, transparent 1px),
    linear-gradient(90deg, var(--rule-2) 1px, transparent 1px);
  background-size: 28px 28px;
  color: var(--ink);
  font-family: var(--font-ui);
  line-height: 1.55;
  font-size: clamp(15px, 0.55vw + 13.6px, 16.5px);
}
.hp-landing .hp-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.hp-landing .hp-shell { max-width: 1180px; margin-inline: auto; padding-inline: 18px; }
.hp-landing .hp-topbar { padding: 16px 0; border-bottom: 1px solid var(--rule); }
.hp-landing .hp-brand { display: flex; align-items: center; gap: 9px; font-weight: 650; letter-spacing: -.02em; color: var(--ink); font-size: 16px; }
.hp-landing .hp-brand-mark {
  width: 26px; height: 26px; border-radius: 7px; background: var(--ink); color: var(--trust);
  display: grid; place-items: center; font-family: var(--font-mono); font-size: 15px; font-weight: 700; flex: none;
}
.hp-landing .hp-eyebrow {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--ink-3); display: flex; align-items: center; gap: 8px;
}
.hp-landing .hp-eyebrow::after { content: ""; flex: 1; height: 1px; background: var(--rule); }
.hp-landing h1 { margin: 0; font-weight: 600; letter-spacing: -0.015em; line-height: 1.15; font-size: clamp(28px, 3.2vw + 16px, 44px); }
.hp-landing p { margin: 0 0 12px; }
.hp-landing .hp-muted { color: var(--ink-2); }
.hp-landing .hp-small { font-size: 13px; }
.hp-landing .hp-stack { display: grid; gap: 12px; }
.hp-landing .hp-stack-l { display: grid; gap: 24px; }
.hp-landing .hp-row { display: flex; gap: 10px; align-items: center; }
.hp-landing .hp-spacer { flex: 1; }
.hp-landing .hp-grid-2 { display: grid; gap: 28px; grid-template-columns: 1fr; align-items: start; }
@media (min-width: 900px) { .hp-landing .hp-grid-2 { grid-template-columns: 1fr 1fr; } }

.hp-landing .hp-card {
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg);
  padding: 16px 18px; text-decoration: none; color: inherit; display: grid; gap: 4px;
  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
}
.hp-landing a.hp-card { min-block-size: 56px; }
.hp-landing a.hp-card:hover { border-color: var(--trust); transform: translateY(-2px); box-shadow: 0 10px 26px -16px rgba(63,208,166,.45); }
.hp-landing a.hp-card:focus-visible { outline: 2px solid var(--trust); outline-offset: 2px; }
.hp-landing .hp-card strong { font-size: 15.5px; }
.hp-landing .hp-arrow { color: var(--trust); transition: transform .15s ease; }
.hp-landing a.hp-card:hover .hp-arrow { transform: translateX(3px); }

.hp-landing .hp-panel-invert { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.hp-landing .hp-panel-invert .hp-eyebrow { color: #4c5b6e; }
.hp-landing .hp-panel-invert .hp-eyebrow::after { background: #2e3946; }
.hp-landing .hp-panel-invert .hp-muted { color: #5c6b7d; }
.hp-landing .hp-msg-who { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--trust); }

.hp-landing .hp-evidence { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: 12px; }
.hp-landing .hp-chip {
  display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px 6px 6px;
  border: 1px solid #2e3946; border-radius: 999px; background: #182129; color: var(--paper);
  color: #e6edf3; font-size: 12.5px;
  animation: hp-chip-in .32s cubic-bezier(.2,.8,.3,1) backwards;
}
.hp-landing .hp-chip-idx {
  font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; width: 22px; height: 22px;
  border-radius: 50%; background: var(--trust-bg); color: var(--trust); display: grid; place-items: center; flex: none;
}
.hp-landing .hp-caret { display: inline-block; width: 8px; height: 1.05em; background: var(--caution); vertical-align: -2px; animation: hp-blink .9s steps(2) infinite; }

@keyframes hp-chip-in { from { opacity: 0; transform: translateY(6px); } }
@keyframes hp-blink { 50% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .hp-landing *, .hp-landing *::before, .hp-landing *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}
`;
