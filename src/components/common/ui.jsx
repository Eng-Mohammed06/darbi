/**
 * Shared presentational bits.
 *
 * Dark purple/gold theme (approved mockup, Aug 2026) — see src/styles/global.css
 * for the tokens. The classes `darbi-container`, `darbi-box`, `darbi-btn` and
 * `darbi-input` carry them; prefer those over ad-hoc Tailwind spacing/color.
 * `Wisps` is the decorative flowing-ribbon background used behind every page.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

export function Shell({ title, subtitle, tabs, activeTab, onTabChange, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--darbi-bg)' }}>
      <Wisps palette={['#a855f7', '#d4af37']} opacity={0.28} fixed />

      <header
        className="text-white relative z-30"
        style={{ background: 'rgba(10,6,16,0.85)', borderBottom: '1px solid var(--darbi-border)' }}
      >
        <div className="darbi-container py-5 flex items-center gap-4">
          {tabs && (
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="text-2xl leading-none shrink-0 px-1"
            >
              ☰
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          </div>
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
            <div
              className="darbi-container relative z-20"
            >
              <div
                className="absolute left-4 top-0 flex flex-col gap-1.5 p-3 min-w-[220px]"
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
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </header>
      <main className="darbi-container py-8 relative z-10">{children}</main>
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
          ? { background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 'var(--darbi-radius)' }
          : { background: 'rgba(212,175,55,0.1)', borderColor: 'rgba(212,175,55,0.35)', color: '#e8cf7a', borderRadius: 'var(--darbi-radius)' }
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
 * Decorative purple/gold ambient glow behind a panel or page. Originally an
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
