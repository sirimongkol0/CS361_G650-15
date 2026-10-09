import { NextResponse, type NextRequest } from 'next/server';

/*
 * Prototype pages that are not finished yet redirect to the public dashboard.
 * /login and the role dashboards are live (V3); role dashboards check the
 * signed-in role in the page itself, and the backend re-checks every request.
 */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/public', request.url));
}

export const config = {
  matcher: [
    '/exchange/:path*',
    '/feedback/:path*',
    '/reports/:path*',
    '/users/:path*',
    '/settings/:path*',
  ],
};
