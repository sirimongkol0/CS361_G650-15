import { useState } from "react";
import { Link } from "react-router";
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
    ]
  },
  {
    module: "เอกสารข้อตกลง",
    perms: [
      { role: "public", view: false, create: false, edit: false, delete: false, export: false },
      { role: "student", view: false, create: false, edit: false, delete: false, export: false },
      { role: "coordinator", view: true, create: false, edit: false, delete: false, export: false },
      { role: "staff", view: true, create: true, edit: true, delete: false, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ]
  },
  {
    module: "กิจกรรม",
    perms: [
      { role: "public", view: true, create: false, edit: false, delete: false, export: false },
      { role: "student", view: true, create: false, edit: false, delete: false, export: false },
      { role: "coordinator", view: true, create: true, edit: true, delete: false, export: true },
      { role: "staff", view: true, create: true, edit: true, delete: true, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ]
  },
  {
    module: "นักศึกษาแลกเปลี่ยน",
    perms: [
      { role: "public", view: false, create: false, edit: false, delete: false, export: false },
      { role: "student", view: true, create: false, edit: true, delete: false, export: false },
      { role: "coordinator", view: true, create: true, edit: true, delete: false, export: true },
      { role: "staff", view: true, create: true, edit: true, delete: false, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ]
  },
  {
    module: "Feedback",
    perms: [
      { role: "public", view: false, create: true, edit: false, delete: false, export: false },
      { role: "student", view: false, create: true, edit: true, delete: false, export: false },
      { role: "coordinator", view: true, create: true, edit: true, delete: false, export: true },
      { role: "staff", view: true, create: true, edit: true, delete: true, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ]
  },
  {
    module: "รายงานและสถิติ",
    perms: [
      { role: "public", view: false, create: false, edit: false, delete: false, export: false },
      { role: "student", view: false, create: false, edit: false, delete: false, export: false },
      { role: "coordinator", view: true, create: false, edit: false, delete: false, export: false },
      { role: "staff", view: true, create: false, edit: false, delete: false, export: true },
      { role: "admin", view: true, create: true, edit: true, delete: true, export: true },
    ]
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
      {val
        ? <Check className="w-4 h-4 mx-auto" style={{ color: "#16a34a" }} />
        : <X className="w-4 h-4 mx-auto" style={{ color: "#e2e8f0" }} />
      }
    </td>
  );
}

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState("matrix");

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "#94a3b8" }}>
            <Link to="/" style={{ color: "#94a3b8" }}>หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "#4f46e5" }}>จัดการผู้ใช้และสิทธิ์</span>
          </nav>
          <h1 className="text-2xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>จัดการผู้ใช้และสิทธิ์</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>Role-based Access Control (RBAC)</p>
        </div>
        <button className="btn btn-primary gap-2"><Plus className="w-4 h-4" />เพิ่มผู้ใช้</button>
      </div>

      {/* Role cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {roles.map(r => (
          <div key={r.id} className="stat-card">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: r.bg }}>
              <Shield className="w-4 h-4" style={{ color: r.color }} />
            </div>
            <div className="font-bold text-sm mb-0.5" style={{ color: "#1e293b" }}>{r.label}</div>
            <div className="text-xs" style={{ color: "#64748b" }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: "var(--border)" }}>
        {[
          { id: "matrix", label: "Permissions Matrix" },
          { id: "users", label: "รายชื่อผู้ใช้" },
        ].map(t => (
          <button key={t.id} className={`tab-btn ${activeTab===t.id?"active":""}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "matrix" && (
        <div className="content-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>โมดูล</th>
                  {["ผู้ใช้ทั่วไป", "นักศึกษา", "อาจารย์/ผู้ประสานงาน", "เจ้าหน้าที่", "ผู้บริหาร"].map(r => (
                    <th key={r} colSpan={5} className="text-center px-2 py-3.5 text-xs font-semibold border-l" style={{ color: "#64748b", borderColor: "var(--border)" }}>
                      {r}
                    </th>
                  ))}
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "#fafafa" }}>
                  <th className="px-5 py-2" />
                  {[0,1,2,3,4].map(ri => (
                    ["ดู","สร้าง","แก้ไข","ลบ","Export"].map(p => (
                      <th key={`${ri}-${p}`} className="text-center px-1 py-2 text-xs border-l" style={{ color: "#94a3b8", fontWeight: 500, borderColor: p==="ดู"?"var(--border)":"transparent" }}>
                        {p}
                      </th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((mod, mi) => (
                  <tr key={mi} className="border-b" style={{ borderColor: "#f1f5f9" }}>
                    <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: "#1e293b" }}>{mod.module}</td>
                    {mod.perms.map((p, pi) => (
                      <>
                        <TCell key={`${pi}-v`} val={p.view} />
                        <TCell key={`${pi}-c`} val={p.create} />
                        <TCell key={`${pi}-e`} val={p.edit} />
                        <TCell key={`${pi}-d`} val={p.delete} />
                        <TCell key={`${pi}-x`} val={p.export} />
                      </>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="content-card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
              <input className="input pl-9" placeholder="ค้นหาผู้ใช้..." />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ผู้ใช้</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>อีเมล</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>บทบาท</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>เข้าสู่ระบบล่าสุด</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>สถานะ</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const role = roles.find(r => r.id === u.role)!;
                  return (
                    <tr key={i} className="table-row-hover border-b" style={{ borderColor: "#f1f5f9" }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="avatar" style={{ background: role.bg, color: role.color }}>{u.name[0]}</div>
                          <span className="font-semibold text-sm" style={{ color: "#1e293b" }}>{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm" style={{ color: "#64748b" }}>{u.email}</td>
                      <td className="px-4 py-4">
                        <span className="badge" style={{ background: role.bg, color: role.color }}>{role.label}</span>
                      </td>
                      <td className="px-4 py-4 text-sm" style={{ color: "#64748b" }}>{u.lastLogin}</td>
                      <td className="px-4 py-4"><span className="badge badge-green">Active</span></td>
                      <td className="px-4 py-4">
                        <button className="btn btn-ghost p-1.5"><MoreHorizontal className="w-4 h-4" /></button>
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
