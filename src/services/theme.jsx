import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Site-wide theme switcher. Applies `data-theme` to <html>, so every page —
 * dashboards and account settings included, not just the landing page —
 * repaints from the same choice. Persisted under one shared key, so it
 * survives login/logout and page navigation.
 *
 * "classic" is DARBI's original cyan/orange palette (the values that used
 * to live unconditionally in global.css's :root) and stays the default, so
 * nobody who never touches the switcher sees any visual change. The other
 * seven are HP.html's named themes, exact token values, ported onto DARBI's
 * own --darbi-* custom properties (see global.css) instead of introducing a
 * second parallel token system.
 */
const THEME_KEY = 'darbi.theme';

export const THEMES = [
  { id: 'classic', en: 'Classic', ar: 'كلاسيكي' },
  { id: 'blueprint', en: 'Blueprint Night', ar: 'مخطط ليلي' },
  { id: 'limestone', en: 'Limestone & Pine', ar: 'حجر جيري وصنوبر' },
  { id: 'aqaba', en: 'Aqaba', ar: 'العقبة' },
  { id: 'cobalt', en: 'Signal Cobalt', ar: 'كوبالت الإشارة' },
  { id: 'basalt', en: 'Basalt', ar: 'بازلت' },
  { id: 'carbon', en: 'Carbon', ar: 'كربون' },
  { id: 'paper', en: 'Paper', ar: 'ورق' },
];

const ThemeContext = createContext(null);

function readStored() {
  try {
    return localStorage.getItem(THEME_KEY) || 'classic';
  } catch {
    return 'classic';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function setTheme(id) {
    setThemeState(id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      /* private browsing */
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
