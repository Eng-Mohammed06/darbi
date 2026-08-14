import { createContext, useContext, useEffect, useState } from 'react';
import common from './dict/common.js';
import landing from './dict/landing.js';
import auth from './dict/auth.js';
import account from './dict/account.js';
import student from './dict/student.js';
import company from './dict/company.js';
import career from './dict/career.js';
import admin from './dict/admin.js';
import onboarding from './dict/onboarding.js';
import profileSetup from './dict/profileSetup.js';
import resetPassword from './dict/resetPassword.js';
import verifyEmail from './dict/verifyEmail.js';

/**
 * Site-wide English/Arabic switch. Applies `lang`/`dir` to <html>, so every
 * page — not just the landing page — flips to RTL and picks up translated
 * copy. Persisted under one shared key, so it survives login/logout and
 * page navigation, same as ThemeProvider (src/services/theme.jsx).
 *
 * Each page owns one namespace file under src/i18n/dict/ (e.g. student.js),
 * each exporting `{ en: {...}, ar: {...} }`. This file is the only place
 * that imports and merges them — namespace files themselves never import
 * each other, so translating one page can never conflict with another.
 */
const LANG_KEY = 'darbi.lang';

const NAMESPACES = {
  common,
  landing,
  auth,
  account,
  student,
  company,
  career,
  admin,
  onboarding,
  profileSetup,
  resetPassword,
  verifyEmail,
};

const DICT = { en: {}, ar: {} };
for (const [ns, entry] of Object.entries(NAMESPACES)) {
  DICT.en[ns] = entry.en ?? {};
  DICT.ar[ns] = entry.ar ?? {};
}

const LangContext = createContext(null);

function readStored() {
  try {
    return localStorage.getItem(LANG_KEY) || 'en';
  } catch {
    return 'en';
  }
}

/** `t('student.chat.emptyTitle')` — dot-path lookup, falls back to English, then to the key itself. */
function lookup(lang, path) {
  const parts = path.split('.');
  let node = DICT[lang];
  for (const p of parts) {
    node = node?.[p];
    if (node === undefined) break;
  }
  if (node !== undefined) return node;

  if (lang !== 'en') {
    let fallback = DICT.en;
    for (const p of parts) fallback = fallback?.[p];
    if (fallback !== undefined) return fallback;
  }
  return path;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStored);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  function setLang(next) {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* private browsing */
    }
  }

  function toggleLang() {
    setLang(lang === 'en' ? 'ar' : 'en');
  }

  function t(path) {
    return lookup(lang, path);
  }

  return (
    <LangContext.Provider value={{ lang, dir, setLang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
}
