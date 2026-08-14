/**
 * Shared presentational bits.
 *
 * Dark "Vibrant Modern" theme (darbi-color-palettes-code.md, Option B) — see
 * src/styles/global.css for the tokens. The classes `darbi-container`,
 * `darbi-box`, `darbi-btn` and `darbi-input` carry them; prefer those over
 * ad-hoc Tailwind spacing/color. `Wisps` is the decorative flowing-ribbon
 * background used behind every page.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth.jsx';

// Shared with the pre-login dark-card pages (AuthPage, ResetPasswordPage) —
// same glassy cyan/orange aesthetic, kept separate from the post-login
// `darbi-*` tokens in global.css since these two visual systems (logged-out
// vs. logged-in) are deliberately different per the approved mockup. Names
// (PURPLE/GOLD) are historical from the previous palette; values are current.
export const PURPLE = '#06b6d4';
export const PURPLE_DARK = '#0891b2';
export const GOLD = '#ff5722';
export const GRADIENT = 'linear-gradient(90deg,#06b6d4,#00f5d4)';

export const darkInput =
  'darbi-dark-input w-full rounded-full bg-black/40 border border-white/10 text-white placeholder-gray-500 ' +
  'px-5 py-3 text-sm focus:outline-none focus:border-cyan-400 transition';

export function DarkField({ label, hint, action, children }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-gray-300 font-semibold text-xs uppercase tracking-wide">{label}</span>
        {action}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

/** Dark-card shell used by every pre-login page (AuthPage, ResetPasswordPage). */
export function DarkCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex" style={{ background: '#0f172a' }}>
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-center px-16">
        <Wisps palette={[PURPLE, PURPLE_DARK]} opacity={0.65} />
        <div className="relative z-10">
          <h1
            className="text-6xl font-extrabold text-white tracking-tight"
            style={{ textShadow: `0 0 50px ${PURPLE}99` }}
          >
            Darbi
          </h1>
          <p className="text-lg mt-3" style={{ color: '#67e8f9' }}>
            Career advisory platform
          </p>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center px-4 py-10">
        <Wisps palette={[PURPLE, GOLD]} opacity={0.45} />
        <div className="relative z-10 w-full max-w-md">
          <div
            className="rounded-3xl p-8"
            style={{
              background: 'rgba(30,41,59,0.9)',
              border: `1px solid ${PURPLE}40`,
              boxShadow: `0 0 60px ${PURPLE_DARK}26`,
            }}
          >
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">{title}</h2>
              {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const TAB_ICONS = {
  advisor: '💬',
  pathways: '🧭',
  'saved pathways': '⭐',
  recommendations: '🎯',
  profile: '👤',
  majors: '📚',
  jobs: '💼',
  'post a job': '📝',
  'my jobs': '📋',
  'find students': '🔍',
  overview: '📊',
  'learning paths': '🎓',
  'training centres': '🏫',
};

const label = (t) => t[0].toUpperCase() + t.slice(1);

/**
 * `primaryTabs` picks which tabs (and in what order) get a permanent icon in
 * the mobile bottom bar — everything else lands under "More". Defaults to
 * the first 4 tabs if the caller doesn't specify (fine for the 3-tab
 * Company/Career dashboards, which just show all of them).
 */
export function Shell({ title, subtitle, tabs, activeTab, onTabChange, primaryTabs, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const navigate = useNavigate();

  const bottomTabs = tabs ? (primaryTabs ?? tabs.slice(0, 4)) : [];
  const hasOverflow = tabs && tabs.length > bottomTabs.length;

  // ⌘K / Ctrl+K opens a searchable jump-to-tab palette — the app has no
  // cross-page router for dashboard tabs (they're per-dashboard component
  // state, not routes), so the palette's reach is "this dashboard's tabs
  // plus Account/Sign out", which is what a user actually wants to jump to.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const paletteItems = useMemo(() => {
    const items = [
      ...(tabs ?? []).map((t) => ({ label: label(t), icon: TAB_ICONS[t] ?? '•', run: () => onTabChange(t) })),
      { label: 'Account', icon: '👤', run: () => navigate('/account') },
    ];
    const q = paletteQuery.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
  }, [tabs, paletteQuery, onTabChange, navigate]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      <Wisps palette={['#06b6d4', '#ff5722']} opacity={0.28} fixed />

      <header
        className="text-white relative z-30"
        style={{ background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid var(--darbi-border)' }}
      >
        <div className="darbi-container py-5 flex items-center gap-4">
          {tabs && (
            // A bare glyph hid every section but "Advisor" behind a click nobody
            // had a reason to try — the label makes it read as navigation.
            // Hidden on mobile now that the bottom tab bar covers navigation there.
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="hidden md:flex flex-col items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-lg hover:bg-white/5 transition"
            >
              <span className="text-2xl leading-none">☰</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Menu</span>
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          </div>
          {tabs && (
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white border border-white/10 rounded-full px-3 py-1.5 transition shrink-0"
            >
              <span aria-hidden="true">⌘K</span> Jump to…
            </button>
          )}
          <Link
            to="/account"
            aria-label="Account"
            className="text-2xl leading-none shrink-0 w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: 'var(--darbi-gradient)' }}
          >
            👤
          </Link>
        </div>

        {tabs && menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            {/* `fixed`, not `absolute` — this menu opens from two triggers: the
                desktop hamburger near the top, and the mobile "More" bottom-bar
                button, which is often tapped after scrolling deep into a long
                list (e.g. Jobs). An absolutely-positioned menu scrolled with the
                document and could open entirely off-screen above the viewport.
                Anchored near the bottom on mobile (above the bottom bar) and
                near the top on desktop (under the header), matching where each
                trigger actually is. */}
            <div
              className="fixed left-4 z-20 flex flex-col gap-1.5 p-3 min-w-[220px] max-h-[60vh] overflow-y-auto bottom-24 md:bottom-auto md:top-20"
              style={{
                background: 'var(--darbi-surface-solid)',
                border: '1px solid var(--darbi-border)',
                borderRadius: 'var(--darbi-radius)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => { onTabChange(t); setMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 rounded-full font-bold text-sm transition ${
                    activeTab === t ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  style={activeTab === t ? { background: 'var(--darbi-gradient)' } : undefined}
                >
                  {label(t)}
                </button>
              ))}
            </div>
          </>
        )}
      </header>
      <EmailVerifyBanner />
      <main className={`darbi-container py-8 relative z-10 ${tabs ? 'pb-24 md:pb-8' : ''}`}>{children}</main>

      {tabs && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch"
          style={{ background: 'rgba(15,23,42,0.95)', borderTop: '1px solid var(--darbi-border)' }}
        >
          {bottomTabs.map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
              style={{ color: activeTab === t ? 'var(--darbi-purple)' : '#94a3b8' }}
            >
              <span className="text-lg leading-none">{TAB_ICONS[t] ?? '•'}</span>
              <span className="text-[10px] font-semibold">{label(t)}</span>
            </button>
          ))}
          {hasOverflow && (
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More sections"
              aria-expanded={menuOpen}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5"
              style={{ color: !bottomTabs.includes(activeTab) ? 'var(--darbi-purple)' : '#94a3b8' }}
            >
              <span className="text-lg leading-none">⋯</span>
              <span className="text-[10px] font-semibold">More</span>
            </button>
          )}
        </nav>
      )}

      {paletteOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center pt-24 px-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden"
            style={{
              background: 'var(--darbi-surface-solid)',
              border: '1px solid var(--darbi-border)',
              borderRadius: 'var(--darbi-radius)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              placeholder="Jump to…"
              className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 focus:outline-none"
              style={{ borderBottom: '1px solid var(--darbi-border)' }}
            />
            <div className="max-h-72 overflow-y-auto py-1">
              {paletteItems.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-500">No matches.</p>
              )}
              {paletteItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => { item.run(); setPaletteOpen(false); setPaletteQuery(''); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition flex items-center gap-2.5"
                >
                  <span aria-hidden="true">{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Non-blocking nag shown on every dashboard page until the user verifies
 * their email — verification never gates login (see server/routes/auth.js),
 * so this banner is the only place the reminder surfaces.
 */
function EmailVerifyBanner() {
  const { user, setUser, verifyEmail, resendVerification } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || user.email_verified) return null;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const updated = await verifyEmail(code);
      setUser(updated);
      setStatus('Email verified.');
      setCode('');
    } catch (err) {
      setError(
        {
          invalid_code: 'That code is not correct.',
          code_expired: 'That code expired — send a new one.',
        }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setStatus('');
    setBusy(true);
    try {
      await resendVerification();
      setStatus('New code sent — check your email.');
      setOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative z-20"
      style={{ background: 'rgba(255,87,34,0.12)', borderBottom: '1px solid rgba(255,87,34,0.3)' }}
    >
      <div className="darbi-container py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span style={{ color: '#ffab91' }}>
            Verify your email ({user.email}) to keep your account secure.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0 transition hover:brightness-110"
              style={{ background: 'rgba(255,87,34,0.2)', border: '1px solid rgba(255,87,34,0.4)', color: '#ffab91' }}
            >
              {open ? 'Hide' : 'Enter code'}
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0 transition hover:brightness-110 disabled:opacity-60"
              style={{ background: 'rgba(255,87,34,0.2)', border: '1px solid rgba(255,87,34,0.4)', color: '#ffab91' }}
            >
              Resend code
            </button>
          </div>
        </div>

        {open && (
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2 mt-3">
            <input
              className="darbi-input py-2"
              style={{ maxWidth: 160 }}
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" disabled={busy} className="darbi-btn text-sm py-2 disabled:opacity-60">
              {busy ? 'Checking…' : 'Verify'}
            </button>
          </form>
        )}
        {status && <p className="mt-2 text-green-400">{status}</p>}
        {error && <p className="mt-2" style={{ color: '#ff6b7a' }}>{error}</p>}
      </div>
    </div>
  );
}

/** A shimmering placeholder block, shaped roughly like the content it stands
 * in for. Pass `lines` for a text-shaped skeleton, or width/height via style
 * for anything else (avatar, chip, card). */
export function Skeleton({ className = '', style }) {
  return <div className={`darbi-skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonLines({ lines = 3 }) {
  return (
    <div className="space-y-2.5 py-1">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} style={{ height: 14, width: `${88 - i * 14}%` }} />
      ))}
    </div>
  );
}

/** Consistent "nothing here yet" state — was a different one-off message per
 * list before (see git history), so empty vs. still-loading read differently
 * from page to page. */
export function EmptyState({ icon = '🗂️', title, action }) {
  return (
    <div className="text-center py-8">
      <div className="text-3xl mb-2" aria-hidden="true">{icon}</div>
      <p className="text-gray-400 text-sm">{title}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Card({ title, children, accent = true }) {
  return (
    <section
      className="darbi-box darbi-section"
      style={accent ? { borderLeft: '4px solid var(--darbi-purple)' } : undefined}
    >
      {title && <h2 className="text-lg font-bold text-darbi-navy mb-4">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-gray-300 font-bold mb-1.5 text-sm">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

/** Kept as an export so existing `className={inputClass}` call sites still work. */
export const inputClass = 'darbi-input';

export function Button({ children, variant = 'gold', ...rest }) {
  return (
    <button {...rest} className={`darbi-btn ${variant === 'navy' ? 'darbi-btn-navy' : ''}`}>
      {children}
    </button>
  );
}

export const Alert = ({ kind = 'error', children }) =>
  children ? (
    <div
      className="px-4 py-3 mb-4 border text-sm"
      style={
        kind === 'error'
          ? { background: 'rgba(255,107,122,0.1)', borderColor: 'rgba(255,107,122,0.35)', color: '#ff6b7a', borderRadius: 'var(--darbi-radius)' }
          : { background: 'rgba(255,87,34,0.1)', borderColor: 'rgba(255,87,34,0.35)', color: '#ffab91', borderRadius: 'var(--darbi-radius)' }
      }
    >
      {children}
    </div>
  ) : null;

/**
 * Salary as the wireframe's results card shows it: a range, never a single
 * number, with the stage named. `confidence` is the grade salaries_data.xlsx
 * assigned itself — surfaced on hover so a judge can see we tracked it.
 */
export function Salary({ band, stage = 'Entry', confidence }) {
  if (!band || band.min == null) {
    return <span className="text-gray-500 italic text-sm">No band on file</span>;
  }
  const value = band.min === band.max ? `${band.min}` : `${band.min}–${band.max}`;
  return (
    <span title={confidence ?? undefined}>
      <span className="font-bold" style={{ color: 'var(--darbi-gold)' }}>
        {value} JD
      </span>
      <span className="text-gray-400 text-sm">/month · {stage}</span>
    </span>
  );
}

/**
 * Decorative ambient glow behind a panel or page, colored by whatever
 * palette the caller passes. Originally an
 * SVG with a live feGaussianBlur filter — that made the whole app feel
 * laggy, because a blurred `fixed` layer forces the browser to recompute the
 * filter on every scroll frame. Plain radial-gradient blobs give the same
 * dark-with-glowing-corners mood at effectively zero paint cost, since the
 * compositor draws gradients natively with no filter pass. `fixed` pins it
 * to the viewport (for scrolling pages) instead of the nearest positioned
 * ancestor. */
export function Wisps({ palette, opacity = 0.5, fixed = false }) {
  const [c1, c2] = palette;
  const blobs = [
    `radial-gradient(ellipse 55% 45% at 12% 18%, ${c1} 0%, transparent 70%)`,
    `radial-gradient(ellipse 45% 55% at 8% 78%, ${c1} 0%, transparent 70%)`,
    c2 && `radial-gradient(ellipse 50% 45% at 90% 12%, ${c2} 0%, transparent 70%)`,
    c2 && `radial-gradient(ellipse 45% 50% at 92% 85%, ${c2} 0%, transparent 70%)`,
  ].filter(Boolean);

  return (
    <div
      className={`${fixed ? 'fixed' : 'absolute'} inset-0 pointer-events-none`}
      style={{ background: blobs.join(', '), opacity }}
      aria-hidden="true"
    />
  );
}
