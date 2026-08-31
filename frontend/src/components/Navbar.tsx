'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_BROWSER_BASE_URL } from '@/lib/api';

/* Inline globe icon — same mark as the mock's sidebar logo (no new deps) */
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/partners', label: 'Partners' },
  { href: '/activities', label: 'Activities' },
  { href: '/documents', label: 'Documents' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-line">
      {/* TU gradient strip */}
      <div className="h-1 tu-stripe" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo — crimson gradient mark + wordmark, as in MainLayout */}
          <Link href="/" className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-crimson to-[#B8243E]">
              <GlobeIcon className="w-5 h-5 text-white" />
            </span>
            <span className="overflow-hidden leading-tight">
              <span className="block font-display font-extrabold text-sm text-ink">
                Partner Activity
              </span>
              <span className="block text-xs text-faint">
                Collaboration &amp; Stakeholder
              </span>
            </span>
          </Link>

          {/* Nav — sidebar-link style from the mock */}
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${active ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
            <a
              href={`${API_BROWSER_BASE_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-link hidden sm:flex"
            >
              API&nbsp;V1
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
