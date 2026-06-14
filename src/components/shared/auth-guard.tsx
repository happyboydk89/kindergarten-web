'use client';

import { type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/types';

interface AllowedRolesProps {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function AllowedRoles({ roles, children, fallback = null }: AllowedRolesProps) {
  const { role } = useAuth();

  if (!role) return null;
  if (!roles.includes(role)) return fallback;

  return children;
}
