'use client';

/*
 * Role context for PCSMS — ported from legacy/figma-mock/src/context/RoleContext.tsx
 * to Next.js (Link from next/link, localStorage handled SSR-safely).
 *
 * NOTE: this is MOCK AUTH ONLY (role chosen in the login page / switcher, stored
 * in localStorage). Real authentication is planned for V3 — do not treat the
 * selected role as a security boundary.
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import Link from 'next/link';

export type UserRole = 'public' | 'student' | 'teacher' | 'staff' | 'admin';

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
    label: 'นักศึกษา / ผู้เข้าร่วมโครงการ',
    labelShort: 'นักศึกษา',
    dashboardPath: '/dashboard/student',
    pillColor: '#1D4ED8',
    pillBg: '#DBEAFE',
  },
  {
    id: 'teacher',
    label: 'อาจารย์ / ผู้ประสานงาน',
    labelShort: 'อาจารย์',
    dashboardPath: '/dashboard/teacher',
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
    label: 'ผู้บริหาร / ผู้ดูแลระบบ',
    labelShort: 'ผู้บริหาร',
    dashboardPath: '/dashboard/admin',
    pillColor: '#8B1538',
    pillBg: '#F5D6DE',
  },
];

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
    { to: '/documents', label: 'เอกสารข้อตกลง', icon: 'file' },
    { to: '/activities', label: 'กิจกรรม', icon: 'calendar' },
  ],
  student: [
    { to: '/dashboard/student', label: 'หน้าหลัก', icon: 'home', end: true },
    { to: '/activities', label: 'กิจกรรม', icon: 'calendar' },
  ],
  teacher: [
    { to: '/dashboard/teacher', label: 'หน้าหลัก', icon: 'home', end: true },
    { to: '/stakeholders', label: 'Stakeholder', icon: 'building' },
    { to: '/documents', label: 'MoU / MoA', icon: 'file' },
    { to: '/activities', label: 'กิจกรรม', icon: 'calendar' },
  ],
  staff: [
    { to: '/dashboard/staff', label: 'Dashboard', icon: 'home', end: true },
    { to: '/stakeholders', label: 'Stakeholder', icon: 'building' },
    { to: '/documents', label: 'MoU / MoA', icon: 'file' },
    { to: '/activities', label: 'Activities', icon: 'calendar' },
  ],
  admin: [
    { to: '/dashboard/admin', label: 'Executive Dashboard', icon: 'home', end: true },
    { to: '/stakeholders', label: 'Stakeholder', icon: 'building' },
    { to: '/documents', label: 'MoU / MoA', icon: 'file' },
    { to: '/activities', label: 'Activities', icon: 'calendar' },
  ],
};

/* ---- Context ---- */
interface RoleContextType {
  role: UserRole;
  setRole: (r: UserRole) => void;
  config: RoleConfig;
}

const RoleContext = createContext<RoleContextType>({
  role: 'public',
  setRole: () => {},
  config: ROLES[0],
});

const STORAGE_KEY = 'pcsms_role';

export function RoleProvider({ children }: { children: ReactNode }) {
  // SSR-safe and least-privilege: anonymous/new sessions start in the public role.
  const [role, setRoleState] = useState<UserRole>('public');

  // Deploy build is public-only: a role saved by the old prototype switcher is ignored.

  const setRole = (r: UserRole) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, r);
    }
    setRoleState(r);
  };

  return (
    <RoleContext.Provider value={{ role, setRole, config: getRoleConfig(role) }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

/* Re-export Link so consumers of this module can build nav items with Next routing. */
export { Link };
