import { NextResponse, type NextRequest } from 'next/server';

/*
 * Deploy build is public-only. Prototype pages that are not finished
 * (and the mock login / role dashboards) redirect to the public dashboard.
 */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/public', request.url));
}

export const config = {
  matcher: [
    '/login',
    '/exchange/:path*',
    '/feedback/:path*',
    '/reports/:path*',
    '/users/:path*',
    '/settings/:path*',
    '/dashboard/(student|teacher|staff|admin)',
  ],
};
