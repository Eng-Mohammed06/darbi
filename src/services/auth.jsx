import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, clearToken, getToken } from './api.js';

const AuthContext = createContext(null);
const VIEW_MODE_KEY = 'darbi.viewMode';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // `loading` starts true so a refresh doesn't flash the logged-out homepage
  // before /auth/me comes back.
  const [loading, setLoading] = useState(Boolean(getToken()));
  // Which portal a dual-role account (user.is_admin === true, role isn't
  // 'admin') is currently using — null means "their normal role's portal",
  // 'admin' means they've switched into the Admin Portal. Persisted so it
  // survives a page refresh, but reset on every fresh login/signup/logout so
  // a new session always starts by asking again rather than remembering the
  // previous account's choice.
  const [viewMode, setViewModeState] = useState(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY);
    } catch {
      return null;
    }
  });

  function setViewMode(mode) {
    setViewModeState(mode);
    try {
      if (mode) localStorage.setItem(VIEW_MODE_KEY, mode);
      else localStorage.removeItem(VIEW_MODE_KEY);
    } catch {
      /* private browsing */
    }
  }

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(({ user: u, profile: p }) => {
        setUser(u);
        setProfile(p);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      setProfile,
      setUser,
      viewMode,
      setViewMode,

      async login(identifier, password) {
        const res = await api('/auth/login', {
          method: 'POST',
          auth: false,
          body: { identifier, password },
        });
        setToken(res.token);
        setUser(res.user);
        setProfile(res.profile);
        setViewMode(null);
        return res.user;
      },

      async signup(fields) {
        const res = await api('/auth/signup', { method: 'POST', auth: false, body: fields });
        setToken(res.token);
        setUser(res.user);
        setProfile(res.profile);
        setViewMode(null);
        return res.user;
      },

      /** Returns the updated user (with email_verified: true) on success. */
      async verifyEmail(code) {
        const res = await api('/auth/verify-email', { method: 'POST', body: { code } });
        return res.user;
      },

      resendVerification() {
        return api('/auth/resend-verification', { method: 'POST' });
      },

      /** `image` is a data: URI (data:image/png;base64,... or image/jpeg). */
      async uploadAvatar(image) {
        const res = await api('/auth/avatar', { method: 'PUT', body: { image } });
        setUser(res.user);
        return res.user;
      },

      async removeAvatar() {
        const res = await api('/auth/avatar', { method: 'DELETE' });
        setUser(res.user);
        return res.user;
      },

      /** Public — no session required, since a locked-out user isn't logged in. */
      forgotPassword(identifier) {
        return api('/auth/forgot-password', { method: 'POST', auth: false, body: { identifier } });
      },

      resetPassword(identifier, code, newPassword) {
        return api('/auth/reset-password', {
          method: 'POST',
          auth: false,
          body: { identifier, code, newPassword },
        });
      },

      logout() {
        clearToken();
        setUser(null);
        setProfile(null);
        setViewMode(null);
      },
    }),
    [user, profile, loading, viewMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
