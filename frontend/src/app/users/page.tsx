"use client";

// Ported from legacy/figma-mock/src/pages/UserManagement.tsx (Next.js App Router + TU theme tokens).

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search, Shield, Check, X, MoreHorizontal } from "lucide-react";

const roles = [
  { id: "public", label: "ผู้ใช้ทั่วไป", color: "#94a3b8", bg: "#f1f5f9", desc: "ดูข้อมูลสาธารณะ" },
  { id: "student", label: "นักศึกษา/ผู้เข้าร่วม", color: "#16a34a", bg: "#dcfce7", desc: "ดูและจัดการข้อมูลตัวเอง" },
  { id: "coordinator", label: "อาจารย์/ผู้ประสานงาน", color: "#1d4ed8", bg: "#dbeafe", desc: "จัดการกิจกรรมและ Feedback" },
  { id: "staff", label: "เจ้าหน้าที่หลักสูตร", color: "#7c3aed", bg: "#ede9fe", desc: "จัดการข้อมูลและรายงาน" },
  { id: "admin", label: "ผู้บริหาร/ผู้ดูแลระบบ", color: "#dc2626", bg: "#fee2e2", desc: "สิทธิ์เต็ม" },
];

const permissions = [
  {
    module: "หน่วยงานคู่ความร่วมมือ",
    perms: [
      { role: "public", view: true, create: false, edit: false, delete: false, export: false },
      { role: "student", view: true, create: false, edit: false, delete: false, export: false },
      { role: "coordinator", view: true, create: true, edit: true, delete: false, export: true },
      { role: "staff", view: true, create: true, edit: true, delete: false, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ],
  },
  {
    module: "เอกสารข้อตกลง",
    perms: [
      { role: "public", view: false, create: false, edit: false, delete: false, export: false },
      { role: "student", view: false, create: false, edit: false, delete: false, export: false },
      { role: "coordinator", view: true, create: false, edit: false, delete: false, export: false },
      { role: "staff", view: true, create: true, edit: true, delete: false, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ],
  },
  {
    module: "กิจกรรม",
    perms: [
      { role: "public", view: true, create: false, edit: false, delete: false, export: false },
      { role: "student", view: true, create: false, edit: false, delete: false, export: false },
      { role: "coordinator", view: true, create: true, edit: true, delete: false, export: true },
      { role: "staff", view: true, create: true, edit: true, delete: true, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ],
  },
  {
    module: "นักศึกษาแลกเปลี่ยน",
    perms: [
      { role: "public", view: false, create: false, edit: false, delete: false, export: false },
      { role: "student", view: true, create: false, edit: true, delete: false, export: false },
      { role: "coordinator", view: true, create: true, edit: true, delete: false, export: true },
      { role: "staff", view: true, create: true, edit: true, delete: false, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ],
  },
  {
    module: "Feedback",
    perms: [
      { role: "public", view: false, create: true, edit: false, delete: false, export: false },
      { role: "student", view: false, create: true, edit: true, delete: false, export: false },
      { role: "coordinator", view: true, create: true, edit: true, delete: false, export: true },
      { role: "staff", view: true, create: true, edit: true, delete: true, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ],
  },
  {
    module: "รายงานและสถิติ",
    perms: [
      { role: "public", view: false, create: false, edit: false, delete: false, export: false },
      { role: "student", view: false, create: false, edit: false, delete: false, export: false },
      { role: "coordinator", view: true, create: false, edit: false, delete: false, export: false },
      { role: "staff", view: true, create: false, edit: false, delete: false, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ],
  },
];

const users = [
  { name: "Admin System", email: "admin@university.ac.th", role: "admin", lastLogin: "วันนี้ 09:15" },
  { name: "ผศ.ดร.วิชัย สอนดี", email: "wichai@university.ac.th", role: "coordinator", lastLogin: "เมื่อวาน 14:30" },
  { name: "นางสมหมาย จัดการ", email: "sommai@university.ac.th", role: "staff", lastLogin: "วันนี้ 10:00" },
  { name: "นายสมศักดิ์ ใจดี", email: "somsak@student.ac.th", role: "student", lastLogin: "3 วันที่แล้ว" },
];

function TCell({ val }: { val: boolean }) {
  return (
    <td className="px-3 py-3 text-center">
      {val ? (
        <Check className="w-4 h-4 mx-auto text-[#16a34a]" />
      ) : (
        <X className="w-4 h-4 mx-auto text-[#e2e8f0]" />
      )}
    </td>
  );
}

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState("matrix");

  const tabCls = (t: string) =>
    `px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
      activeTab === t
        ? "text-crimson border-crimson font-semibold"
        : "text-faint border-transparent hover:text-ink hover:bg-soft rounded-t-md"
    }`;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="text-faint hover:text-crimson">หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">จัดการผู้ใช้และสิทธิ์</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">จัดการผู้ใช้และสิทธิ์</h1>
          <p className="text-sm mt-0.5 text-faint">Role-based Access Control (RBAC)</p>
        </div>
        <button className="btn btn-primary gap-2">
          <Plus className="w-4 h-4" />เพิ่มผู้ใช้
        </button>
      </div>

      {/* Role cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {roles.map((r) => (
          <div
            key={r.id}
            className="bg-white border border-line rounded-lg shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: r.bg }}>
              <Shield className="w-4 h-4" style={{ color: r.color }} />
            </div>
            <div className="font-bold text-sm mb-0.5 text-ink">{r.label}</div>
            <div className="text-xs text-faint">{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line mb-5">
        {[
          { id: "matrix", label: "Permissions Matrix" },
          { id: "users", label: "รายชื่อผู้ใช้" },
        ].map((t) => (
          <button key={t.id} className={tabCls(t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "matrix" && (
        <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">โมดูล</th>
                  {["ผู้ใช้ทั่วไป", "นักศึกษา", "อาจารย์/ผู้ประสานงาน", "เจ้าหน้าที่", "ผู้บริหาร"].map((r) => (
                    <th
                      key={r}
                      colSpan={5}
                      className="text-center px-2 py-3.5 text-xs font-semibold border-l border-line text-faint"
                    >
                      {r}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-line bg-[#FAFAFA]">
                  <th className="px-5 py-2" />
                  {[0, 1, 2, 3, 4].map((ri) =>
                    ["ดู", "สร้าง", "แก้ไข", "ลบ", "Export"].map((p) => (
                      <th
                        key={`${ri}-${p}`}
                        className={`text-center px-1 py-2 text-xs border-l font-medium text-faint ${
                          p === "ดู" ? "border-line" : "border-transparent"
                        }`}
                      >
                        {p}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {permissions.map((mod, mi) => (
                  <tr key={mi} className="border-b border-[#f1f5f9]">
                    <td className="px-5 py-3.5 text-sm font-semibold text-ink">{mod.module}</td>
                    {mod.perms.map((p, pi) => (
                      <Fragment key={`${pi}-${p.role}`}>
                        <TCell val={p.view} />
                        <TCell val={p.create} />
                        <TCell val={p.edit} />
                        <TCell val={p.delete} />
                        <TCell val={p.export} />
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
          <div className="p-4 border-b border-line">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
              <input
                className="w-full rounded-lg border-[1.5px] border-line bg-white pl-9 pr-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10"
                placeholder="ค้นหาผู้ใช้..."
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">ผู้ใช้</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">อีเมล</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">บทบาท</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">เข้าสู่ระบบล่าสุด</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">สถานะ</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const role = roles.find((r) => r.id === u.role)!;
                  return (
                    <tr
                      key={i}
                      className="border-b border-[#f1f5f9] hover:bg-[#FAFAFA] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex items-center justify-center rounded-full font-bold text-sm shrink-0 w-9 h-9"
                            style={{ background: role.bg, color: role.color }}
                          >
                            {u.name[0]}
                          </div>
                          <span className="font-semibold text-sm text-ink">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-faint">{u.email}</td>
                      <td className="px-4 py-4">
                        <span className="badge" style={{ background: role.bg, color: role.color }}>
                          {role.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-faint">{u.lastLogin}</td>
                      <td className="px-4 py-4">
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td className="px-4 py-4">
                        <button className="btn p-1.5 text-faint hover:bg-soft hover:text-ink">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
