import { NextResponse, type NextRequest } from 'next/server';

/*
 * Pages that belong to V4 (stakeholder insight: feedback and reports, FR6/FR9)
 * are built but not part of the V3 release, so they redirect to the public
 * dashboard. Remove a path here to release it; the backend still checks roles.
 */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/public', request.url));
}

export const config = {
  matcher: [
    '/feedback/:path*',
    '/reports/:path*',
  ],
};
