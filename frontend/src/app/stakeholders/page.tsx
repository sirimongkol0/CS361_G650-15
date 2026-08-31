"use client";

// Ported from legacy/figma-mock/src/pages/Stakeholders.tsx (Next.js App Router + TU theme tokens).

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, ChevronRight, MoreHorizontal } from "lucide-react";
import { stakeholderOrganizations } from "./data";

const statusLabel: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "badge-green" },
  expiring: { label: "Expiring", cls: "badge bg-[#FEF3C7] text-[#B45309]" },
  inactive: { label: "Inactive", cls: "badge-gray" },
};

const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

export default function StakeholdersPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(
    () =>
      stakeholderOrganizations.filter((o) => {
        const matchSearch =
          o.name.toLowerCase().includes(search.toLowerCase()) ||
          o.contact.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === "all" || o.type === typeFilter;
        const matchStatus = statusFilter === "all" || o.status === statusFilter;
        return matchSearch && matchType && matchStatus;
      }),
    [search, typeFilter, statusFilter]
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <span>หน้าหลัก</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">หน่วยงานคู่ความร่วมมือ</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">
            หน่วยงานคู่ความร่วมมือ
          </h1>
          <p className="text-sm mt-0.5 text-faint">
            จัดการข้อมูลหน่วยงานและ Stakeholder ที่เกี่ยวข้อง
          </p>
        </div>
        <button className="btn btn-primary gap-2">
          <Plus className="w-4 h-4" />
          เพิ่มหน่วยงาน
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-line rounded-lg shadow-card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint"
            />
            <input
              className={`${inputCls} pl-9`}
              placeholder="ค้นหาหน่วยงาน, ผู้ติดต่อ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 160 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">ประเภทหน่วยงาน: ทั้งหมด</option>
            <option value="มหาวิทยาลัย">มหาวิทยาลัย</option>
            <option value="บริษัทเอกชน">บริษัทเอกชน</option>
            <option value="สมาคม/เครือข่าย">สมาคม/เครือข่าย</option>
            <option value="สถาบันวิจัย">สถาบันวิจัย</option>
          </select>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 140 }}
          >
            <option>ประเทศ: ทั้งหมด</option>
            <option>ไทย</option>
            <option>ไต้หวัน</option>
            <option>มาเลเซีย</option>
            <option>ญี่ปุ่น</option>
          </select>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-faint">
          แสดง {filtered.length} จาก {stakeholderOrganizations.length} หน่วยงาน
        </span>
        <span className="badge badge-green">
          {stakeholderOrganizations.filter((o) => o.status === "active").length}{" "}
          Active
        </span>
        <span className="badge bg-[#FEF3C7] text-[#B45309]">
          {stakeholderOrganizations.filter((o) => o.status === "expiring").length}{" "}
          Expiring
        </span>
        <span className="badge badge-gray">
          {stakeholderOrganizations.filter((o) => o.status === "inactive").length}{" "}
          Inactive
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-[#F8FAFC]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">หน่วยงาน</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ประเภท</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ประเทศ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ประเภทความร่วมมือ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">กิจกรรม</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">ผู้ติดต่อ</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">สถานะ</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center rounded-full font-bold shrink-0"
                        style={{
                          background: org.bg,
                          color: org.color,
                          fontSize: 11,
                          width: 38,
                          height: 38,
                        }}
                      >
                        {org.initials}
                      </div>
                      <div>
                        <Link
                          href={`/stakeholders/${org.id}`}
                          className="text-sm font-semibold hover:underline text-ink"
                        >
                          {org.name}
                        </Link>
                        <div className="text-xs text-faint">
                          {org.flag} {org.country}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge bg-[#E0E7FF] text-[#4338CA]">{org.type}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-faint">
                      {org.flag} {org.country}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge badge-blue">{org.collab}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-semibold text-ink">{org.activities}</span>
                    <span className="text-xs ml-1 text-faint">กิจกรรม</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-faint">{org.contact}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${statusLabel[org.status].cls}`}>
                      {statusLabel[org.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/stakeholders/${org.id}`}
                        className="btn p-1.5 text-xs text-faint hover:bg-soft hover:text-ink"
                      >
                        ดูข้อมูล
                      </Link>
                      <button className="btn p-1.5 text-faint hover:bg-soft hover:text-ink">
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
        <div className="flex items-center justify-between px-5 py-4 border-t border-line">
          <span className="text-sm text-faint">
            แสดง 1–{filtered.length} จาก {stakeholderOrganizations.length} รายการ
          </span>
          <div className="flex gap-1">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                className="btn text-xs px-3 py-1.5"
                style={{
                  background: p === 1 ? "var(--primary)" : "var(--muted)",
                  color: p === 1 ? "#fff" : "#64748b",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
