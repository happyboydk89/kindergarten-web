'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import type { AuthUser } from '@/services/auth.service';
import type { UserRole } from '@/types';
import { setRoleCookie, clearRoleCookie, getRoleHomePath } from '@/lib/role-utils';

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

  useEffect(() => {
    authService
      .getMe()
      .then((res) => {
        if (res.success && res.data) {
          setUser(res.data.user);
          setRoleCookie(res.data.user.role);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(
    async (phoneNumber: string, password: string): Promise<AuthUser> => {
      const res = await authService.login(phoneNumber, password);
      if (res.success && res.data) {
        setUser(res.data.user);
        setRoleCookie(res.data.user.role);
        return res.data.user;
      }
      throw new Error(res.message ?? 'Đăng nhập thất bại');
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

  const value: AuthContextValue = {
    user,
    role: user?.role ?? null,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
