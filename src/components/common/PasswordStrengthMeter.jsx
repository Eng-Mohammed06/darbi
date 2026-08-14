import { passwordStrength } from '../../lib/password.js';
import { useLang } from '../../i18n/index.jsx';

const LEVEL_STYLE = {
  weak: { color: 'var(--darbi-error)', bars: 1 },
  fair: { color: 'var(--darbi-gold)', bars: 2 },
  strong: { color: 'var(--darbi-purple)', bars: 3 },
};

/** Three-segment strength bar, shown live under a new-password field. */
export default function PasswordStrengthMeter({ password }) {
  const { lang } = useLang();
  const strength = passwordStrength(password, lang);
  if (!strength) return null;

  const { color, bars } = LEVEL_STYLE[strength.level];

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ background: i <= bars ? color : 'color-mix(in srgb, var(--darbi-navy) 12%, transparent)' }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold shrink-0" style={{ color }}>
        {strength.label}
      </span>
    </div>
  );
}
