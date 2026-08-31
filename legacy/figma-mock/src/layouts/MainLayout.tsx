import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard, Building2, FileText, CalendarDays, GraduationCap,
  MessageSquare, BarChart3, Settings, LogOut, Menu, Bell, Search,
  Users, Shield, Globe, Folder, User, ChevronRight,
} from "lucide-react";
import { useRole, ROLE_NAV, UserRole, getRoleConfig } from "../context/RoleContext";

/* Map icon string → Lucide component */
const ICON_MAP: Record<string, React.ElementType> = {
  home:       LayoutDashboard,
  building:   Building2,
  file:       FileText,
  calendar:   CalendarDays,
  graduation: GraduationCap,
  message:    MessageSquare,
  chart:      BarChart3,
  settings:   Settings,
  users:      Users,
  shield:     Shield,
  globe:      Globe,
  folder:     Folder,
  user:       User,
};

const ROLE_LABEL: Record<UserRole, { short: string; color: string; bg: string }> = {
  public:  { short: "ทั่วไป",     color: "#4B5563", bg: "#F3F4F6" },
  student: { short: "นักศึกษา",   color: "#1D4ED8", bg: "#DBEAFE" },
  teacher: { short: "อาจารย์",    color: "#15803D", bg: "#DCFCE7" },
  staff:   { short: "เจ้าหน้าที่", color: "#7C3AED", bg: "#EDE9FE" },
  admin:   { short: "ผู้บริหาร",  color: "#8B1538", bg: "#F5D6DE" },
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { role, config, setRole } = useRole();
  const navItems = ROLE_NAV[role];
  const roleLabel = ROLE_LABEL[role];

  const handleLogout = () => {
    navigate("/login");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TU colour strip */}
      <div className="h-1 tu-stripe flex-shrink-0" />

      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #8B1538, #B8243E)" }}
        >
          <Globe className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div
              className="font-extrabold text-sm leading-tight"
              style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              PCSMS
            </div>
            <div className="text-xs leading-tight" style={{ color: "#9CA3AF" }}>
              Collaboration &amp; Stakeholder
            </div>
          </div>
        )}
      </div>

      {/* Role indicator (expanded only) */}
      {!collapsed && (
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "#FAFAFA" }}>
          <div className="text-xs font-semibold mb-1" style={{ color: "#9CA3AF" }}>
            ประเภทผู้ใช้
          </div>
          <div className="flex items-center justify-between">
            <span
              className="role-pill"
              style={{ color: roleLabel.color, background: roleLabel.bg }}
            >
              <Shield className="w-3 h-3" />
              {roleLabel.short}
            </span>
            {/* Quick role switcher for prototype */}
            <select
              className="text-xs border rounded px-1.5 py-0.5 cursor-pointer"
              style={{ borderColor: "var(--border)", color: "#6B7280", fontSize: 11 }}
              value={role}
              onChange={(e) => {
                const r = e.target.value as UserRole;
                setRole(r);
                navigate(getRoleConfig(r).dashboardPath);
              }}
            >
              {[
                { value: "public", label: "ทั่วไป" },
                { value: "student", label: "นักศึกษา" },
                { value: "teacher", label: "อาจารย์" },
                { value: "staff", label: "เจ้าหน้าที่" },
                { value: "admin", label: "ผู้บริหาร" },
              ].map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav
        className="flex-1 px-3 py-3 overflow-y-auto"
        style={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {navItems.map(({ to, icon, label, end }) => {
          const Icon = ICON_MAP[icon] ?? LayoutDashboard;
          return (
            <NavLink
              key={`${to}-${label}`}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              title={collapsed ? label : undefined}
            >
              <Icon className="sidebar-icon" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        {collapsed ? (
          <div
            className="avatar mx-auto cursor-pointer"
            style={{ background: roleLabel.bg, color: roleLabel.color, width: 36, height: 36 }}
            onClick={handleLogout}
          >
            A
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className="avatar flex-shrink-0"
              style={{ background: roleLabel.bg, color: roleLabel.color, width: 34, height: 34, fontSize: 13 }}
            >
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
                Admin
              </div>
              <div className="text-xs truncate" style={{ color: "#9CA3AF" }}>
                {config.label}
              </div>
            </div>
            <button
              className="btn btn-ghost p-1.5 flex-shrink-0"
              onClick={handleLogout}
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 border-r transition-all duration-200 overflow-hidden"
        style={{
          width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)",
          borderColor: "var(--border)",
          background: "#fff",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar — mobile drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col md:hidden border-r transition-transform duration-200"
        style={{
          width: "var(--sidebar-width)",
          borderColor: "var(--border)",
          background: "#fff",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center gap-3 px-4 md:px-5 border-b bg-white flex-shrink-0"
          style={{ height: "var(--header-height)", borderColor: "var(--border)" }}
        >
          <button
            className="btn btn-ghost p-1.5"
            onClick={() => {
              setCollapsed((c) => !c);
              setMobileOpen((o) => !o);
            }}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
              <input
                className="input pl-9 text-sm"
                placeholder="ค้นหา..."
                style={{ height: 34, background: "#F9FAFB" }}
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Role badge in header */}
          <span
            className="role-pill hidden sm:inline-flex"
            style={{ color: roleLabel.color, background: roleLabel.bg, fontSize: 11 }}
          >
            <Shield className="w-3 h-3" />
            {roleLabel.short}
          </span>

          <button className="btn btn-ghost p-1.5 relative">
            <Bell className="w-5 h-5" />
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ background: "#8B1538" }}
            />
          </button>

          <div
            className="flex items-center gap-2 pl-2 border-l"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="avatar"
              style={{
                background: roleLabel.bg,
                color: roleLabel.color,
                width: 30,
                height: 30,
                fontSize: 12,
              }}
            >
              A
            </div>
            <span className="text-sm font-semibold hidden sm:block">Admin</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
