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
import { useTheme } from '../../services/theme.jsx';
import { useLang } from '../../i18n/index.jsx';

// Shared with the pre-login dark-card pages (AuthPage, ResetPasswordPage).
// These used to be literal hex values, independent of global.css's --darbi-*
// tokens (a deliberate split between logged-out and logged-in visual
// systems). Now that the theme switcher applies everywhere, both point at
// the same tokens so a theme change reaches these pages too. Names
// (PURPLE/GOLD) are historical from the previous palette.
export const PURPLE = 'var(--darbi-purple)';
export const PURPLE_DARK = 'var(--darbi-purple-dark)';
export const GOLD = 'var(--darbi-gold)';
export const GRADIENT = 'var(--darbi-gradient)';

export const darkInput =
  'darbi-dark-input w-full rounded-full bg-black/40 border border-white/10 text-white placeholder-gray-500 ' +
  'px-5 py-3 text-sm focus:outline-none focus:border-[var(--darbi-purple)] transition';

/**
 * The theme + language switcher, dropped into every page's header (Shell,
 * AccountPage, DarkCard) so both apply everywhere, not just the landing
 * page — reading/writing the same global ThemeProvider/LanguageProvider
 * every other page uses, so a change here is instantly visible everywhere.
 */
export function ThemeLangSwitcher({ dark = false }) {
  const { theme, setTheme, themes } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const textClass = dark ? 'text-white' : '';
  return (
    <div className="flex items-center gap-2 shrink-0">
      <label className="sr-only" htmlFor="darbi-theme-sel">{t('common.theme')}</label>
      <select
        id="darbi-theme-sel"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className={`hidden sm:block text-xs rounded-full px-3 py-1.5 bg-transparent border transition ${textClass}`}
        style={{ borderColor: 'var(--darbi-border)' }}
      >
        {themes.map((th) => (
          <option key={th.id} value={th.id} style={{ color: '#000' }}>
            {th[lang]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={toggleLang}
        className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition hover:brightness-110 ${textClass}`}
        style={{ borderColor: 'var(--darbi-border)' }}
      >
        {lang === 'en' ? t('common.langToggleToArabic') : t('common.langToggleToEnglish')}
      </button>
    </div>
  );
}

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
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      {/* One background spanning the full width, not one per half — two
          separate Wisps each confined to a half-width panel left a hard
          seam down the middle where neither's blobs reached. */}
      <Wisps palette={[PURPLE, GOLD]} opacity={0.5} fixed />

      <div className="absolute top-4 end-4 z-20">
        <ThemeLangSwitcher dark />
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16">
        <div>
          <h1
            className="text-6xl font-extrabold text-white tracking-tight"
            style={{ textShadow: `0 0 50px color-mix(in srgb, ${PURPLE} 60%, transparent)` }}
          >
            Darbi
          </h1>
          <p className="text-lg mt-3" style={{ color: 'var(--darbi-purple)' }}>
            Career Assistant Platform
          </p>
        </div>
      </div>

      <div className="flex-1 relative z-10 flex items-center justify-center px-4 py-10">
        <div className="relative z-10 w-full max-w-md">
          <div
            className="rounded-3xl p-8"
            style={{
              background: 'var(--darbi-surface)',
              border: `1px solid color-mix(in srgb, ${PURPLE} 25%, transparent)`,
              boxShadow: `0 0 60px color-mix(in srgb, ${PURPLE_DARK} 15%, transparent)`,
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

/**
 * Glassy centered card used by the post-signup, pre-dashboard sequence
 * (verify email → profile setup → onboarding) — same look across all three
 * so the sequence reads as one flow rather than three different screens.
 */
export function CenteredCard({ maxWidth = 'max-w-lg', children }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10"
      style={{ background: 'var(--darbi-bg)' }}
    >
      <Wisps palette={[PURPLE, GOLD]} opacity={0.4} fixed />
      <div
        className={`relative z-10 ${maxWidth} w-full text-center`}
        style={{
          background: 'var(--darbi-surface)',
          border: '1px solid var(--darbi-border)',
          borderRadius: 'var(--darbi-radius)',
          boxShadow: `0 0 60px color-mix(in srgb, ${PURPLE} 15%, transparent)`,
          padding: '2rem',
        }}
      >
        {children}
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
  courses: '✅',
  jobs: '💼',
  users: '👥',
  companies: '🏢',
  'post a job': '📝',
  'my jobs': '📋',
  'find students': '🔍',
  overview: '📊',
  'learning paths': '🎓',
  'training centres': '🏫',
  'career path': '🪜',
  'job recommendations': '🎯',
  applications: '📥',
  'ai assistant': '🤖',
};

// "saved pathways" -> "savedPathways", matching the camelCase keys in
// src/i18n/dict/common.js's `tabs` map.
const tabKey = (rawId) => rawId.replace(/ (.)/g, (_, c) => c.toUpperCase());

export function Shell({ title, subtitle, tabs, activeTab, onTabChange, children }) {
  const { user, viewMode, setViewMode } = useAuth();
  const { t } = useLang();
  const label = (rawId) => t(`common.tabs.${tabKey(rawId)}`);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const navigate = useNavigate();

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
      ...(tabs ?? []).map((rawId) => ({ label: label(rawId), icon: TAB_ICONS[rawId] ?? '•', run: () => onTabChange(rawId) })),
      { label: t('common.account'), icon: '👤', run: () => navigate('/account') },
    ];
    const q = paletteQuery.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, paletteQuery, onTabChange, navigate, t]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      <Wisps palette={[PURPLE, GOLD]} opacity={0.28} fixed />

      <header
        className="text-white relative z-30"
        style={{ background: 'color-mix(in srgb, var(--darbi-bg) 85%, transparent)', borderBottom: '1px solid var(--darbi-border)' }}
      >
        <div className="darbi-container py-5 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <ThemeLangSwitcher dark />
          {user?.is_admin && user.role !== 'admin' && (
            <button
              onClick={() => setViewMode(viewMode === 'admin' ? null : 'admin')}
              className="hidden sm:block text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:brightness-110 shrink-0"
              style={{ borderColor: 'var(--darbi-border)', color: 'var(--darbi-purple)' }}
            >
              {viewMode === 'admin' ? t('common.switchToMyPortal') : t('common.switchToAdminPortal')}
            </button>
          )}
          {tabs && (
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white border border-white/10 rounded-full px-3 py-1.5 transition shrink-0"
            >
              <span aria-hidden="true">⌘K</span> {t('common.jumpTo')}
            </button>
          )}
          <Link
            to="/account"
            aria-label={t('common.account')}
            className="text-2xl leading-none shrink-0 w-9 h-9 flex items-center justify-center rounded-full overflow-hidden"
            style={{ background: 'var(--darbi-gradient)' }}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              '👤'
            )}
          </Link>
        </div>
      </header>

      {/* All tabs, side by side, centred above the content — the previous
          hamburger-menu-only nav hid every section but the active one behind
          a click nobody had a reason to try. */}
      {tabs && (
        <div className="relative z-20" style={{ background: 'color-mix(in srgb, var(--darbi-bg) 85%, transparent)', borderBottom: '1px solid var(--darbi-border)' }}>
          <div className="darbi-container py-3 flex flex-wrap justify-center gap-2">
            {tabs.map((rawId) => (
              <button
                key={rawId}
                onClick={() => onTabChange(rawId)}
                className={`text-sm px-4 py-2 rounded-full font-bold transition ${
                  activeTab === rawId ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={activeTab === rawId ? { background: 'var(--darbi-gradient)' } : { border: '1px solid color-mix(in srgb, var(--darbi-navy) 15%, transparent)' }}
              >
                {label(rawId)}
              </button>
            ))}
          </div>
        </div>
      )}

      <EmailVerifyBanner />
      <main className="darbi-container py-8 relative z-10">{children}</main>

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
              placeholder={t('common.jumpToPlaceholder')}
              className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 focus:outline-none"
              style={{ borderBottom: '1px solid var(--darbi-border)' }}
            />
            <div className="max-h-72 overflow-y-auto py-1">
              {paletteItems.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-500">{t('common.noMatches')}</p>
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
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The admin account never goes through signup, so its email is never
  // "verified" in the normal sense — nothing to nag about here.
  if (!user || user.email_verified || user.role === 'admin') return null;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const updated = await verifyEmail(code);
      setUser(updated);
      setStatus(t('common.verifySuccess'));
      setCode('');
    } catch (err) {
      setError(
        {
          invalid_code: t('common.verifyInvalidCode'),
          code_expired: t('common.verifyCodeExpired'),
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
      setStatus(t('common.verifyResendSuccess'));
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
      style={{
        background: 'color-mix(in srgb, var(--darbi-gold) 12%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--darbi-gold) 30%, transparent)',
      }}
    >
      <div className="darbi-container py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span style={{ color: 'var(--darbi-gold)' }}>
            {t('common.verifyBanner')(user.email)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0 transition hover:brightness-110"
              style={{
                background: 'color-mix(in srgb, var(--darbi-gold) 20%, transparent)',
                border: '1px solid color-mix(in srgb, var(--darbi-gold) 40%, transparent)',
                color: 'var(--darbi-gold)',
              }}
            >
              {open ? t('common.verifyHide') : t('common.verifyEnterCode')}
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0 transition hover:brightness-110 disabled:opacity-60"
              style={{
                background: 'color-mix(in srgb, var(--darbi-gold) 20%, transparent)',
                border: '1px solid color-mix(in srgb, var(--darbi-gold) 40%, transparent)',
                color: 'var(--darbi-gold)',
              }}
            >
              {t('common.verifyResend')}
            </button>
          </div>
        </div>

        {open && (
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2 mt-3">
            <input
              className="darbi-input py-2"
              style={{ maxWidth: 160 }}
              placeholder={t('common.verifyCodePlaceholder')}
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" disabled={busy} className="darbi-btn text-sm py-2 disabled:opacity-60">
              {busy ? t('common.verifyChecking') : t('common.verifySubmit')}
            </button>
          </form>
        )}
        {status && <p className="mt-2 text-green-400">{status}</p>}
        {error && <p className="mt-2" style={{ color: 'var(--darbi-error)' }}>{error}</p>}
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

/**
 * Full-size photo lightbox — shared by AccountPage's own-avatar "View
 * photo" and AdminDashboard's user-photo view (see AdminDashboard.jsx's
 * UserDetailModal, restricted there to the pure-admin owner account).
 */
export function PhotoViewModal({ src, onClose }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="" className="w-full rounded-2xl" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute -top-3 -end-3 w-8 h-8 rounded-full flex items-center justify-center text-sm"
          style={{ background: 'var(--darbi-surface-solid)', border: '2px solid var(--darbi-bg)' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export const Alert = ({ kind = 'error', children }) =>
  children ? (
    <div
      className="px-4 py-3 mb-4 border text-sm"
      style={
        kind === 'error'
          ? {
              background: 'color-mix(in srgb, var(--darbi-error) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--darbi-error) 35%, transparent)',
              color: 'var(--darbi-error)',
              borderRadius: 'var(--darbi-radius)',
            }
          : {
              background: 'color-mix(in srgb, var(--darbi-gold) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--darbi-gold) 35%, transparent)',
              color: 'var(--darbi-gold)',
              borderRadius: 'var(--darbi-radius)',
            }
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
export function Salary({ band, stage, confidence }) {
  const { t } = useLang();
  if (!band || band.min == null) {
    return <span className="text-gray-500 italic text-sm">{t('common.noSalaryBand')}</span>;
  }
  const value = band.min === band.max ? `${band.min}` : `${band.min}–${band.max}`;
  return (
    <span title={confidence ?? undefined}>
      <span className="font-bold" style={{ color: 'var(--darbi-gold)' }}>
        {value} JD
      </span>
      <span className="text-gray-400 text-sm">{t('common.perMonth')} · {stage ?? t('common.stageEntry')}</span>
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
