import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAccessToken } from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      // It will fail if no token, trigger refresh, refresh will call setAccessToken, then fetchMe succeeds
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

