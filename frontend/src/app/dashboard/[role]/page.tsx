"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import DashboardPublic from "@/components/dashboards/DashboardPublic";
import DashboardStudent from "@/components/dashboards/DashboardStudent";
import DashboardTeacher from "@/components/dashboards/DashboardTeacher";
import DashboardStaff from "@/components/dashboards/DashboardStaff";
import DashboardAdmin from "@/components/dashboards/DashboardAdmin";
import { getRoleConfig, useRole } from "@/lib/role-context";

const VALID_ROLES = ["public", "student", "coordinator", "staff", "admin"] as const;
type Role = (typeof VALID_ROLES)[number];

const DASHBOARDS: Record<Role, () => React.JSX.Element> = {
  public: DashboardPublic,
  student: DashboardStudent,
  coordinator: DashboardTeacher,
  staff: DashboardStaff,
  admin: DashboardAdmin,
};

export default function RoleDashboardPage() {
  const params = useParams<{ role: string }>();
  const router = useRouter();
  const { role: sessionRole, status } = useRole();
  const role = params?.role;
  const valid = !!role && VALID_ROLES.includes(role as Role);
  // Role dashboards open only for that signed-in role; the public one is open to all.
  const allowed = role === "public" || (status === "authenticated" && sessionRole === role);

  useEffect(() => {
    if (!valid || allowed || status === "loading") return;
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(`/dashboard/${role}`)}`);
    else router.replace(getRoleConfig(sessionRole).dashboardPath);
  }, [valid, allowed, status, role, sessionRole, router]);

  if (!valid) notFound();
  if (!allowed) return <div className="p-8 text-sm text-faint">กำลังตรวจสอบสิทธิ์…</div>;

  const Dashboard = DASHBOARDS[role as Role];
  return <Dashboard />;
}
