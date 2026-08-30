import Link from 'next/link';
import { API_BROWSER_BASE_URL } from '@/lib/api';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-ring">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-ink flex items-center gap-2"
          >
            <span className="inline-block w-3.5 h-3.5 rounded-full bg-ink" />
            Partner Activity
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/partners"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-mute hover:text-ink hover:bg-paper transition-colors"
            >
              Partners
            </Link>
            <Link
              href="/activities"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-mute hover:text-ink hover:bg-paper transition-colors"
            >
              Activities
            </Link>
            <Link
              href="/documents"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-mute hover:text-ink hover:bg-paper transition-colors"
            >
              Documents
            </Link>
            <a
              href={`${API_BROWSER_BASE_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label hidden sm:inline-block ml-2 bg-white shadow-lightring rounded-full px-3.5 py-1.5 text-ink hover:shadow-ring transition-shadow"
            >
              API&nbsp;v1
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
