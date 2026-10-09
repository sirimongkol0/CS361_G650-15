'use client';

/*
 * AppShell — Next.js port of legacy/figma-mock/src/layouts/MainLayout.tsx
 * Sidebar (per current role's ROLE_NAV) + topbar + children.
 * Uses the TU theme tokens (crimson/gold, shadow-card, badge-*) from globals.css.
 * Footer is rendered at the bottom of the main column.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building2, FileText, CalendarDays, GraduationCap,
  MessageSquare, BarChart3, Settings, Menu,
  Users, Globe, Folder, ArrowUp, Search, Keyboard, WifiOff, LogIn, LogOut,
} from 'lucide-react';
import { CommandPalette, ShortcutsHelp } from '@/components/command-palette';
import { ROLE_NAV, useRole } from '@/lib/role-context';

/* Map icon string → Lucide component */
const ICON_MAP: Record<string, React.ElementType> = {
  home: LayoutDashboard,
  building: Building2,
  file: FileText,
  calendar: CalendarDays,
  graduation: GraduationCap,
  message: MessageSquare,
  chart: BarChart3,
  settings: Settings,
  users: Users,
  globe: Globe,
  folder: Folder,
};

const COLLAPSE_KEY = 'pcsms:sidebar-collapsed';
const SCROLL_KEY = 'pcsms:scroll:';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { role, config, user, status, logout } = useRole();

  const mainRef = useRef<HTMLElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const cameBack = useRef(false);

  const navItems = ROLE_NAV[role];

  const handleLogout = async () => {
    await logout();
    router.push('/dashboard/public');
  };

  // Remember the desktop sidebar width between visits.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch {}
  }, []);

  // Ctrl+K opens global search; "?" opens the shortcut list.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key === '?' && !typing) setHelpOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Back/forward restores the previous scroll position; other navigation starts at the top.
  useEffect(() => {
    const onPop = () => { cameBack.current = true; };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    const main = mainRef.current;
    if (!main) return;
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(SCROLL_KEY + pathname)) || 0; } catch {}
    if (!cameBack.current || saved === 0) {
      main.scrollTo({ top: 0 });
      return;
    }
    cameBack.current = false;
    // Lists render after their data loads, so retry until the page is tall enough.
    let tries = 0;
    const timer = setInterval(() => {
      main.scrollTo({ top: saved });
      if (Math.abs(main.scrollTop - saved) < 2 || ++tries > 20) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [pathname]);

  const onMainScroll = (event: React.UIEvent<HTMLElement>) => {
    const top = event.currentTarget.scrollTop;
    setShowTop(top > 600);
    try { sessionStorage.setItem(SCROLL_KEY + pathname, String(Math.round(top))); } catch {}
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setCollapsed((c) => {
        try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch {}
        return !c;
      });
    } else {
      setMobileOpen((o) => !o);
    }
  };

  const sidebarContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TU colour strip */}
      <div className="h-1 tu-stripe flex-shrink-0" />

      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-crimson to-[#B8243E]">
          <Globe className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-display font-extrabold text-sm leading-tight text-ink">
              CSTU • PCSMS
            </div>
            <div className="text-xs leading-tight text-faint">
              ความร่วมมือของหลักสูตร<br />
              วิทยาการคอมพิวเตอร์ ธรรมศาสตร์
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-0.5">
        {navItems.map(({ to, icon, label, end }) => {
          const Icon = ICON_MAP[icon] ?? LayoutDashboard;
          const active = end ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={`${to}-${label}`}
              href={to}
              className={`sidebar-link ${active ? 'active' : ''}`}
              title={collapsed ? label : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

    </div>
  );

  // The login page has its own full-screen layout.
  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-card"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 border-r transition-all duration-200 overflow-hidden"
        style={{
          width: collapsed ? 68 : 256,
          borderColor: 'var(--border)',
          background: '#fff',
        }}
      >
        {sidebarContent(collapsed)}
      </aside>

      {/* Sidebar — mobile drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col md:hidden border-r transition-transform duration-200"
        style={{ width: 256, borderColor: 'var(--border)', background: '#fff', transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        {sidebarContent(false)}
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar (replaces the old top Navbar) */}
        <header
          className="flex items-center gap-3 px-4 md:px-5 border-b bg-white flex-shrink-0"
          style={{ height: 60, borderColor: 'var(--border)' }}
        >
          <button
            className="p-1.5 rounded hover:bg-soft"
            onClick={toggleSidebar}
            title="สลับแถบเมนู"
            aria-label="สลับแถบเมนู"
            aria-expanded={mobileOpen || !collapsed}
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>

          {/* System name */}
          <div className="font-display font-extrabold text-sm text-ink hidden sm:block">
            CSTU • PCSMS
            <span className="hidden lg:inline text-xs font-medium text-faint ml-2">
              ปริญญาตรี • ธรรมศาสตร์ ศูนย์รังสิต
            </span>
          </div>

          <div className="flex-1" />

          <button
            type="button"
            className="hidden sm:flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-faint hover:border-crimson hover:text-ink"
            onClick={() => setPaletteOpen(true)}
            aria-keyshortcuts="Control+K"
          >
            <Search className="w-4 h-4" />
            ค้นหาทั้งระบบ
            <kbd className="rounded border border-line px-1.5 text-[11px]">Ctrl K</kbd>
          </button>
          {status === 'authenticated' && user && (
            <div className="flex items-center gap-2">
              <span
                className="badge text-xs"
                style={{ color: config.pillColor, background: config.pillBg }}
                title={config.label}
              >
                {config.labelShort}
              </span>
              <span className="hidden md:inline text-sm text-faint max-w-[200px] truncate" title={user.email}>
                {user.email}
              </span>
              <button
                type="button"
                className="btn btn-outline gap-1.5 px-2.5 py-1.5 text-sm"
                onClick={handleLogout}
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </button>
            </div>
          )}
          {status === 'anonymous' && (
            <Link href="/login" className="btn btn-primary gap-1.5 px-3 py-1.5 text-sm">
              <LogIn className="w-4 h-4" />
              เข้าสู่ระบบ
            </Link>
          )}
          <button
            type="button"
            className="p-1.5 rounded hover:bg-soft"
            onClick={() => setHelpOpen(true)}
            title="คีย์ลัด (?)"
            aria-label="คีย์ลัด"
          >
            <Keyboard className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto flex flex-col outline-none"
          onScroll={onMainScroll}
        >
          {offline && (
            <div role="alert" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900">
              <WifiOff className="w-4 h-4" />
              ขาดการเชื่อมต่ออินเทอร์เน็ต ข้อมูลที่แสดงอาจไม่เป็นปัจจุบัน
            </div>
          )}
          <div key={pathname} className="flex-grow animate-fade-up">{children}</div>
        </main>

        {showTop && (
          <button
            type="button"
            className="fixed bottom-5 right-5 z-30 rounded-full bg-crimson p-2.5 text-white shadow-card hover:opacity-90 animate-scale-in"
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="กลับขึ้นด้านบน"
            title="กลับขึ้นด้านบน"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
