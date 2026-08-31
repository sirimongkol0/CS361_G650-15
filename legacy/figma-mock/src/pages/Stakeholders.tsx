import { useState } from "react";
import { Link } from "react-router";
import { Search, Plus, Building2, Globe, ChevronRight, MoreHorizontal, Filter } from "lucide-react";

const organizations = [
  {
    id: 1,
    name: "มหาวิทยาลัยเชียงใหม่",
    type: "มหาวิทยาลัย",
    country: "ไทย",
    collab: "MoU",
    activities: 12,
    contact: "รศ.ดร.สมชาย ใจดี",
    status: "active",
    initials: "มช",
    bg: "#ede9fe",
    color: "#7c3aed",
    flag: "🇹🇭",
  },
  {
    id: 2,
    name: "National Taiwan University",
    type: "มหาวิทยาลัย",
    country: "ไต้หวัน",
    collab: "MoU + MoA",
    activities: 8,
    contact: "Prof. Wei-Lin Chen",
    status: "active",
    initials: "NTU",
    bg: "#dbeafe",
    color: "#1d4ed8",
    flag: "🇹🇼",
  },
  {
    id: 3,
    name: "University of Malaya",
    type: "มหาวิทยาลัย",
    country: "มาเลเซีย",
    collab: "MoU",
    activities: 5,
    contact: "Dr. Ahmad Razali",
    status: "active",
    initials: "UM",
    bg: "#dcfce7",
    color: "#16a34a",
    flag: "🇲🇾",
  },
  {
    id: 4,
    name: "บริษัท เทคโนโลยี จำกัด",
    type: "บริษัทเอกชน",
    country: "ไทย",
    collab: "MoA",
    activities: 7,
    contact: "คุณวิรัช พัฒนา",
    status: "expiring",
    initials: "TC",
    bg: "#fef3c7",
    color: "#d97706",
    flag: "🇹🇭",
  },
  {
    id: 5,
    name: "บริษัท ABC จำกัด",
    type: "บริษัทเอกชน",
    country: "ไทย",
    collab: "MoA",
    activities: 4,
    contact: "คุณศิริพร มั่งคั่ง",
    status: "active",
    initials: "ABC",
    bg: "#fce7f3",
    color: "#be185d",
    flag: "🇹🇭",
  },
  {
    id: 6,
    name: "Waseda University",
    type: "มหาวิทยาลัย",
    country: "ญี่ปุ่น",
    collab: "MoU",
    activities: 3,
    contact: "Prof. Takashi Yamamoto",
    status: "active",
    initials: "WU",
    bg: "#ffe4e6",
    color: "#e11d48",
    flag: "🇯🇵",
  },
  {
    id: 7,
    name: "สมาคมผู้ประกอบการ IT ไทย",
    type: "สมาคม/เครือข่าย",
    country: "ไทย",
    collab: "MoU",
    activities: 6,
    contact: "คุณประเสริฐ ดิจิทัล",
    status: "inactive",
    initials: "IT",
    bg: "#f1f5f9",
    color: "#475569",
    flag: "🇹🇭",
  },
  {
    id: 8,
    name: "Chulabhorn Research Institute",
    type: "สถาบันวิจัย",
    country: "ไทย",
    collab: "MoU + MoA",
    activities: 9,
    contact: "ดร.นิภา วิจัย",
    status: "active",
    initials: "CRI",
    bg: "#e0f2fe",
    color: "#0369a1",
    flag: "🇹🇭",
  },
];

const statusLabel: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "badge-green" },
  expiring: { label: "Expiring", cls: "badge-yellow" },
  inactive: { label: "Inactive", cls: "badge-gray" },
};

export default function Stakeholders() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = organizations.filter(o => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.contact.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || o.type === typeFilter;
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "#94a3b8" }}>
            <span>หน้าหลัก</span>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "#4f46e5" }}>หน่วยงานคู่ความร่วมมือ</span>
          </nav>
          <h1 className="text-2xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            หน่วยงานคู่ความร่วมมือ
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            จัดการข้อมูลหน่วยงานและ Stakeholder ที่เกี่ยวข้อง
          </p>
        </div>
        <button className="btn btn-primary gap-2">
          <Plus className="w-4 h-4" />
          เพิ่มหน่วยงาน
        </button>
      </div>

      {/* Filters */}
      <div className="content-card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
            <input
              className="input pl-9"
              placeholder="ค้นหาหน่วยงาน, ผู้ติดต่อ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" style={{ width: "auto", minWidth: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">ประเภทหน่วยงาน: ทั้งหมด</option>
            <option value="มหาวิทยาลัย">มหาวิทยาลัย</option>
            <option value="บริษัทเอกชน">บริษัทเอกชน</option>
            <option value="สมาคม/เครือข่าย">สมาคม/เครือข่าย</option>
            <option value="สถาบันวิจัย">สถาบันวิจัย</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 140 }}>
            <option>ประเทศ: ทั้งหมด</option>
            <option>ไทย</option>
            <option>ไต้หวัน</option>
            <option>มาเลเซีย</option>
            <option>ญี่ปุ่น</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span style={{ color: "#64748b" }}>แสดง {filtered.length} จาก {organizations.length} หน่วยงาน</span>
        <span className="badge badge-green">{organizations.filter(o => o.status === "active").length} Active</span>
        <span className="badge badge-yellow">{organizations.filter(o => o.status === "expiring").length} Expiring</span>
        <span className="badge badge-gray">{organizations.filter(o => o.status === "inactive").length} Inactive</span>
      </div>

      {/* Table */}
      <div className="content-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                <th className="text-left px-5 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>หน่วยงาน</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ประเภท</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ประเทศ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ประเภทความร่วมมือ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>กิจกรรม</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>ผู้ติดต่อ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold" style={{ color: "#64748b" }}>สถานะ</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(org => (
                <tr key={org.id} className="table-row-hover border-b" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="avatar" style={{ background: org.bg, color: org.color, fontSize: 11, width: 38, height: 38 }}>
                        {org.initials}
                      </div>
                      <div>
                        <Link to={`/stakeholders/${org.id}`} className="text-sm font-semibold hover:underline" style={{ color: "#1e293b" }}>
                          {org.name}
                        </Link>
                        <div className="text-xs" style={{ color: "#94a3b8" }}>{org.flag} {org.country}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge badge-indigo">{org.type}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm" style={{ color: "#64748b" }}>{org.flag} {org.country}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge badge-blue">{org.collab}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-semibold" style={{ color: "#1e293b" }}>{org.activities}</span>
                    <span className="text-xs ml-1" style={{ color: "#94a3b8" }}>กิจกรรม</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm" style={{ color: "#64748b" }}>{org.contact}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${statusLabel[org.status].cls}`}>{statusLabel[org.status].label}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link to={`/stakeholders/${org.id}`} className="btn btn-ghost p-1.5 text-xs">
                        ดูข้อมูล
                      </Link>
                      <button className="btn btn-ghost p-1.5">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm" style={{ color: "#64748b" }}>แสดง 1–{filtered.length} จาก {organizations.length} รายการ</span>
          <div className="flex gap-1">
            {[1, 2, 3].map(p => (
              <button key={p} className="btn text-xs px-3 py-1.5" style={{
                background: p === 1 ? "var(--primary)" : "var(--muted)",
                color: p === 1 ? "#fff" : "#64748b"
              }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
