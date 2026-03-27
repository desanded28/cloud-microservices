import { useState, useEffect, useCallback } from 'react';
import { User, getMe, login as apiLogin, register as apiRegister } from '../api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const token = await apiLogin(username, password);
      localStorage.setItem('token', token);
      await fetchUser();
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  }, [fetchUser]);

  const register = useCallback(
    async (data: { username: string; email: string; password: string; full_name: string }) => {
      setError(null);
      try {
        await apiRegister(data);
        // auto-login after register
        const token = await apiLogin(data.username, data.password);
        localStorage.setItem('token', token);
        await fetchUser();
      } catch (e: any) {
        setError(e.message);
        throw e;
      }
    },
    [fetchUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return { user, loading, error, login, register, logout };
}
