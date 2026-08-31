import { createBrowserRouter, Navigate } from "react-router";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stakeholders from "./pages/Stakeholders";
import StakeholderDetail from "./pages/StakeholderDetail";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import Activities from "./pages/Activities";
import ActivityDetail from "./pages/ActivityDetail";
import StudentExchange from "./pages/StudentExchange";
import Feedback from "./pages/Feedback";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";
import Settings from "./pages/Settings";

// Role-specific dashboards
import DashboardPublic from "./pages/dashboards/DashboardPublic";
import DashboardStudent from "./pages/dashboards/DashboardStudent";
import DashboardTeacher from "./pages/dashboards/DashboardTeacher";
import DashboardStaff from "./pages/dashboards/DashboardStaff";
import DashboardAdmin from "./pages/dashboards/DashboardAdmin";

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, element: <Navigate to="/dashboard/admin" replace /> },

      // Role-specific dashboards
      { path: "dashboard/public",  Component: DashboardPublic },
      { path: "dashboard/student", Component: DashboardStudent },
      { path: "dashboard/teacher", Component: DashboardTeacher },
      { path: "dashboard/staff",   Component: DashboardStaff },
      { path: "dashboard/admin",   Component: DashboardAdmin },

      // Shared pages (access controlled by sidebar/role)
      { path: "stakeholders",      Component: Stakeholders },
      { path: "stakeholders/:id",  Component: StakeholderDetail },
      { path: "documents",         Component: Documents },
      { path: "documents/:id",     Component: DocumentDetail },
      { path: "activities",        Component: Activities },
      { path: "activities/:id",    Component: ActivityDetail },
      { path: "exchange",          Component: StudentExchange },
      { path: "feedback",          Component: Feedback },
      { path: "reports",           Component: Reports },
      { path: "users",             Component: UserManagement },
      { path: "settings",          Component: Settings },

      // Student-only
      { path: "my-projects",       Component: DashboardStudent },
      { path: "profile",           Component: Settings },
    ],
  },
]);
