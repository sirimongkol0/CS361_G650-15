'use client';

/*
 * AppShell — Next.js port of the former Figma mock prototype (removed in V4)
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
  Users, Globe, Folder, History, ArrowUp, Search, Keyboard, WifiOff, LogIn, LogOut,
} from 'lucide-react';
import { CommandPalette, ShortcutsHelp } from '@/components/command-palette';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ACCOUNT_NAV, ROLE_NAV, groupNav, useRole, type NavItem } from '@/lib/role-context';

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
  history: History,
};

const COLLAPSE_KEY = 'pcsms:sidebar-collapsed';
const SCROLL_KEY = 'pcsms:scroll:';

/* Sidebar built on the shadcn Sidebar: collapses to icons (with tooltips) on desktop and
   becomes a Radix Sheet on mobile, so the closed drawer is out of the tab order and the
   open one traps focus and closes on Esc. Ctrl/⌘+B toggles it. */
function AppSidebar({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const navGroups = groupNav(navItems);
  // A single group (anonymous visitors, public role) needs no headings.
  const showGroupLabels = navGroups.length > 1;

  // Close the mobile drawer after following a link.
  useEffect(() => { setOpenMobile(false); }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      {/* TU colour strip */}
      <div className="h-1 tu-stripe shrink-0" />

      {/* Logo */}
      <SidebarHeader className="flex-row items-center gap-3 border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-linear-to-br from-crimson to-[#B8243E] group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
          <div className="font-display font-extrabold text-sm leading-snug text-ink">
            CSTU • PCSMS
          </div>
          <div className="text-xs leading-snug text-faint">
            ความร่วมมือของหลักสูตร<br />
            วิทยาการคอมพิวเตอร์ ธรรมศาสตร์
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="เมนูหลัก" className="py-1">
          {navGroups.map((group) => (
            // aria-label rather than an id: the label must work in both the desktop and mobile sidebar.
            <SidebarGroup key={group.id} role="group" aria-label={showGroupLabels ? group.label : undefined} className="py-1">
              {showGroupLabels && (
                <SidebarGroupLabel aria-hidden className="px-3 font-semibold text-faint">{group.label}</SidebarGroupLabel>
              )}
              <SidebarMenu className="gap-0.5">
                {group.items.map(({ to, icon, label, end }) => {
                  const Icon = ICON_MAP[icon] ?? LayoutDashboard;
                  // Prefix match, but a more specific item (e.g. /documents/manage) wins over /documents.
                  const active = end
                    ? pathname === to
                    : pathname.startsWith(to) && !navItems.some((other) => other.to.length > to.length && pathname.startsWith(other.to));
                  return (
                    <SidebarMenuItem key={`${to}-${label}`}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        className="h-9 gap-2.5 px-3 text-mute hover:bg-soft hover:text-ink data-active:bg-crimson-light data-active:font-semibold data-active:text-crimson"
                      >
                        <Link href={to} aria-current={active ? 'page' : undefined}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}

/** Topbar menu button: collapses the desktop sidebar or opens the mobile drawer. */
function SidebarToggleButton() {
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar();
  return (
    <button
      className="p-1.5 rounded-sm hover:bg-soft"
      onClick={toggleSidebar}
      title="แสดงหรือซ่อนเมนู (Ctrl+B)"
      aria-label="แสดงหรือซ่อนเมนู"
      aria-keyshortcuts="Control+B"
      aria-expanded={isMobile ? openMobile : open}
    >
      <Menu className="w-5 h-5 text-faint" />
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { role, config, user, status, logout } = useRole();

  const mainRef = useRef<HTMLElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const cameBack = useRef(false);

  const navItems = status === 'authenticated' ? [...ROLE_NAV[role], ACCOUNT_NAV] : ROLE_NAV[role];

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

  const setSidebarOpen = (open: boolean) => {
    setCollapsed(!open);
    try { localStorage.setItem(COLLAPSE_KEY, open ? '0' : '1'); } catch {}
  };

  // The login page has its own full-screen layout.
  if (pathname === '/login') return <>{children}</>;

  return (
    <TooltipProvider>
    <SidebarProvider
      open={!collapsed}
      onOpenChange={setSidebarOpen}
      className="h-screen min-h-0 overflow-hidden print:block print:h-auto print:overflow-visible"
      style={{ background: 'var(--background)' }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-60 focus:rounded-sm focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-card"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <AppSidebar navItems={navItems} />

      {/* Main */}
      <div className="flex min-w-0 flex-col flex-1 overflow-hidden print:overflow-visible">
        {/* Topbar (replaces the old top Navbar) */}
        <header
          className="flex items-center gap-3 px-4 md:px-5 border-b bg-white shrink-0 print:hidden"
          style={{ height: 60, borderColor: 'var(--border)' }}
        >
          <SidebarToggleButton />

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
            <kbd className="rounded-sm border border-line px-1.5 text-[11px]">Ctrl K</kbd>
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
            className="p-1.5 rounded-sm hover:bg-soft"
            onClick={() => setHelpOpen(true)}
            title="คีย์ลัด (?)"
            aria-label="คีย์ลัด"
          >
            <Keyboard className="w-5 h-5 text-faint" />
          </button>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto flex flex-col outline-hidden print:overflow-visible"
          onScroll={onMainScroll}
        >
          {offline && (
            <div role="alert" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900">
              <WifiOff className="w-4 h-4" />
              ไม่ได้เชื่อมต่ออินเทอร์เน็ต ข้อมูลที่เห็นอาจไม่ใช่ข้อมูลล่าสุด
            </div>
          )}
          <div key={pathname} className="grow animate-fade-up">{children}</div>
        </main>

        {showTop && (
          <button
            type="button"
            className="fixed bottom-5 right-5 z-30 rounded-full bg-crimson p-2.5 text-white shadow-card hover:opacity-90 animate-scale-in print:hidden"
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
    </SidebarProvider>
    </TooltipProvider>
  );
}
