'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/services/auth.service';
import type { AuthUser } from '@/services/auth.service';
import type { UserRole } from '@/types';
import { setRoleCookie, clearRoleCookie } from '@/lib/role-utils';

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phoneNumber: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    if (pathname === '/login') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    authService
      .getMe()
      .then((res) => {
        const userData = extractUser(res.data);
        if (userData) {
          setUser(userData);
          setRoleCookie(userData.role);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [pathname]);

  function extractUser(data: unknown): AuthUser | null {
    if (!data || typeof data !== 'object') return null;
    if ('user' in data && data.user !== null && typeof data.user === 'object') {
      return data.user as AuthUser;
    }
    if ('id' in data && 'role' in data) {
      return data as AuthUser;
    }
    return null;
  }

  const login = useCallback(
    async (phoneNumber: string, password: string): Promise<AuthUser> => {
      const res = await authService.login(phoneNumber, password);
      if (!res.success) {
        throw new Error(res.message ?? 'Đăng nhập thất bại');
      }

      const meRes = await authService.getMe();
      const userData = extractUser(meRes.data);

      if (!userData) {
        throw new Error('Không thể lấy thông tin người dùng sau đăng nhập');
      }

      setUser(userData);
      setRoleCookie(userData.role);
      return userData;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      clearRoleCookie();
      router.push('/login');
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
