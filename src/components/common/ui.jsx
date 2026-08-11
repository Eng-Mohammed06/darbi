/** Shared presentational bits, so the three dashboards stay consistent. */

export function Shell({ title, subtitle, onLogout, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header style={{ backgroundColor: '#001a33' }} className="text-white">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-gray-300 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onLogout}
            className="text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ backgroundColor: '#d4af37', color: '#001a33' }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

export function Card({ title, children, accent = true }) {
  return (
    <section
      className="bg-white rounded-lg shadow p-6 mb-6"
      style={accent ? { borderLeft: '4px solid #d4af37' } : undefined}
    >
      {title && <h2 className="text-xl font-bold text-darbi-navy mb-4">{title}</h2>}
      {children}
    </section>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-3 mb-6 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-5 py-2.5 rounded-lg font-bold whitespace-nowrap transition ${
            active === t ? 'text-darbi-navy' : 'bg-white text-darbi-navy hover:bg-gray-100'
          }`}
          style={active === t ? { backgroundColor: '#d4af37' } : undefined}
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
      <span className="block text-darbi-navy font-bold mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:outline-none ' +
  'focus:border-darbi-gold transition disabled:bg-gray-100';

export function Button({ children, variant = 'gold', ...rest }) {
  const style =
    variant === 'gold'
      ? { backgroundColor: '#d4af37', color: '#001a33' }
      : { backgroundColor: '#001a33', color: '#fff' };
  return (
    <button
      {...rest}
      className="font-bold py-2.5 px-6 rounded-lg hover:opacity-90 transition disabled:opacity-50"
      style={style}
    >
      {children}
    </button>
  );
}

export const Alert = ({ kind = 'error', children }) =>
  children ? (
    <div
      className={`px-4 py-3 rounded-lg mb-4 border-2 ${
        kind === 'error'
          ? 'bg-red-50 border-red-400 text-red-800'
          : 'bg-amber-50 border-amber-400 text-amber-900'
      }`}
    >
      {children}
    </div>
  ) : null;

/**
 * Shown wherever a salary would go. The dataset is not populated yet, and the
 * platform's whole claim is verified data — so we say so rather than estimate.
 */
export const SalaryPending = () => (
  <span className="text-gray-500 italic text-sm">Salary data pending verification</span>
);
