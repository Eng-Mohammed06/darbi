import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, clearToken, getToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // `loading` starts true so a refresh doesn't flash the logged-out homepage
  // before /auth/me comes back.
  const [loading, setLoading] = useState(Boolean(getToken()));

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

      async login(identifier, password) {
        const res = await api('/auth/login', {
          method: 'POST',
          auth: false,
          body: { identifier, password },
        });
        setToken(res.token);
        setUser(res.user);
        setProfile(res.profile);
        return res.user;
      },

      async signup(fields) {
        const res = await api('/auth/signup', { method: 'POST', auth: false, body: fields });
        setToken(res.token);
        setUser(res.user);
        setProfile(res.profile);
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
      },
    }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
