"use client";

// Admin-only account list (GET /users/). Accounts and roles live in Amazon Cognito;
// a row appears here after the account's first login, so this page only reads.

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Shield } from "lucide-react";
import { formatThaiDateTime, loadUsers, useApiResource, type UserAccount } from "@/lib/api";
import { ROLES, getRoleConfig, useRole, type UserRole } from "@/lib/role-context";
import { AccessState, EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { matchesQuery, useDocumentTitle } from "@/lib/list-tools";

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  public: "ดูข้อมูลที่เผยแพร่",
  student: "ดูข้อมูลการแลกเปลี่ยนของตัวเอง",
  coordinator: "เพิ่มและแก้ไขรายการของตัวเอง",
  staff: "อนุมัติ เผยแพร่ และดูแลข้อมูลทั้งหมด",
  admin: "ทุกอย่างของเจ้าหน้าที่ และดูรายชื่อผู้ใช้",
};

// ✓ = all records, "own" = only records the account created, false = not allowed.
// Mirrors the require_role checks in backend/routers (docs/decisions/v3-role-permissions.md).
type Allowed = boolean | "own";
const PERMISSIONS: { action: string; roles: Record<UserRole, Allowed> }[] = [
  { action: "ดูหน่วยงาน ข้อตกลง และกิจกรรมที่เผยแพร่", roles: { public: true, student: true, coordinator: true, staff: true, admin: true } },
  { action: "ดูรายการที่ยังไม่เผยแพร่", roles: { public: false, student: false, coordinator: "own", staff: true, admin: true } },
  { action: "เพิ่มและแก้ไขหน่วยงาน", roles: { public: false, student: false, coordinator: "own", staff: true, admin: true } },
  { action: "สร้างและแก้ไขข้อตกลงฉบับร่าง แนบไฟล์", roles: { public: false, student: false, coordinator: "own", staff: true, admin: true } },
  { action: "อนุมัติ เปลี่ยนสถานะ และเผยแพร่ข้อตกลง", roles: { public: false, student: false, coordinator: false, staff: true, admin: true } },
  { action: "เพิ่มและแก้ไขกิจกรรม", roles: { public: false, student: false, coordinator: "own", staff: true, admin: true } },
  { action: "ข้อมูลนักศึกษาแลกเปลี่ยน", roles: { public: false, student: "own", coordinator: "own", staff: true, admin: true } },
  { action: "ลบหน่วยงาน กิจกรรม และข้อตกลง", roles: { public: false, student: false, coordinator: false, staff: true, admin: true } },
  { action: "ดูรายชื่อผู้ใช้", roles: { public: false, student: false, coordinator: false, staff: false, admin: true } },
];

function PermissionCell({ value }: { value: Allowed }) {
  if (value === "own") return <td className="px-3 py-3 text-center text-xs text-[#1d4ed8]">ของตัวเอง</td>;
  return (
    <td className="px-3 py-3 text-center">
      {value ? <span className="text-[#16a34a]" aria-label="ทำได้">✓</span> : <span className="text-[#cbd5e1]" aria-label="ทำไม่ได้">—</span>}
    </td>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const config = getRoleConfig(role);
  return <span className="badge" style={{ background: config.pillBg, color: config.pillColor }}>{config.label}</span>;
}

export default function UserManagementPage() {
  useDocumentTitle("ผู้ใช้และสิทธิ์");
  const { role, status: session } = useRole();
  const [activeTab, setActiveTab] = useState<"users" | "matrix">("users");
  const [query, setQuery] = useState("");

  const allowed = session === "authenticated" && role === "admin";
  const users = useApiResource<UserAccount[]>(
    () => (allowed ? loadUsers() : new Promise<never>(() => {})),
    [allowed]
  );

  if (session === "loading") return <div className="p-6"><LoadingState /></div>;
  if (session !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (role !== "admin") return <div className="p-6"><AccessState status={403} /></div>;

  const rows = users.status === "success" ? users.data : [];
  const filtered = rows.filter((u) => matchesQuery(query, u.email, getRoleConfig(u.role).label));
  const countByRole = (id: UserRole) => rows.filter((u) => u.role === id).length;

  const tabCls = (t: string) =>
    `px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
      activeTab === t
        ? "text-crimson border-crimson font-semibold"
        : "text-faint border-transparent hover:text-ink hover:bg-soft rounded-t-md"
    }`;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
          <Link href="/" className="text-faint hover:text-crimson">หน้าหลัก</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-crimson">ผู้ใช้และสิทธิ์</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink font-display">ผู้ใช้และสิทธิ์</h1>
        <p className="text-sm mt-0.5 text-faint">
          เพิ่มบัญชีและเปลี่ยนบทบาทได้ที่ Amazon Cognito รายชื่อนี้แสดงบัญชีที่เข้าสู่ระบบแล้วอย่างน้อยหนึ่งครั้ง
        </p>
      </div>

      {/* Role cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {ROLES.map((r) => (
          <div key={r.id} className="bg-white border border-line rounded-lg shadow-card p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: r.pillBg }}>
                <Shield className="w-4 h-4" style={{ color: r.pillColor }} />
              </div>
              <span className="text-lg font-bold text-ink font-display">{users.status === "success" ? countByRole(r.id) : "—"}</span>
            </div>
            <div className="font-bold text-sm mb-0.5 text-ink">{r.label}</div>
            <div className="text-xs text-faint">{ROLE_DESCRIPTIONS[r.id]}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line mb-5">
        {([
          { id: "users", label: "รายชื่อผู้ใช้" },
          { id: "matrix", label: "สิทธิ์ตามบทบาท" },
        ] as const).map((t) => (
          <button key={t.id} type="button" className={tabCls(t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        users.status === "loading" ? <LoadingState title="กำลังโหลดรายชื่อผู้ใช้…" /> :
        users.status === "error" ? <ErrorState error={users.error} onRetry={users.retry} /> :
        rows.length === 0 ? <EmptyState title="ยังไม่มีผู้ใช้" message="บัญชีจะแสดงที่นี่หลังเข้าสู่ระบบครั้งแรก" /> : (
        <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
          <div className="p-4 border-b border-line">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
              <input
                className="w-full rounded-lg border-[1.5px] border-line bg-white pl-9 pr-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10"
                placeholder="ค้นหาอีเมลหรือบทบาท"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="ค้นหาผู้ใช้"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-[#F8FAFC]">
                  {["อีเมล", "บทบาท", "เข้าสู่ระบบล่าสุด", "เข้าสู่ระบบครั้งแรก", "สถานะ"].map((h) => (
                    <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-faint whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-[#f1f5f9] hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-4 text-sm font-semibold text-ink">{u.email}</td>
                    <td className="px-4 py-4"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-4 text-sm text-faint whitespace-nowrap">{formatThaiDateTime(u.lastLoginAt)}</td>
                    <td className="px-4 py-4 text-sm text-faint whitespace-nowrap">{formatThaiDateTime(u.createdAt)}</td>
                    <td className="px-4 py-4">
                      {u.isActive
                        ? <span className="badge badge-green">ใช้งานได้</span>
                        : <span className="badge badge-gray">ปิดใช้งาน</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-faint">ไม่พบผู้ใช้ที่ตรงกับคำค้นหา</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )
      )}

      {activeTab === "matrix" && (
        <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">การทำงาน</th>
                  {ROLES.map((r) => (
                    <th key={r.id} className="text-center px-3 py-3.5 text-xs font-semibold text-faint whitespace-nowrap">{r.labelShort}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.action} className="border-b border-[#f1f5f9]">
                    <td className="px-5 py-3 text-sm text-ink">{p.action}</td>
                    {ROLES.map((r) => <PermissionCell key={r.id} value={p.roles[r.id]} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
