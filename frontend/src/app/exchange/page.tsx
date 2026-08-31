"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronRight,
  GraduationCap,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { exchangeStudents as mockExchangeStudents } from "@/lib/mock";
import { loadExchangeStudents, useApiData } from "@/lib/api";

type ExchangeStudent = (typeof mockExchangeStudents)[number];

const statusColors: Record<string, string> = {
  "เสร็จสิ้น": "badge-green",
  "กำลังดำเนินการ": "badge-blue",
  "กำลังสมัคร": "badge-gold",
  "วางแผน": "badge-purple",
};

export default function StudentExchangePage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // API-first with mock.ts as fallback (initial render uses mock until API resolves).
  const exchangeStudents = useApiData(loadExchangeStudents, mockExchangeStudents);

  const filtered = useMemo(
    () =>
      exchangeStudents.filter((s: ExchangeStudent) => {
        const matchSearch =
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.to.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === "all" || s.type === typeFilter;
        const matchStatus = statusFilter === "all" || s.status === statusFilter;
        return matchSearch && matchType && matchStatus;
      }),
    [search, typeFilter, statusFilter, exchangeStudents]
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="text-faint hover:text-crimson">
              หน้าหลัก
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">นักศึกษาแลกเปลี่ยน</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">
            นักศึกษาแลกเปลี่ยน
          </h1>
          <p className="text-sm mt-0.5 text-faint">
            บริหารจัดการโครงการแลกเปลี่ยนนักศึกษา
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline gap-2 text-sm">
            <Filter className="w-4 h-4" />
            ส่งออก
          </button>
          <button className="btn btn-primary gap-2">
            <Plus className="w-4 h-4" />
            เพิ่มนักศึกษา
          </button>
        </div>
      </div>

      {/* PDPA / role-based access note */}
      <div className="flex items-center gap-3 p-3.5 rounded-lg mb-5 bg-blue-50 border border-blue-200">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100">
          <GraduationCap className="w-4 h-4 text-blue-700" />
        </div>
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Security &amp; Privacy:</span>{" "}
          ข้อมูลส่วนตัวนักศึกษาถูกปกป้องตาม PDPA การแสดงผลถูกควบคุมตามสิทธิ์ผู้ใช้
          (Role-based Access)
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          {
            label: "ทั้งหมด",
            value: exchangeStudents.length,
            color: "text-crimson",
          },
          {
            label: "ไปแลกเปลี่ยน (Outbound)",
            value: exchangeStudents.filter((s: ExchangeStudent) => s.type === "outbound").length,
            color: "text-blue-700",
          },
          {
            label: "มารับการแลกเปลี่ยน (Inbound)",
            value: exchangeStudents.filter((s: ExchangeStudent) => s.type === "inbound").length,
            color: "text-green-600",
          },
          {
            label: "กำลังดำเนินการ",
            value: exchangeStudents.filter(
              (s: ExchangeStudent) => s.status === "กำลังดำเนินการ"
            ).length,
            color: "text-gold-dark",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-white shadow-card p-4">
            <div className={`text-2xl font-bold mb-1 ${s.color} font-display`}>
              {s.value}
            </div>
            <div className="text-xs text-faint">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-white shadow-card p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
            <input
              className="w-full rounded-md border border-line bg-white px-3 py-2 pl-9 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
              placeholder="ค้นหาชื่อนักศึกษา, สถาบัน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
            style={{ width: "auto", minWidth: 180 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">ประเภท: ทั้งหมด</option>
            <option value="outbound">ไปแลกเปลี่ยน (Outbound)</option>
            <option value="inbound">มารับการแลกเปลี่ยน (Inbound)</option>
          </select>
          <select
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
            style={{ width: "auto", minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="เสร็จสิ้น">เสร็จสิ้น</option>
            <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
            <option value="กำลังสมัคร">กำลังสมัคร</option>
            <option value="วางแผน">วางแผน</option>
          </select>
          <select
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
            style={{ width: "auto", minWidth: 140 }}
          >
            <option>ช่วงเวลา: ทั้งหมด</option>
            <option>2568</option>
            <option>2567</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-soft">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">
                  ชื่อ-นามสกุล
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  ประเภท
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  จาก / ไป
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  ช่วงเวลา
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  โครงการ
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  สถานะ
                </th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: ExchangeStudent) => (
                <tr
                  key={s.id}
                  className="border-b border-paper hover:bg-soft transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                        style={{
                          background: s.type === "outbound" ? "#DBEAFE" : "#DCFCE7",
                          color: s.type === "outbound" ? "#1D4ED8" : "#15803D",
                          width: 36,
                          height: 36,
                          fontSize: 12,
                        }}
                      >
                        {s.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-ink">
                          {s.name}
                        </div>
                        <div className="text-xs text-faint">
                          {s.from.replace("หลักสูตร", "")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      {s.type === "outbound" ? (
                        <ArrowUpRight className="w-4 h-4 text-blue-700" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      )}
                      <span
                        className={`badge ${
                          s.type === "outbound" ? "badge-blue" : "badge-green"
                        }`}
                      >
                        {s.type === "outbound" ? "ไปแลกเปลี่ยน" : "มารับ"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-ink">
                      {s.type === "outbound" ? `→ ${s.to}` : `← ${s.from}`}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-faint">{s.period}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge badge-crimson text-xs">{s.program}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${statusColors[s.status] ?? "badge-gray"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      <button className="btn btn-outline p-1.5 text-xs">
                        ดู
                      </button>
                      <button className="btn btn-outline p-1.5">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-line">
          <span className="text-sm text-faint">
            แสดง 1–{filtered.length} จาก {exchangeStudents.length} คน
          </span>
          <div className="flex gap-1">
            <button className="btn text-xs px-3 py-1.5 bg-crimson text-white">
              1
            </button>
            <button className="btn text-xs px-3 py-1.5 bg-soft text-faint">
              2
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
