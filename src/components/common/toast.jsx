import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const KIND_COLOR = {
  success: 'var(--darbi-success)',
  error: 'var(--darbi-error)',
  info: 'var(--darbi-purple)',
};

/**
 * App-wide toast queue, mounted once in App.jsx. Replaces the inline
 * `<p className="text-green-400">Saved.</p>` pattern that used to be
 * hand-rolled per form — those only showed inside the form itself and
 * disappeared the moment you navigated away, so a save right before
 * switching tabs was easy to miss.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message, { kind = 'info', action, duration = 4500 } = {}) => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, message, kind, action }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div
        className="fixed bottom-4 inset-x-0 sm:inset-x-auto sm:right-4 z-[60] flex flex-col gap-2 px-4 sm:px-0 items-center sm:items-end"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="darbi-toast w-full sm:w-auto sm:max-w-sm flex items-center justify-between gap-3 py-3 px-4"
            style={{
              background: 'var(--darbi-surface-solid)',
              border: '1px solid var(--darbi-border)',
              borderLeft: `4px solid ${KIND_COLOR[t.kind] ?? KIND_COLOR.info}`,
              borderRadius: 'var(--darbi-radius)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            }}
          >
            <span className="text-sm text-gray-200">{t.message}</span>
            <div className="flex items-center gap-3 shrink-0">
              {t.action && (
                <button
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: 'var(--darbi-purple)' }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="text-gray-500 hover:text-white transition"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
