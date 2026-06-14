import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/types';

const AUTH_ROUTES = ['/login'];
const PUBLIC_ROUTES = ['/403'];

const ROLE_ROUTE_PATTERNS: Array<{
  pattern: RegExp;
  roles: UserRole[];
}> = [
  { pattern: /^\/dashboard(\/.*)?$/, roles: ['PRINCIPAL', 'TEACHER', 'STAFF'] },
  { pattern: /^\/parent(\/.*)?$/, roles: ['PARENT'] },
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;
  const userRole = request.cookies.get('user-role')?.value as UserRole | undefined;

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    if (accessToken) {
      const homePath = getRoleHomePath(userRole);
      return NextResponse.redirect(new URL(homePath, request.url));
    }
    return NextResponse.next();
  }

  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  for (const { pattern, roles } of ROLE_ROUTE_PATTERNS) {
    if (pattern.test(pathname)) {
      if (userRole && !roles.includes(userRole)) {
        return NextResponse.redirect(new URL('/403', request.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

function getRoleHomePath(role?: UserRole): string {
  switch (role) {
    case 'PARENT':
      return '/parent';
    case 'PRINCIPAL':
    case 'TEACHER':
    case 'STAFF':
    default:
      return '/dashboard';
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
