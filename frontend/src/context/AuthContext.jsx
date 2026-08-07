import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('predixo_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem('predixo_token'))
      .finally(() => setLoading(false));
  }, []);

  const persist = (data) => {
    localStorage.setItem('predixo_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const login = useCallback(async (email, password) => {
    return persist(await api.login({ email, password }));
  }, []);

  const register = useCallback(async (body) => {
    return persist(await api.register(body));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('predixo_token');
    setUser(null);
  }, []);

  // Refresh balance/profile (e.g. after staking or a deposit poll).
  const refresh = useCallback(async () => {
    try {
      const d = await api.me();
      setUser(d.user);
      return d.user;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
