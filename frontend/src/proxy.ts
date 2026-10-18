import { NextResponse, type NextRequest } from 'next/server';

/*
 * Prototype pages that are not finished yet redirect to the public dashboard.
 * /login, the role dashboards and /exchange are live (V3); pages check the
 * signed-in role themselves, and the backend re-checks every request.
 */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/public', request.url));
}

export const config = {
  matcher: [
    '/feedback/:path*',
    '/reports/:path*',
    '/users/:path*',
    '/settings/:path*',
  ],
};
