import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('biznex_token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('biznex_user') || 'null'); } catch { return null; }
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) { setReady(true); return; }
    api('/auth/me')
      .then((d) => { setUser(d.user); })
      .catch(() => { localStorage.removeItem('biznex_token'); localStorage.removeItem('biznex_user'); setToken(null); setUser(null); })
      .finally(() => setReady(true));
  }, [token]);

  const login = useCallback(async (username, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { username, password } });
    localStorage.setItem('biznex_token', d.token);
    localStorage.setItem('biznex_user', JSON.stringify(d.user));
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('biznex_token');
    localStorage.removeItem('biznex_user');
    setToken(null);
    setUser(null);
  }, []);

  const can = (role) => {
    const level = { owner: 4, admin: 3, manager: 2, cashier: 1 };
    return user ? (level[user.role] ?? 0) >= (level[role] ?? 0) : false;
  };

  return (
    <AuthContext.Provider value={{ token, user, ready, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
