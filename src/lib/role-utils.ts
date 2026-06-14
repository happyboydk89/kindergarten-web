import type { UserRole } from '@/types';

export function getRoleHomePath(role: UserRole): string {
  switch (role) {
    case 'PRINCIPAL':
    case 'TEACHER':
    case 'STAFF':
      return '/dashboard';
    case 'PARENT':
      return '/parent';
  }
}

const USER_ROLE_COOKIE = 'user-role';
const COOKIE_OPTIONS = 'path=/; SameSite=Lax';

export function setRoleCookie(role: UserRole): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${USER_ROLE_COOKIE}=${role}; ${COOKIE_OPTIONS}`;
}

export function clearRoleCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${USER_ROLE_COOKIE}=; max-age=0; path=/`;
}
