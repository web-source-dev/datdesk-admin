'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from './api';

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type AuthContextValue = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .checkSession()
      .then((u) => {
        if (u.role !== 'admin') {
          localStorage.removeItem('adminToken');
          setUser(null);
        } else {
          setUser(u);
        }
      })
      .catch(() => {
        localStorage.removeItem('adminToken');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    if (data.role !== 'admin') {
      throw new Error('Admin access required');
    }
    localStorage.setItem('adminToken', data.token);
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setUser(null);
    window.location.href = '/admin/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
