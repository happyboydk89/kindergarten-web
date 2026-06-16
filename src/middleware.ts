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

  // QUAN TRỌNG: Bỏ qua toàn bộ request tới /api/*.
  // Lý do: API routes đã được proxy tới Backend (qua Next.js rewrite hoặc
  // NEXT_PUBLIC_API_URL trực tiếp). Nếu middleware kiểm tra `accessToken`
  // cookie trên các request này, sẽ redirect về /login (cookie httpOnly do
  // BE set nằm trên domain BE, không có ở FE domain), làm vỡ mọi XHR từ
  // `apiClient`. Auth-check thật sự đã được thực hiện bởi BE protect middleware.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('accessToken')?.value;
  const userRole = request.cookies.get('user-role')?.value as UserRole | undefined;

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    if (accessToken && !request.nextUrl.searchParams.has('expired')) {
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
  // Bỏ qua static assets + API routes. API routes đã có BE protect middleware
  // xử lý auth — không cần Next.js middleware check thêm.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|api/).*)'],
};
