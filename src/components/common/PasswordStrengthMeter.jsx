import { passwordStrength } from '../../lib/password.js';

const LEVEL_STYLE = {
  weak: { color: '#ff6b7a', bars: 1 },
  fair: { color: '#ffab91', bars: 2 },
  strong: { color: '#06b6d4', bars: 3 },
};

/** Three-segment strength bar, shown live under a new-password field. */
export default function PasswordStrengthMeter({ password }) {
  const strength = passwordStrength(password);
  if (!strength) return null;

  const { color, bars } = LEVEL_STYLE[strength.level];

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ background: i <= bars ? color : 'rgba(255,255,255,0.12)' }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold shrink-0" style={{ color }}>
        {strength.label}
      </span>
    </div>
  );
}
