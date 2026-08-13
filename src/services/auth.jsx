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

      async login(email, password) {
        const res = await api('/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password },
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
