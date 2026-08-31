"use client";

import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import DashboardPublic from "@/components/dashboards/DashboardPublic";
import DashboardStudent from "@/components/dashboards/DashboardStudent";
import DashboardTeacher from "@/components/dashboards/DashboardTeacher";
import DashboardStaff from "@/components/dashboards/DashboardStaff";
import DashboardAdmin from "@/components/dashboards/DashboardAdmin";

const VALID_ROLES = ["public", "student", "teacher", "staff", "admin"] as const;
type Role = (typeof VALID_ROLES)[number];

const DASHBOARDS: Record<Role, () => React.JSX.Element> = {
  public: DashboardPublic,
  student: DashboardStudent,
  teacher: DashboardTeacher,
  staff: DashboardStaff,
  admin: DashboardAdmin,
};

export default function RoleDashboardPage() {
  const params = useParams<{ role: string }>();
  const role = params?.role;

  if (!role || !VALID_ROLES.includes(role as Role)) {
    notFound();
  }

  const Dashboard = DASHBOARDS[role as Role];
  return <Dashboard />;
}
