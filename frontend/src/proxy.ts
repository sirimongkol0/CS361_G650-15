import { NextResponse, type NextRequest } from 'next/server';

/*
 * V4 pages that are not released yet redirect to the public dashboard.
 * /feedback was released in V4-1; /reports waits for real summaries (V4-5).
 * Remove a path here to release it; the backend still checks roles.
 */
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/dashboard/public', request.url));
}

export const config = {
  matcher: [
    '/reports/:path*',
  ],
};
