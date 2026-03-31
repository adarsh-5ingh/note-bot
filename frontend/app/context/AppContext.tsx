'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface AppContextValue {
  user: AppUser | null;
  isLoading: boolean;
  authError: string | null;
  pendingTasks: number;
  refreshTasks: () => void;
  logout: () => void;
}

const AppContext = createContext<AppContextValue>({
  user: null,
  isLoading: true,
  authError: null,
  pendingTasks: 0,
  refreshTasks: () => {},
  logout: () => {},
});

export function useAppContext() {
  return useContext(AppContext);
}

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingTasks, setPendingTasks] = useState(0);
  const didFetch = useRef(false);

  function authHeader() {
    const token = localStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  const fetchTasks = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/tasks`, { headers: authHeader() });
      if (res.ok) {
        const tasks: { completed: boolean }[] = await res.json();
        setPendingTasks(tasks.filter(t => !t.completed).length);
      }
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API]);

  useEffect(() => {
    if (didFetch.current) return;
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    didFetch.current = true;
    setIsLoading(true);

    // Try sessionStorage cache first (avoids flash on navigation)
    const cached = sessionStorage.getItem('app_user');
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch (_) {}
    }

    // Set timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setAuthError('Connection timeout. Please try again.');
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    fetch(`${API}/auth/me`, { headers: authHeader() })
      .then(r => {
        if (r.ok) return r.json();
        if (r.status === 401) {
          // Token expired - clear and redirect
          localStorage.removeItem('auth_token');
          sessionStorage.removeItem('app_user');
          throw new Error('Session expired');
        }
        throw new Error('Auth failed');
      })
      .then(d => {
        if (d?.user) {
          setUser(d.user);
          sessionStorage.setItem('app_user', JSON.stringify(d.user));
          setAuthError(null);
        }
      })
      .catch(err => {
        console.error('Auth error:', err);
        // Try using cached user if available
        if (!cached) {
          setAuthError(err.message || 'Authentication failed');
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsLoading(false);
      });

    fetchTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('app_user');
    setUser(null);
    setAuthError(null);
    setIsLoading(false);
    setPendingTasks(0);
    didFetch.current = false;
    try { fetch(`${API}/auth/logout`, { credentials: 'include' }); } catch (_) {}
    router.replace('/');
  }

  return (
    <AppContext.Provider value={{ user, isLoading, authError, pendingTasks, refreshTasks: fetchTasks, logout }}>
      {children}
    </AppContext.Provider>
  );
}
