import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User, RegisterInput, LoginInput } from '../types/auth.types';
import { authApi } from '../api/auth.api';
import { setOnUnauthorized } from '../api/axios';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => setUser(null));
    return () => setOnUnauthorized(null);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    setError(null);
    try {
      const loggedInUser = await authApi.login(input);
      setUser(loggedInUser);
    } catch (err) {
      setError('Invalid email or password');
      throw err;
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setError(null);
    try {
      const registeredUser = await authApi.register(input);
      setUser(registeredUser);
    } catch (err) {
      setError('Registration failed. The email may already be in use.');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
