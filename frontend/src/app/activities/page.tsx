"use client";

// Ported from legacy/figma-mock/src/pages/Activities.tsx (Next.js App Router + TU theme tokens).

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronRight,
  CalendarDays,
  Users,
  ArrowUpRight,
  MoreHorizontal,
} from "lucide-react";
import { activities, activityTypeColors } from "@/lib/mock";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

export default function ActivitiesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = activities.filter((a) => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.org.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || a.type === typeFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="text-faint hover:text-crimson">
              หน้าหลัก
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">กิจกรรม</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">กิจกรรม</h1>
          <p className="text-sm mt-0.5 text-faint">
            บริหารจัดการกิจกรรมและโครงการความร่วมมือ
          </p>
        </div>
        <button className="btn btn-primary gap-2">
          <Plus className="w-4 h-4" />
          เพิ่มกิจกรรม
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-line rounded-lg shadow-card p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="ค้นหากิจกรรม..."
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
            <option value="all">ประเภท: ทั้งหมด</option>
            {Object.keys(activityTypeColors).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 160 }}
          >
            <option>หน่วยงาน: ทั้งหมด</option>
          </select>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 140 }}
          >
            <option>ช่วงเวลา: ทั้งหมด</option>
          </select>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="เสร็จสิ้น">เสร็จสิ้น</option>
            <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
            <option value="วางแผน">วางแผน</option>
          </select>
        </div>
      </div>

      {/* Summary tags */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <span className="text-sm text-faint">{filtered.length} กิจกรรม</span>
        <span className="badge badge-green">
          เสร็จสิ้น: {activities.filter((a) => a.status === "เสร็จสิ้น").length}
        </span>
        <span className="badge badge-blue">
          กำลังดำเนินการ:{" "}
          {activities.filter((a) => a.status === "กำลังดำเนินการ").length}
        </span>
        <span className="badge badge-purple">
          วางแผน: {activities.filter((a) => a.status === "วางแผน").length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-[#F8FAFC]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">
                  ชื่อกิจกรรม
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  หน่วยงาน
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  ประเภท
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  วันที่
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  ผู้เข้าร่วม
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  MoU ที่เกี่ยวข้อง
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  สถานะ
                </th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#DBEAFE]">
                        <CalendarDays className="w-4 h-4 text-[#1D4ED8]" />
                      </div>
                      <Link
                        href={`/activities/${a.id}`}
                        className="text-sm font-semibold hover:underline text-ink"
                      >
                        {a.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-faint">{a.org}</td>
                  <td className="px-4 py-4">
                    <span className={activityTypeColors[a.type] ?? "badge-gray"}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-faint">{a.date}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="w-3.5 h-3.5 text-faint" />
                      <span className="font-semibold text-ink">
                        {a.participants}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {a.mouDocId !== undefined ? (
                      <Link
                        href={`/documents/${a.mouDocId}`}
                        className="text-xs font-medium hover:underline text-crimson"
                      >
                        {a.mou}
                      </Link>
                    ) : (
                      <span className="text-xs font-medium text-faint">
                        {a.mou}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${a.statusColor}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      <Link
                        href={`/activities/${a.id}`}
                        className="btn p-1.5 text-faint hover:bg-soft hover:text-ink"
                      >
                        <ArrowUpRight className="w-4 h-4" />
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
        {/* Pagination (mock) */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-line">
          <span className="text-sm text-faint">
            แสดง 1–{filtered.length} จาก {activities.length} กิจกรรม
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
