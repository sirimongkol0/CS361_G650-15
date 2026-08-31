import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "public" | "student" | "teacher" | "staff" | "admin";

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
    id: "public",
    label: "ผู้ใช้ทั่วไป",
    labelShort: "ทั่วไป",
    dashboardPath: "/dashboard/public",
    pillColor: "#4B5563",
    pillBg: "#F3F4F6",
  },
  {
    id: "student",
    label: "นักศึกษา / ผู้เข้าร่วมโครงการ",
    labelShort: "นักศึกษา",
    dashboardPath: "/dashboard/student",
    pillColor: "#1D4ED8",
    pillBg: "#DBEAFE",
  },
  {
    id: "teacher",
    label: "อาจารย์ / ผู้ประสานงาน",
    labelShort: "อาจารย์",
    dashboardPath: "/dashboard/teacher",
    pillColor: "#15803D",
    pillBg: "#DCFCE7",
  },
  {
    id: "staff",
    label: "เจ้าหน้าที่หลักสูตร",
    labelShort: "เจ้าหน้าที่",
    dashboardPath: "/dashboard/staff",
    pillColor: "#7C3AED",
    pillBg: "#EDE9FE",
  },
  {
    id: "admin",
    label: "ผู้บริหาร / ผู้ดูแลระบบ",
    labelShort: "ผู้บริหาร",
    dashboardPath: "/dashboard/admin",
    pillColor: "#8B1538",
    pillBg: "#F5D6DE",
  },
];

export function getRoleConfig(role: UserRole): RoleConfig {
  return ROLES.find((r) => r.id === role) ?? ROLES[4];
}

/* ---- Sidebar nav definition per role ---- */
export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  public: [
    { to: "/dashboard/public", label: "หน้าหลัก", icon: "home", end: true },
    { to: "/stakeholders", label: "ความร่วมมือ", icon: "globe" },
    { to: "/stakeholders", label: "หน่วยงานคู่ความร่วมมือ", icon: "building" },
    { to: "/activities", label: "กิจกรรม", icon: "calendar" },
  ],
  student: [
    { to: "/dashboard/student", label: "หน้าหลัก", icon: "home", end: true },
    { to: "/my-projects", label: "โครงการของฉัน", icon: "folder" },
    { to: "/exchange", label: "นักศึกษาแลกเปลี่ยน", icon: "graduation" },
    { to: "/activities", label: "กิจกรรม", icon: "calendar" },
    { to: "/feedback", label: "Feedback", icon: "message" },
    { to: "/profile", label: "โปรไฟล์ของฉัน", icon: "user" },
  ],
  teacher: [
    { to: "/dashboard/teacher", label: "หน้าหลัก", icon: "home", end: true },
    { to: "/stakeholders", label: "Stakeholder", icon: "building" },
    { to: "/documents", label: "MoU / MoA", icon: "file" },
    { to: "/activities", label: "กิจกรรม", icon: "calendar" },
    { to: "/exchange", label: "นักศึกษาแลกเปลี่ยน", icon: "graduation" },
    { to: "/feedback", label: "Feedback", icon: "message" },
    { to: "/reports", label: "รายงาน", icon: "chart" },
  ],
  staff: [
    { to: "/dashboard/staff", label: "Dashboard", icon: "home", end: true },
    { to: "/stakeholders", label: "Stakeholder", icon: "building" },
    { to: "/documents", label: "MoU / MoA", icon: "file" },
    { to: "/activities", label: "กิจกรรม", icon: "calendar" },
    { to: "/exchange", label: "นักศึกษาแลกเปลี่ยน", icon: "graduation" },
    { to: "/feedback", label: "Feedback", icon: "message" },
    { to: "/reports", label: "Reports", icon: "chart" },
    { to: "/documents", label: "Documents", icon: "folder" },
  ],
  admin: [
    { to: "/dashboard/admin", label: "Executive Dashboard", icon: "home", end: true },
    { to: "/stakeholders", label: "Stakeholder", icon: "building" },
    { to: "/documents", label: "MoU / MoA", icon: "file" },
    { to: "/activities", label: "Activities", icon: "calendar" },
    { to: "/exchange", label: "Student Exchange", icon: "graduation" },
    { to: "/feedback", label: "Feedback", icon: "message" },
    { to: "/reports", label: "Reports & Analytics", icon: "chart" },
    { to: "/users", label: "User Management", icon: "users" },
    { to: "/settings", label: "Settings", icon: "settings" },
  ],
};

/* ---- Context ---- */
interface RoleContextType {
  role: UserRole;
  setRole: (r: UserRole) => void;
  config: RoleConfig;
}

const RoleContext = createContext<RoleContextType>({
  role: "admin",
  setRole: () => {},
  config: ROLES[4],
});

const STORAGE_KEY = "pcsms_role";

export function RoleProvider({ children }: { children: ReactNode }) {
  const stored = (localStorage.getItem(STORAGE_KEY) as UserRole) ?? "admin";
  const [role, setRoleState] = useState<UserRole>(stored);

  const setRole = (r: UserRole) => {
    localStorage.setItem(STORAGE_KEY, r);
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
