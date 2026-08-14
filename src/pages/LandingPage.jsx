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
 * HP.html itself ships seven named colour themes and a full English/Arabic
 * toggle (with RTL layout) — this page carries the same two switches,
 * using HP.html's exact token values, scoped and persisted to this page
 * alone (localStorage keys below) so flipping them here never touches the
 * rest of DARBI's UI.
 *
 * The centerpiece — a real grounded answer typed out live, with its sources
 * attached as tappable-looking chips — mirrors that mockup's landing view,
 * but every number here is fetched from DARBI's actual seeded catalog (GET
 * /api/pathways/:slug, already public) rather than invented.
 */

const THEME_KEY = 'darbi.hpTheme';
const LANG_KEY = 'darbi.hpLang';

// Exact token values from HP.html's seven data-theme blocks.
const THEMES = [
  { id: 'blueprint', en: 'Blueprint Night', ar: 'مخطط ليلي', vars: {
    ink: '#e6edf3', ink2: '#9fb0c0', ink3: '#6d8095', paper: '#0e141b', surface: '#17202a',
    rule: '#27343f', rule2: '#1e2833', trust: '#3fd0a6', trustBg: '#12302b', caution: '#f5b841', onInk: '#0e141b',
  } },
  { id: 'limestone', en: 'Limestone & Pine', ar: 'حجر جيري', vars: {
    ink: '#101418', ink2: '#565d66', ink3: '#878e97', paper: '#efece5', surface: '#ffffff',
    rule: '#d9d4c7', rule2: '#e8e4da', trust: '#0f6b57', trustBg: '#e2efea', caution: '#e0a21a', onInk: '#ffffff',
  } },
  { id: 'aqaba', en: 'Aqaba', ar: 'العقبة', vars: {
    ink: '#101a1d', ink2: '#4f6167', ink3: '#86979d', paper: '#e9eff0', surface: '#ffffff',
    rule: '#cbd8da', rule2: '#dfe8e9', trust: '#0a6b78', trustBg: '#dbeef0', caution: '#d99a12', onInk: '#ffffff',
  } },
  { id: 'cobalt', en: 'Signal Cobalt', ar: 'كوبالت', vars: {
    ink: '#11151a', ink2: '#545c66', ink3: '#848d99', paper: '#eef0f3', surface: '#ffffff',
    rule: '#d4d8de', rule2: '#e5e8ec', trust: '#1f4ee0', trustBg: '#e4e9fd', caution: '#d98016', onInk: '#ffffff',
  } },
  { id: 'basalt', en: 'Basalt', ar: 'بازلت', vars: {
    ink: '#ece4da', ink2: '#a89c8e', ink3: '#7b7166', paper: '#16130f', surface: '#211c17',
    rule: '#372f27', rule2: '#262019', trust: '#58c295', trustBg: '#17352a', caution: '#e8a83c', onInk: '#16130f',
  } },
  { id: 'carbon', en: 'Carbon', ar: 'كربون', vars: {
    ink: '#f2f2f2', ink2: '#a3a3a3', ink3: '#737373', paper: '#000000', surface: '#0d0d0d',
    rule: '#2b2b2b', rule2: '#1a1a1a', trust: '#35d0a0', trustBg: '#0c2a21', caution: '#f0b429', onInk: '#000000',
  } },
  { id: 'paper', en: 'Paper', ar: 'ورق', vars: {
    ink: '#0a0a0a', ink2: '#3d3d3d', ink3: '#5c5c5c', paper: '#ffffff', surface: '#ffffff',
    rule: '#767676', rule2: '#b8b8b8', trust: '#00594a', trustBg: '#dbeee8', caution: '#8a5a00', onInk: '#ffffff',
  } },
];

// English major names as DARBI's API returns them → their standard Arabic
// names, for display only. Not a data source: DARBI's seeded catalog
// (data/majors.json) is English-only, so this is purely a UI label swap,
// same as translating any other fixed piece of interface copy.
const MAJOR_NAME_AR = {
  'Biomedical Engineering': 'الهندسة الطبية الحيوية',
  'Chemical Engineering': 'الهندسة الكيميائية',
  'Civil Engineering': 'الهندسة المدنية',
  'Computer Engineering': 'هندسة الحاسوب',
  'Computer Science': 'علوم الحاسوب',
  'Electrical Engineering': 'الهندسة الكهربائية',
  'Mechanical Engineering': 'الهندسة الميكانيكية',
  'Mechatronics Engineering': 'هندسة الميكاترونكس',
  'Semiconductor Engineering': 'هندسة أشباه الموصلات',
  'Software Engineering': 'هندسة البرمجيات',
};

const COPY = {
  en: {
    themeLabel: 'Theme',
    eyebrow: 'JSYP 2026 · Team Sparks',
    title: 'Career advice you can check.',
    sub: "Darbi grounds every major, salary, and job it names in verified Jordanian data — never a guess. Pick how you're using it.",
    portalGroup: 'Choose a portal',
    roles: [
      { role: 'student', title: "I'm a student", blurb: 'Chat with the advisor, build a pathway, track your own courses' },
      { role: 'company', title: "I'm hiring", blurb: 'Post a role, filter students by major, GPA, and skills' },
      { role: 'career', title: 'Career Boost', blurb: 'Close a named skill gap with courses that actually lead somewhere' },
    ],
    statsLabels: { majors: 'majors', courses: 'verified courses', jobs: 'verified job listings', trailing: 'every figure traced to a source.' },
    panelEyebrow: 'Career advice you can check',
    msgWho: 'Darbi advisor',
    sourcesLabel: 'Sources for this answer',
    loading: 'loading…',
  },
  ar: {
    themeLabel: 'المظهر',
    eyebrow: 'JSYP 2026 · فريق سباركس',
    title: 'إرشاد مهني يمكنك التحقق منه.',
    sub: 'منصة دربي تؤسس كل تخصص وراتب ووظيفة تذكرها على بيانات أردنية موثّقة — لا تخمين أبدًا. اختر طريقة استخدامك.',
    portalGroup: 'اختر بوابتك',
    roles: [
      { role: 'student', title: 'أنا طالب', blurb: 'تحدّث مع المستشار، ابنِ مسارًا مهنيًا، وتابع مقرراتك' },
      { role: 'company', title: 'أنا أوظّف', blurb: 'انشر وظيفة، وصفِّ الطلبة حسب التخصص والمعدل والمهارات' },
      { role: 'career', title: 'تطوير المهارات', blurb: 'أغلق فجوة مهارة محددة بمقررات تقودك فعليًا إلى هدفك' },
    ],
    statsLabels: { majors: 'تخصصًا', courses: 'مقررًا موثقًا', jobs: 'وظيفة موثقة', trailing: 'كل رقم هنا موثّق بمصدر.' },
    panelEyebrow: 'إرشاد مهني يمكنك التحقق منه',
    msgWho: 'مستشار دربي',
    sourcesLabel: 'مصادر هذه الإجابة',
    loading: 'جارٍ التحميل…',
  },
};

// Tried in a random order each load — whichever one actually has salary
// data and a job listing wins, so the specimen never shows a "—" instead
// of a number.
const SPECIMEN_SLUGS = [
  'computer-science', 'civil-engineering', 'mechanical-engineering',
  'electrical-engineering', 'chemical-engineering', 'biomedical-engineering',
];

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export default function LandingPage() {
  const [stats, setStats] = useState(null);
  const [specimen, setSpecimen] = useState(null);
  const [theme, setThemeState] = useState(() => readStored(THEME_KEY, 'blueprint'));
  const [lang, setLangState] = useState(() => readStored(LANG_KEY, 'en'));

  function setTheme(id) {
    setThemeState(id);
    try { localStorage.setItem(THEME_KEY, id); } catch { /* private browsing */ }
  }
  function toggleLang() {
    setLangState((prev) => {
      const next = prev === 'en' ? 'ar' : 'en';
      try { localStorage.setItem(LANG_KEY, next); } catch { /* private browsing */ }
      return next;
    });
  }

  const t = COPY[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

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
    <div className="hp-landing" data-theme={theme} dir={dir} lang={lang}>
      <style>{HP_CSS(THEMES)}</style>

      <header className="hp-topbar">
        <div className="hp-shell hp-row">
          <span className="hp-brand">
            <span className="hp-brand-mark">D</span>
            Darbi
          </span>
          <span className="hp-spacer" />
          <label className="hp-sr-only" htmlFor="hp-theme-sel">{t.themeLabel}</label>
          <select
            id="hp-theme-sel"
            className="hp-theme-sel"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            {THEMES.map((th) => (
              <option key={th.id} value={th.id}>{th[lang]}</option>
            ))}
          </select>
          <button type="button" className="hp-lang-btn" onClick={toggleLang}>
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </header>

      <main className="hp-shell" style={{ paddingBlock: 34 }}>
        <div className="hp-grid-2">
          <section className="hp-stack-l">
            <div className="hp-stack">
              <span className="hp-eyebrow">{t.eyebrow}</span>
              <h1>{t.title}</h1>
              <p className="hp-muted" style={{ maxWidth: '46ch' }}>{t.sub}</p>
            </div>

            <div className="hp-stack" role="group" aria-label={t.portalGroup}>
              {t.roles.map((r) => (
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
                <CountUp to={stats.majors} /> {t.statsLabels.majors} · <CountUp to={stats.courses} /> {t.statsLabels.courses} ·{' '}
                <CountUp to={stats.jobs} /> {t.statsLabels.jobs} — {t.statsLabels.trailing}
              </p>
            )}
          </section>

          <section className="hp-card hp-panel-invert">
            <span className="hp-eyebrow">{t.panelEyebrow}</span>
            <div style={{ marginBlockStart: 14 }}>
              <div className="hp-msg-who">{t.msgWho}</div>
              <Specimen key={lang} data={specimen} lang={lang} t={t} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/** Types the grounded answer out live, then reveals its evidence chips. */
function Specimen({ data, lang, t }) {
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const sentence = data ? buildSentence(data, lang) : '';
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
        {t.loading}
      </p>
    );
  }

  const chips = buildChips(data, lang);

  return (
    <>
      <p style={{ margin: '8px 0 0', fontSize: 15.5, lineHeight: 1.6 }}>
        {typed}
        {!done && <span className="hp-caret" />}
      </p>

      {done && (
        <>
          <div className="hp-small hp-muted" style={{ marginBlockStart: 14 }}>
            {t.sourcesLabel}
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

function majorName(major, lang) {
  return lang === 'ar' ? (MAJOR_NAME_AR[major.name] || major.name) : major.name;
}

function buildSentence({ major, salary, study }, lang) {
  const name = majorName(major, lang);
  const uni = study.taught_at?.[0];
  const r = range(salary.entry);

  if (lang === 'ar') {
    let s = `يبدأ راتب خريجي ${name} في الأردن من ${r} دينار أردني شهريًا.`;
    if (uni?.competitive_average != null) {
      s += ` قبلت ${uni.code} آخر دفعة بمعدل توجيهي ${uni.competitive_average}%.`;
    } else if (uni) {
      const rest = study.taught_at.length - 1;
      s += ` يُدرَّس في ${uni.code} و${rest} ${rest === 1 ? 'جامعة أردنية أخرى' : 'جامعات أردنية أخرى'}.`;
    }
    return s;
  }

  let s = `${name} graduates in Jordan start at ${r} JOD a month.`;
  if (uni?.competitive_average != null) {
    s += ` ${uni.code} admitted its last cohort at a ${uni.competitive_average}% Tawjihi average.`;
  } else if (uni) {
    s += ` It's taught at ${uni.code} and ${study.taught_at.length - 1} other Jordanian universit${study.taught_at.length === 2 ? 'y' : 'ies'}.`;
  }
  return s;
}

function buildChips({ major, salary, study, career }, lang) {
  const name = majorName(major, lang);
  const uni = study.taught_at?.[0];
  const role = career.roles?.[0];
  const r = range(salary.entry);

  if (lang === 'ar') {
    return [
      { label: `${name} · بداية ${r} دينار/شهريًا` },
      uni && { label: `${uni.code} · ${uni.competitive_average != null ? `معدل توجيهي ${uni.competitive_average}%` : 'المعدل غير منشور'}` },
      role && { label: `${role.title} · ${role.company_name}` },
    ].filter(Boolean);
  }

  return [
    { label: `${name} · entry ${r} JOD/mo` },
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
 * Scoped recreation of HP.html's stylesheet — "engineering datasheet"
 * design system, ported as CSS custom properties under .hp-landing so
 * nothing here can affect any other page. `data-theme` picks which of the
 * seven token sets (built from the THEMES list, exact HP.html hex values)
 * applies; `dir="rtl"` swaps the whole layout for Arabic using the same
 * logical-property approach HP.html uses, so one stylesheet serves both.
 */
function HP_CSS(themes) {
  const themeBlocks = themes
    .map(
      (th) => `
.hp-landing[data-theme="${th.id}"] {
  --ink: ${th.vars.ink}; --ink-2: ${th.vars.ink2}; --ink-3: ${th.vars.ink3};
  --paper: ${th.vars.paper}; --surface: ${th.vars.surface};
  --rule: ${th.vars.rule}; --rule-2: ${th.vars.rule2};
  --trust: ${th.vars.trust}; --trust-bg: ${th.vars.trustBg}; --caution: ${th.vars.caution}; --on-ink: ${th.vars.onInk};
}`,
    )
    .join('\n');

  return `
.hp-landing {
  --r-sm: 3px; --r-md: 8px; --r-lg: 14px;
  --font-ui: "IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  min-height: 100vh;
  background-color: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
  line-height: 1.55;
  font-size: clamp(15px, 0.55vw + 13.6px, 16.5px);
}
${themeBlocks}

/* Blueprint gets its namesake: a faint grid on the ground plane. Every
   other theme keeps a flat background, matching HP.html exactly. */
.hp-landing[data-theme="blueprint"] {
  background-image:
    linear-gradient(var(--rule-2) 1px, transparent 1px),
    linear-gradient(90deg, var(--rule-2) 1px, transparent 1px);
  background-size: 28px 28px;
}

.hp-landing[dir="rtl"] { font-size: clamp(16px, 0.55vw + 14.6px, 17.5px); line-height: 1.72; }
.hp-landing[dir="rtl"] .hp-arrow { transform: scaleX(-1); }

.hp-landing .hp-mono, .hp-landing .hp-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; unicode-bidi: isolate; }
.hp-landing .hp-shell { max-inline-size: 1180px; margin-inline: auto; padding-inline: 18px; }
.hp-landing .hp-topbar { padding: 16px 0; border-block-end: 1px solid var(--rule); }
.hp-landing .hp-brand { display: flex; align-items: center; gap: 9px; font-weight: 650; letter-spacing: -.02em; color: var(--ink); font-size: 16px; }
.hp-landing .hp-brand-mark {
  inline-size: 26px; block-size: 26px; border-radius: 7px; background: var(--ink); color: var(--trust);
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

.hp-landing .hp-sr-only {
  position: absolute; inline-size: 1px; block-size: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.hp-landing .hp-theme-sel {
  min-block-size: 38px; padding: 0 10px; font-size: 13px; font-family: var(--font-ui);
  border-radius: var(--r-md); background: transparent; color: var(--ink-2);
  border: 1px solid var(--rule); cursor: pointer;
}
@media (max-width: 560px) { .hp-landing .hp-theme-sel { display: none; } }
.hp-landing .hp-lang-btn {
  appearance: none; border: 1px solid var(--rule); background: transparent; color: var(--ink);
  font: inherit; font-size: 13px; font-weight: 550; padding: 0 14px; min-block-size: 38px;
  margin-inline-start: 8px; border-radius: var(--r-md); cursor: pointer;
}
.hp-landing .hp-lang-btn:hover { background: var(--surface); }

.hp-landing .hp-card {
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg);
  padding: 16px 18px; text-decoration: none; color: inherit; display: grid; gap: 4px;
  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
}
.hp-landing a.hp-card { min-block-size: 56px; }
.hp-landing a.hp-card:hover {
  border-color: var(--trust); transform: translateY(-2px);
  box-shadow: 0 10px 26px -16px color-mix(in srgb, var(--trust) 45%, transparent);
}
.hp-landing a.hp-card:focus-visible { outline: 2px solid var(--trust); outline-offset: 2px; }
.hp-landing .hp-card strong { font-size: 15.5px; }
.hp-landing .hp-arrow { color: var(--trust); display: inline-block; transition: transform .15s ease; }
.hp-landing a.hp-card:hover .hp-arrow { transform: translateX(3px); }
.hp-landing[dir="rtl"] a.hp-card:hover .hp-arrow { transform: scaleX(-1) translateX(3px); }

.hp-landing .hp-panel-invert { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.hp-landing .hp-panel-invert .hp-eyebrow { color: color-mix(in srgb, var(--paper) 55%, var(--ink)); }
.hp-landing .hp-panel-invert .hp-eyebrow::after { background: color-mix(in srgb, var(--paper) 30%, var(--ink)); }
.hp-landing .hp-panel-invert .hp-muted { color: color-mix(in srgb, var(--paper) 55%, var(--ink)); }
.hp-landing .hp-msg-who { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--trust); }

.hp-landing .hp-evidence { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: 12px; }
.hp-landing .hp-chip {
  display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px 6px 6px;
  border: 1px solid color-mix(in srgb, var(--paper) 20%, var(--ink));
  background: color-mix(in srgb, var(--paper) 10%, var(--ink));
  border-radius: 999px; color: var(--paper); font-size: 12.5px;
  animation: hp-chip-in .32s cubic-bezier(.2,.8,.3,1) backwards;
}
.hp-landing[dir="rtl"] .hp-chip { padding: 6px 6px 6px 10px; }
.hp-landing .hp-chip-idx {
  font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; inline-size: 22px; block-size: 22px;
  border-radius: 50%; background: var(--trust); color: var(--on-ink); display: grid; place-items: center; flex: none;
}
.hp-landing .hp-caret { display: inline-block; inline-size: 8px; block-size: 1.05em; background: var(--caution); vertical-align: -2px; animation: hp-blink .9s steps(2) infinite; }

@keyframes hp-chip-in { from { opacity: 0; transform: translateY(6px); } }
@keyframes hp-blink { 50% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .hp-landing *, .hp-landing *::before, .hp-landing *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}
`;
}
