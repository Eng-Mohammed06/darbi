import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useTheme } from '../services/theme.jsx';
import { useLang } from '../i18n/index.jsx';
import darbiLogoIcon from '../assets/darbi-logo-icon.png';

/**
 * The public home page — shown to anyone who isn't signed in yet (App.jsx's
 * Home only renders this when there's no user).
 *
 * Rebuilt to match Darbi-AI-Homepage-Design-Handoff.html — a single
 * continuous scroll (Hero → Features → Stats) on a shared ambient-glow
 * background, sticky header, a light "Darbi Advisor" example card, three
 * icon feature cards, and scroll-reveal + load-in animations. The handoff
 * doc specifies one fixed dark palette (near-black + teal); since this app
 * already carries an 8-theme switcher that applies everywhere (not just
 * this page — see src/services/theme.jsx), that palette became this exact
 * "Blueprint Night" theme's values instead of a hardcoded one-off, so the
 * new layout still works correctly under all 8 themes and the switcher
 * keeps doing something real. "Classic" (DARBI's original cyan/orange)
 * stays the site-wide default; switch to Blueprint Night to see the handoff
 * doc's look exactly.
 *
 * Theme and language are NOT page-local state — both read/write the same
 * global ThemeProvider/LanguageProvider every other page uses, so a change
 * made here is visible everywhere, including after logging in.
 *
 * The advisor card's centerpiece — a real grounded answer typed out live,
 * with its sources attached as numbered pill tags — pulls from DARBI's
 * actual seeded catalog (GET /api/pathways/:slug, already public) rather
 * than invented copy.
 */

// Exact token values for each theme. "blueprint" now matches the handoff
// doc's spec precisely (bg #0A0A0A, accent #1FBF8F, secondary text
// #9CA3AF); the other seven keep HP.html's original named palettes, plus
// DARBI's own original palette carried over as "classic".
const THEMES = [
  { id: 'classic', en: 'Classic', ar: 'كلاسيكي', vars: {
    ink: '#f8fafc', ink2: '#94a3b8', ink3: '#64748b', paper: '#0f172a', surface: '#1e293b',
    rule: 'rgba(6,182,212,0.25)', rule2: 'rgba(6,182,212,0.15)', trust: '#06b6d4', trustBg: 'rgba(6,182,212,0.15)', caution: '#ff5722', onInk: '#0f172a',
  } },
  { id: 'blueprint', en: 'Blueprint Night', ar: 'مخطط ليلي', vars: {
    ink: '#ffffff', ink2: '#9ca3af', ink3: '#6b7280', paper: '#0a0a0a', surface: '#111111',
    rule: 'rgba(255,255,255,0.08)', rule2: 'rgba(255,255,255,0.15)', trust: '#1fbf8f', trustBg: 'rgba(31,191,143,0.12)', caution: '#e8a33c', onInk: '#0a0a0a',
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

// Tried in a random order each load — whichever one actually has salary
// data and a job listing wins, so the specimen never shows a "—" instead
// of a number.
const SPECIMEN_SLUGS = [
  'computer-science', 'civil-engineering', 'mechanical-engineering',
  'electrical-engineering', 'chemical-engineering', 'biomedical-engineering',
];

// One thin-outline icon per feature card / stat, matching the handoff doc's
// "shield-check / chat-bubble / connected-nodes" set plus a small icon per
// stat. currentColor so each inherits its container's color per theme.
const ICONS = {
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="6" r="2.2" />
      <circle cx="19" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M6.8 7.6L11 16.4M17.2 7.6L13 16.4" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15z" />
      <path d="M4 20.5A2.5 2.5 0 016.5 18H20" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.3 2.3 4.7-4.8" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
};
const FEATURE_ICON_KEYS = ['shield', 'chat', 'network'];

// Each "Join Us" card: which role-label key (auth.role*) and which
// description key (landing.*) it pairs with, and which portal it links to.
const JOIN_CARDS = [
  { roleKey: 'Student', descKey: 'joinStudentDesc', href: '/portal/student' },
  { roleKey: 'Graduate', descKey: 'joinGraduateDesc', href: '/portal/career' },
  { roleKey: 'Company', descKey: 'joinCompanyDesc', href: '/portal/company' },
];

export default function LandingPage() {
  const [stats, setStats] = useState(null);
  const [specimen, setSpecimen] = useState(null);
  const { theme, setTheme } = useTheme();
  const { lang, dir, toggleLang, t } = useLang();

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

  const pillars = t('landing.pillars');
  const statsLabels = t('landing.statsLabels');

  return (
    <div className="hp-landing" data-theme={theme} dir={dir} lang={lang}>
      <style>{HP_CSS(THEMES)}</style>

      <div className="hp-glow hp-glow-a" aria-hidden="true" />
      <div className="hp-glow hp-glow-b" aria-hidden="true" />

      <header className="hp-topbar">
        <div className="hp-shell hp-row">
          <span className="hp-brand">
            <img src={darbiLogoIcon} alt="" className="hp-brand-mark" />
            Darbi
          </span>
          <nav className="hp-nav">
            <Link to="/portal/student">{t('landing.navStudent')}</Link>
            <Link to="/portal/company">{t('landing.navCompany')}</Link>
            <Link to="/portal/career">{t('landing.navCareer')}</Link>
          </nav>
          <span className="hp-spacer" />
          <label className="hp-theme-label" htmlFor="hp-theme-sel">{t('landing.themeLabel')}</label>
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

      <main className="hp-content">
        <section className="hp-hero hp-shell">
          <img src={darbiLogoIcon} alt="Darbi" className="hp-hero-mark" />
          <h1 className="hp-hero-title">{t('landing.title')}</h1>
          <p className="hp-hero-sub hp-muted">{t('landing.sub')}</p>

          <div className="hp-hero-card hp-panel-invert">
            <span className="hp-eyebrow">{t('landing.panelEyebrow')}</span>
            <div style={{ marginBlockStart: 14 }}>
              <div className="hp-msg-who">{t('landing.msgWho')}</div>
              <Specimen key={lang} data={specimen} lang={lang} t={t} />
            </div>
          </div>
        </section>

        <div className="hp-hairline" />

        <section className="hp-features hp-shell">
          {pillars.map((p, i) => (
            <Reveal key={p.title} className="hp-feature-card" delay={i * 100}>
              <div className="hp-feature-icon">{ICONS[FEATURE_ICON_KEYS[i]]}</div>
              <strong>{p.title}</strong>
              <p className="hp-small hp-muted">{p.body}</p>
            </Reveal>
          ))}
        </section>

        <section className="hp-join hp-shell">
          <h2 className="hp-join-title">{t('landing.joinTitle')}</h2>
          <div className="hp-join-cards">
            {JOIN_CARDS.map((c, i) => (
              <Reveal key={c.roleKey} className="hp-join-card" delay={i * 100}>
                <strong>{t(`auth.role${c.roleKey}`)}</strong>
                <p className="hp-small hp-muted">{t(`landing.${c.descKey}`)}</p>
                <Link to={c.href} className="hp-join-btn">{t('landing.joinCta')}</Link>
              </Reveal>
            ))}
          </div>
        </section>

        {stats && (
          <Reveal as="p" className="hp-stats-bar hp-shell hp-mono">
            <span className="hp-stat"><span className="hp-stat-icon">{ICONS.book}</span><CountUp to={stats.majors} /> {statsLabels.majors}</span>
            <span className="hp-dot" aria-hidden="true">·</span>
            <span className="hp-stat"><span className="hp-stat-icon">{ICONS.check}</span><CountUp to={stats.courses} /> {statsLabels.courses}</span>
            <span className="hp-dot" aria-hidden="true">·</span>
            <span className="hp-stat"><span className="hp-stat-icon">{ICONS.briefcase}</span><CountUp to={stats.jobs} /> {statsLabels.jobs}</span>
            <span className="hp-stats-trailing hp-muted">— {statsLabels.trailing}</span>
          </Reveal>
        )}
      </main>
    </div>
  );
}

/**
 * Wraps children in a fade-up transition that plays once, the first time
 * the element scrolls into view — not on every scroll pass. Used for the
 * Features cards (staggered via `delay`) and the Stats bar.
 * prefers-reduced-motion is handled globally (see the CSS block below),
 * not here.
 */
function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`hp-reveal ${visible ? 'hp-reveal-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
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
      i += 1;
      setTyped(sentence.slice(0, i));
      if (i >= sentence.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, 40);
    return () => clearInterval(timer);
  }, [sentence]);

  if (!data) {
    return (
      <p className="hp-mono hp-small" style={{ marginBlock: '8px 0', opacity: 0.5 }}>
        {t('landing.loading')}
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
            {t('landing.sourcesLabel')}
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
 * Scoped stylesheet for the landing page, ported as CSS custom properties
 * under .hp-landing so nothing here can affect any other page. `data-theme`
 * picks which of the eight token sets (built from the THEMES list above)
 * applies; `dir="rtl"` swaps the whole layout for Arabic via logical
 * properties, so one stylesheet serves both.
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
  position: relative;
  overflow: clip;
  --r-sm: 3px; --r-md: 8px; --r-lg: 14px; --r-xl: 20px;
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

.hp-landing[dir="rtl"] { font-size: clamp(16px, 0.55vw + 14.6px, 17.5px); line-height: 1.72; }
.hp-landing[dir="rtl"] .hp-arrow { transform: scaleX(-1); }

/* Ambient glow — two large, soft, blurred blobs spanning the whole page
   (not just the first viewport), continuous behind Hero + Features + Stats
   rather than reset per section. */
.hp-landing .hp-glow {
  position: absolute; inline-size: 640px; block-size: 900px; border-radius: 50%;
  filter: blur(120px); opacity: 0.22; pointer-events: none; z-index: 0;
}
.hp-landing .hp-glow-a { inset-inline-start: -220px; inset-block-start: -80px; background: var(--trust); }
.hp-landing .hp-glow-b { inset-inline-end: -220px; inset-block-start: 420px; background: var(--caution); }
.hp-landing .hp-topbar, .hp-landing .hp-content { position: relative; z-index: 1; }

.hp-landing .hp-mono, .hp-landing .hp-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; unicode-bidi: isolate; }
.hp-landing .hp-shell { max-inline-size: 1180px; margin-inline: auto; padding-inline: 18px; }
.hp-landing .hp-topbar {
  position: sticky; inset-block-start: 0; z-index: 40; padding: 16px 0;
  background: color-mix(in srgb, var(--paper) 82%, transparent);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-block-end: 1px solid var(--rule);
}
.hp-landing .hp-brand { display: flex; align-items: center; gap: 9px; font-weight: 650; letter-spacing: -.02em; color: var(--ink); font-size: 16px; }
.hp-landing .hp-brand-mark {
  inline-size: 30px; block-size: 30px; object-fit: contain; flex: none;
}
.hp-landing .hp-nav { display: flex; gap: 4px; margin-inline-start: 22px; }
.hp-landing .hp-nav a {
  padding: 8px 12px; border-radius: var(--r-md); text-decoration: none;
  color: var(--ink-2); font-size: 13.5px; font-weight: 500; transition: background .15s, color .15s;
}
.hp-landing .hp-nav a:hover { background: var(--surface); color: var(--ink); }

/* Below 720px there's no room for brand + 3 nav links + the theme/lang
   controls on one line — instead of hiding the nav (which left phone
   visitors with no way to reach a portal at all), drop it to its own
   full-width row: brand + controls stay on row one, the three portal
   links spread evenly across row two with bordered, thumb-sized targets. */
@media (max-width: 720px) {
  .hp-landing .hp-topbar .hp-row { flex-wrap: wrap; row-gap: 10px; }
  .hp-landing .hp-nav {
    order: 10;
    flex-basis: 100%;
    gap: 8px;
    margin-inline-start: 0;
  }
  .hp-landing .hp-nav a {
    flex: 1;
    text-align: center;
    padding-block: 12px;
    border: 1px solid var(--rule);
  }
}

.hp-landing .hp-eyebrow {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--ink-3); display: flex; align-items: center; gap: 8px;
}
.hp-landing .hp-eyebrow::after { content: ""; flex: 1; height: 1px; background: var(--rule); }
.hp-landing p { margin: 0 0 12px; }
.hp-landing .hp-muted { color: var(--ink-2); }
.hp-landing .hp-small { font-size: 13px; }
.hp-landing .hp-row { display: flex; gap: 10px; align-items: center; }
.hp-landing .hp-spacer { flex: 1; }

.hp-landing .hp-sr-only {
  position: absolute; inline-size: 1px; block-size: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.hp-landing .hp-theme-label {
  font-size: 13px; color: var(--ink-2); white-space: nowrap; margin-inline-end: 8px;
}
.hp-landing .hp-theme-sel {
  min-block-size: 38px; padding: 0 10px; font-size: 13px; font-family: var(--font-ui);
  border-radius: var(--r-md); background: transparent; color: var(--ink-2);
  border: 1px solid var(--rule); cursor: pointer;
}
@media (max-width: 560px) { .hp-landing .hp-theme-label, .hp-landing .hp-theme-sel { display: none; } }
.hp-landing .hp-lang-btn {
  appearance: none; border: 1px solid var(--rule); background: transparent; color: var(--ink);
  font: inherit; font-size: 13px; font-weight: 550; padding: 0 14px; min-block-size: 38px;
  margin-inline-start: 8px; border-radius: var(--r-md); cursor: pointer;
}
.hp-landing .hp-lang-btn:hover { background: var(--surface); }

/* ---------- Hero ---------- */
.hp-landing .hp-hero { padding-block: 72px 56px; text-align: center; display: grid; justify-items: center; gap: 18px; }
.hp-landing .hp-hero-mark { inline-size: 72px; block-size: 72px; object-fit: contain; margin-block-end: -6px; }
.hp-landing .hp-hero-title {
  margin: 0; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;
  font-size: clamp(26px, 3.4vw + 12px, 46px); max-inline-size: 26ch;
}
.hp-landing .hp-hero-sub { max-inline-size: 46ch; font-size: clamp(15px, .4vw + 14px, 17.5px); margin: 0; }
.hp-landing .hp-hero-card {
  margin-block-start: 28px; max-inline-size: 750px; inline-size: 100%; text-align: start;
  border-radius: var(--r-xl); padding: 26px 28px; box-shadow: 0 24px 60px -24px rgba(0,0,0,.5);
}

@keyframes hp-fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
@keyframes hp-card-in { from { opacity: 0; transform: translateY(20px) scale(.97); } to { opacity: 1; transform: none; } }
.hp-landing .hp-hero-mark { animation: hp-fade-up .55s ease-out both; }
.hp-landing .hp-hero-title { animation: hp-fade-up .55s ease-out both; }
.hp-landing .hp-hero-sub { animation: hp-fade-up .55s ease-out .15s both; }
.hp-landing .hp-hero-card { animation: hp-card-in .6s ease-out .32s both; }

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

/* ---------- Hairline between Hero and Features ---------- */
.hp-landing .hp-hairline { block-size: 1px; background: var(--rule); max-inline-size: 1180px; margin-inline: auto; }

/* ---------- Features ---------- */
.hp-landing .hp-features {
  display: grid; gap: 20px; padding-block: 56px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
.hp-landing .hp-feature-card {
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg);
  padding: 24px 22px; text-align: start;
}
.hp-landing .hp-feature-card strong { display: block; font-size: 16.5px; margin-block: 14px 8px; }
.hp-landing .hp-feature-icon {
  inline-size: 42px; block-size: 42px; border-radius: 50%;
  background: var(--trust-bg); color: var(--trust);
  display: grid; place-items: center;
}
.hp-landing .hp-feature-icon svg { inline-size: 20px; block-size: 20px; }

/* ---------- Join Us CTA ---------- */
.hp-landing .hp-join { padding-block: 8px 56px; text-align: center; }
.hp-landing .hp-join-title { margin: 0 0 22px; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
.hp-landing .hp-join-cards {
  display: grid; gap: 18px; text-align: start;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
.hp-landing .hp-join-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 12px;
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--r-lg);
  padding: 22px 22px 24px;
}
.hp-landing .hp-join-card strong { font-size: 16px; }
.hp-landing .hp-join-card p { margin: 0; flex: 1; }
.hp-landing .hp-join-btn {
  align-self: flex-start;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 22px; border-radius: var(--r-md);
  background: var(--trust); color: var(--on-ink); font-weight: 600; font-size: 14px;
  text-decoration: none; transition: transform .15s ease, box-shadow .15s ease;
}
.hp-landing .hp-join-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -12px var(--trust); }

/* ---------- Stats bar ---------- */
.hp-landing .hp-stats-bar {
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px;
  padding-block: 8px 64px; margin: 0; color: var(--ink-2); font-size: 13.5px; text-align: center;
}
.hp-landing .hp-stat { display: inline-flex; align-items: center; gap: 6px; }
.hp-landing .hp-stat-icon { display: inline-flex; color: var(--ink-3); }
.hp-landing .hp-stat-icon svg { inline-size: 15px; block-size: 15px; }
.hp-landing .hp-dot { color: var(--ink-3); }
.hp-landing .hp-stats-trailing { margin: 0; }

/* ---------- Scroll-reveal (Features cards, Stats bar) ---------- */
.hp-landing .hp-reveal { opacity: 0; transform: translateY(18px); transition: opacity .5s ease-out, transform .5s ease-out; }
.hp-landing .hp-reveal-in { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .hp-landing *, .hp-landing *::before, .hp-landing *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
  .hp-landing .hp-hero-mark, .hp-landing .hp-hero-title, .hp-landing .hp-hero-sub, .hp-landing .hp-hero-card { opacity: 1; transform: none; }
}
`;
}
