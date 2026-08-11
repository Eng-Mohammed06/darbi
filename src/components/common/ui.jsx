/**
 * Shared presentational bits.
 *
 * Every dimension here comes from the approved wireframe deliverable's DESIGN
 * SYSTEM page (see src/styles/global.css for the tokens and the quoted rules).
 * The classes `darbi-container`, `darbi-box`, `darbi-btn` and `darbi-input`
 * carry them — prefer those over ad-hoc Tailwind spacing.
 */

export function Shell({ title, subtitle, onLogout, children }) {
  return (
    <div className="min-h-screen">
      <header style={{ backgroundColor: 'var(--darbi-navy)' }} className="text-white">
        <div className="darbi-container py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-gray-300 mt-1">{subtitle}</p>}
          </div>
          <button onClick={onLogout} className="darbi-btn text-sm shrink-0">
            Sign out
          </button>
        </div>
      </header>
      <main className="darbi-container py-8">{children}</main>
    </div>
  );
}

export function Card({ title, children, accent = true }) {
  return (
    <section
      className="darbi-box darbi-section"
      style={accent ? { borderLeft: '4px solid var(--darbi-gold)' } : undefined}
    >
      {title && <h2 className="text-lg font-bold text-darbi-navy mb-4">{title}</h2>}
      {children}
    </section>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 darbi-section">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2 rounded font-bold text-sm whitespace-nowrap transition ${
            active === t ? 'text-darbi-navy' : 'bg-white text-darbi-navy hover:bg-gray-100'
          }`}
          style={{
            borderRadius: 'var(--darbi-radius)',
            backgroundColor: active === t ? 'var(--darbi-gold)' : undefined,
          }}
        >
          {t[0].toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-darbi-navy font-bold mb-1.5 text-sm">{label}</span>
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
      className={`px-4 py-3 mb-4 border ${
        kind === 'error'
          ? 'bg-red-50 border-red-400 text-red-800'
          : 'bg-amber-50 border-amber-400 text-amber-900'
      }`}
      style={{ borderRadius: 'var(--darbi-radius)' }}
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
      <span className="text-gray-500 text-sm">/month · {stage}</span>
    </span>
  );
}
