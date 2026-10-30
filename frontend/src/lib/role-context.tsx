'use client';

/*
 * Role context for PCSMS — ported from legacy/figma-mock/src/context/RoleContext.tsx
 * to Next.js (Link from next/link, localStorage handled SSR-safely).
 *
 * The role comes from the signed-in session (V3 login: backend + Amazon Cognito).
 * It only decides what the UI shows; every write is checked again by the backend
 * (require_role), so the UI role is never a security boundary.
 */

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ApiError, clearApiCache } from '@/lib/api';
import { onUnauthorized, readToken, writeToken } from '@/lib/session';
import * as authApi from '@/lib/auth-api';
import type { SessionUser } from '@/lib/auth-api';

export type UserRole = authApi.BackendRole;

export interface RoleConfig {
  id: UserRole;
  label: string;
  labelShort: string;
  dashboardPath: string;
  pillColor: string;
  pillBg: string;
}

export const ROLES: RoleConfig[] = [
  {
    id: 'public',
    label: 'ผู้ใช้ทั่วไป',
    labelShort: 'ทั่วไป',
    dashboardPath: '/dashboard/public',
    pillColor: '#4B5563',
    pillBg: '#F3F4F6',
  },
  {
    id: 'student',
    label: 'นักศึกษา',
    labelShort: 'นักศึกษา',
    dashboardPath: '/dashboard/student',
    pillColor: '#1D4ED8',
    pillBg: '#DBEAFE',
  },
  {
    id: 'coordinator',
    label: 'อาจารย์ผู้ประสานงาน',
    labelShort: 'ผู้ประสานงาน',
    dashboardPath: '/dashboard/coordinator',
    pillColor: '#15803D',
    pillBg: '#DCFCE7',
  },
  {
    id: 'staff',
    label: 'เจ้าหน้าที่หลักสูตร',
    labelShort: 'เจ้าหน้าที่',
    dashboardPath: '/dashboard/staff',
    pillColor: '#7C3AED',
    pillBg: '#EDE9FE',
  },
  {
    id: 'admin',
    label: 'ผู้ดูแลระบบ',
    labelShort: 'ผู้ดูแลระบบ',
    dashboardPath: '/dashboard/admin',
    pillColor: '#8B1538',
    pillBg: '#F5D6DE',
  },
];

/** Roles that get add/edit controls in the UI (the backend checks again with require_role). */
export const MANAGER_ROLES: readonly UserRole[] = ['coordinator', 'staff', 'admin'];

export function canManage(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

export function getRoleConfig(role: UserRole): RoleConfig {
  return ROLES.find((r) => r.id === role) ?? ROLES[0];
}

/* ---- Sidebar nav definition per role (Next.js routes only) ---- */
export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  public: [
    { to: '/dashboard/public', label: 'หน้าหลัก', icon: 'home', end: true },
    { to: '/stakeholders', label: 'หน่วยงานคู่ความร่วมมือ', icon: 'globe' },
    { to: '/documents', label: 'ข้อตกลง', icon: 'file' },
    { to: '/activities', label: 'กิจกรรม', icon: 'calendar' },
  ],
  student: [
    { to: '/dashboard/student', label: 'หน้าหลัก', icon: 'home', end: true },
    { to: '/stakeholders', label: 'หน่วยงานคู่ความร่วมมือ', icon: 'globe' },
    { to: '/documents', label: 'ข้อตกลง', icon: 'file' },
    { to: '/activities', label: 'กิจกรรม', icon: 'calendar' },
    { to: '/exchange', label: 'นักศึกษาแลกเปลี่ยน', icon: 'graduation' },
  ],
  coordinator: [
    { to: '/dashboard/coordinator', label: 'หน้าหลัก', icon: 'home', end: true },
    { to: '/stakeholders', label: 'หน่วยงานคู่ความร่วมมือ', icon: 'globe' },
    { to: '/stakeholders/manage', label: 'จัดการหน่วยงาน', icon: 'folder' },
    { to: '/documents', label: 'ข้อตกลง', icon: 'file' },
    { to: '/documents/manage', label: 'จัดการข้อตกลง', icon: 'folder' },
    { to: '/activities', label: 'กิจกรรม', icon: 'calendar' },
    { to: '/activities/manage', label: 'จัดการกิจกรรม', icon: 'folder' },
    { to: '/exchange', label: 'นักศึกษาแลกเปลี่ยน', icon: 'graduation' },
    { to: '/feedback', label: 'ความคิดเห็น', icon: 'message' },
  ],
  staff: [
    { to: '/dashboard/staff', label: 'หน้าหลัก', icon: 'home', end: true },
    { to: '/stakeholders', label: 'หน่วยงานคู่ความร่วมมือ', icon: 'globe' },
    { to: '/stakeholders/manage', label: 'จัดการหน่วยงาน', icon: 'folder' },
    { to: '/documents', label: 'ข้อตกลง', icon: 'file' },
    { to: '/documents/manage', label: 'จัดการข้อตกลง', icon: 'folder' },
    { to: '/activities', label: 'กิจกรรม', icon: 'calendar' },
    { to: '/activities/manage', label: 'จัดการกิจกรรม', icon: 'folder' },
    { to: '/exchange', label: 'นักศึกษาแลกเปลี่ยน', icon: 'graduation' },
    { to: '/feedback', label: 'ความคิดเห็น', icon: 'message' },
  ],
  admin: [
    { to: '/dashboard/admin', label: 'หน้าหลัก', icon: 'home', end: true },
    { to: '/stakeholders', label: 'หน่วยงานคู่ความร่วมมือ', icon: 'globe' },
    { to: '/stakeholders/manage', label: 'จัดการหน่วยงาน', icon: 'folder' },
    { to: '/documents', label: 'ข้อตกลง', icon: 'file' },
    { to: '/documents/manage', label: 'จัดการข้อตกลง', icon: 'folder' },
    { to: '/activities', label: 'กิจกรรม', icon: 'calendar' },
    { to: '/activities/manage', label: 'จัดการกิจกรรม', icon: 'folder' },
    { to: '/exchange', label: 'นักศึกษาแลกเปลี่ยน', icon: 'graduation' },
    { to: '/feedback', label: 'ความคิดเห็น', icon: 'message' },
    { to: '/users', label: 'ผู้ใช้และสิทธิ์', icon: 'users' },
    { to: '/feedback/lookups', label: 'ตั้งค่า Feedback', icon: 'settings' },
  ],
};

/** Shown to every signed-in account, including the public role (whose sidebar anonymous visitors share). */
export const ACCOUNT_NAV: NavItem = { to: '/settings', label: 'ตั้งค่าบัญชี', icon: 'settings' };

/* ---- Context ---- */
export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

interface RoleContextType {
  role: UserRole;
  config: RoleConfig;
  user: SessionUser | null;
  status: SessionStatus;
  /** Throws ApiError (e.g. status 401 for a wrong password). */
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType>({
  role: 'public',
  config: ROLES[0],
  user: null,
  status: 'loading',
  login: async () => { throw new ApiError('No session provider'); },
  logout: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  // SSR-safe and least-privilege: until the session is confirmed, show the public role.
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const router = useRouter();
  const pathname = usePathname();

  // The API rejected the token (expired/revoked): sign out, then return here after login.
  useEffect(() => {
    onUnauthorized(() => {
      writeToken(null);
      clearApiCache();
      setUser(null);
      setStatus('anonymous');
      if (pathname !== '/login') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });
    return () => onUnauthorized(null);
  }, [pathname, router]);

  useEffect(() => {
    try { localStorage.removeItem('pcsms_role'); } catch {} // old prototype role picker
    const token = readToken();
    if (!token) {
      setStatus('anonymous');
      return;
    }
    authApi.fetchMe(token).then(
      (me) => { setUser(me); setStatus('authenticated'); },
      (error) => {
        // Expired/revoked token -> sign out; a network error keeps the token for a retry.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) writeToken(null);
        setStatus('anonymous');
      },
    );
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    writeToken(result.access_token);
    clearApiCache();
    const me = await authApi.fetchMe(result.access_token);
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  const logout = useCallback(async () => {
    const token = readToken();
    writeToken(null);
    clearApiCache(); // no internal data may survive logout
    setUser(null);
    setStatus('anonymous');
    if (token) await authApi.logout(token).catch(() => {});
  }, []);

  const role: UserRole = user?.role ?? 'public';
  return (
    <RoleContext.Provider value={{ role, config: getRoleConfig(role), user, status, login, logout }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

/* Re-export Link so consumers of this module can build nav items with Next routing. */
export { Link };
