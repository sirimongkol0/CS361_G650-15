'use client';

/*
 * AppShell — Next.js port of legacy/figma-mock/src/layouts/MainLayout.tsx
 * Sidebar (per current role's ROLE_NAV) + topbar (PCSMS + role switcher) + children.
 * Uses the TU theme tokens (crimson/gold, shadow-card, badge-*) from globals.css.
 *
 * On /login the shell renders children bare (the login page is full-screen).
 * Footer is rendered at the bottom of the main column.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, FileText, CalendarDays, GraduationCap,
  MessageSquare, BarChart3, Settings, LogOut, Menu, Bell, Search,
  Users, Shield, Globe, Folder,
} from 'lucide-react';
import { ROLE_NAV, ROLES, useRole, getRoleConfig, type UserRole } from '@/lib/role-context';

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { role, config, setRole } = useRole();

  // Login page is a standalone full-screen layout — no sidebar/topbar.
  if (pathname === '/login') {
    return <>{children}</>;
  }

  const navItems = ROLE_NAV[role];

  const handleLogout = () => {
    window.location.href = '/login';
  };

  const sidebarContent = (
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
              PCSMS
            </div>
            <div className="text-xs leading-tight text-faint">
              Collaboration &amp; Stakeholder
            </div>
          </div>
        )}
      </div>

      {/* Role indicator (expanded only) */}
      {!collapsed && (
        <div
          className="px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}
        >
          <div className="text-xs font-semibold mb-1 text-faint">ประเภทผู้ใช้</div>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`badge badge-${role === 'admin' ? 'crimson' : role === 'student' ? 'blue' : role === 'teacher' ? 'green' : role === 'staff' ? 'purple' : 'gray'}`}
            >
              <Shield className="w-3 h-3" />
              {config.labelShort}
            </span>
            {/* Quick role switcher for prototype (mock auth — real auth in V2) */}
            <select
              className="text-xs border rounded px-1.5 py-0.5 cursor-pointer bg-white"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', fontSize: 11 }}
              value={role}
              onChange={(e) => {
                const r = e.target.value as UserRole;
                setRole(r);
                window.location.href = getRoleConfig(r).dashboardPath;
              }}
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.labelShort}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        {collapsed ? (
          <button
            className="w-9 h-9 rounded-full mx-auto flex items-center justify-center text-xs font-bold cursor-pointer border-0"
            style={{ background: config.pillBg, color: config.pillColor }}
            onClick={handleLogout}
            title="ออกจากระบบ"
          >
            A
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className="rounded-full flex-shrink-0 flex items-center justify-center font-bold"
              style={{ background: config.pillBg, color: config.pillColor, width: 34, height: 34, fontSize: 13 }}
            >
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-ink">Admin</div>
              <div className="text-xs truncate text-faint">{config.label}</div>
            </div>
            <button
              className="p-1.5 rounded hover:bg-soft flex-shrink-0"
              onClick={handleLogout}
              title="ออกจากระบบ"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
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
        {sidebarContent}
      </aside>

      {/* Sidebar — mobile drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col md:hidden border-r transition-transform duration-200"
        style={{ width: 256, borderColor: 'var(--border)', background: '#fff', transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        {sidebarContent}
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
            onClick={() => {
              setCollapsed((c) => !c);
              setMobileOpen((o) => !o);
            }}
            title="สลับแถบเมนู"
          >
            <Menu className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>

          {/* System name */}
          <div className="font-display font-extrabold text-sm text-ink hidden sm:block">
            PCSMS
            <span className="hidden lg:inline text-xs font-medium text-faint ml-2">
              Program Collaboration &amp; Stakeholder Management
            </span>
          </div>

          <div className="flex-1 max-w-xs hidden lg:block">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: '#9CA3AF' }}
              />
              <input
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border outline-none"
                placeholder="ค้นหา..."
                style={{ height: 34, background: '#F9FAFB', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Role badge in header */}
          <span
            className={`badge badge-${role === 'admin' ? 'crimson' : role === 'student' ? 'blue' : role === 'teacher' ? 'green' : role === 'staff' ? 'purple' : 'gray'} hidden sm:inline-flex`}
          >
            <Shield className="w-3 h-3" />
            {config.labelShort}
          </span>

          <button className="p-1.5 rounded hover:bg-soft relative" title="การแจ้งเตือน">
            <Bell className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-crimson" />
          </button>

          <div
            className="flex items-center gap-2 pl-2 border-l"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="rounded-full flex items-center justify-center font-bold"
              style={{ background: config.pillBg, color: config.pillColor, width: 30, height: 30, fontSize: 12 }}
            >
              A
            </div>
            <span className="text-sm font-semibold hidden sm:block text-ink">Admin</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-grow">{children}</div>
        </main>
      </div>
    </div>
  );
}
