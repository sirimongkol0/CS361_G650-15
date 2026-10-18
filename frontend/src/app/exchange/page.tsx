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
import { ApiError, loadExchangeStudents, useApiResource, type ExchangeStudent } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { canManage, useRole } from "@/lib/role-context";
import { Dialog, Notice } from "@/components/form-ui";
import { ExchangeForm } from "@/components/exchange-form";
import { downloadCsv } from "@/lib/list-tools";

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

  const { role, user, status: session } = useRole();
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<ExchangeStudent | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isStaff = role === "staff" || role === "admin";
  // Coordinators edit records they created; staff/admin edit all.
  const canEdit = (s: ExchangeStudent) => isStaff || (role === "coordinator" && s.raw.ownerUserId === user?.id);
  // Wait for the session so a signed-in user never briefly sees the public list.
  const resource = useApiResource<ExchangeStudent[]>(
    () => (session === "loading" ? new Promise<never>(() => {}) : loadExchangeStudents(role)),
    [role, session, reload]
  );
  const exchangeStudents = useMemo(() => resource.data ?? [], [resource.data]);

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
            ข้อมูลนักศึกษาแลกเปลี่ยนขาออกและขาเข้า
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline gap-2 text-sm" type="button" disabled={filtered.length === 0}
            onClick={() => downloadCsv("exchange-students.csv",
              ["ชื่อ-นามสกุล", "ประเภท", "จาก", "ไป", "ช่วงเวลา", "โครงการ", "สถานะ"],
              filtered.map((s) => [s.name, s.type, s.from, s.to, s.period, s.program, s.status]))}>
            <Filter className="w-4 h-4" />
            ส่งออก CSV
          </button>
          {canManage(role) && (
            <button className="btn btn-primary gap-2" type="button" onClick={() => { setNotice(null); setEditing("new"); }}>
              <Plus className="w-4 h-4" />
              เพิ่มนักศึกษา
            </button>
          )}
        </div>
      </div>

      {/* PDPA / role-based access note */}
      <div className="flex items-center gap-3 p-3.5 rounded-lg mb-5 bg-blue-50 border border-blue-200">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100">
          <GraduationCap className="w-4 h-4 text-blue-700" />
        </div>
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Security &amp; Privacy:</span>{" "}
          ระบบแสดงข้อมูลนักศึกษาตามสิทธิ์ของแต่ละบทบาท ตาม PDPA
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
            label: "ขาออก",
            value: exchangeStudents.filter((s: ExchangeStudent) => s.type === "outbound").length,
            color: "text-blue-700",
          },
          {
            label: "ขาเข้า",
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
              placeholder="ค้นหาชื่อนักศึกษาหรือสถาบัน"
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
            <option value="outbound">ขาออก</option>
            <option value="inbound">ขาเข้า</option>
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
        </div>
      </div>

      <Notice text={notice} />
      <Dialog open={editing !== null} title={editing === "new" ? "เพิ่มนักศึกษาแลกเปลี่ยน" : "แก้ไขข้อมูลนักศึกษาแลกเปลี่ยน"}
        onClose={() => setEditing(null)} wide>
        {editing !== null && (
          <ExchangeForm
            key={editing === "new" ? "new" : editing.id}
            record={editing === "new" ? undefined : editing.raw}
            isStaff={isStaff}
            onCancel={() => setEditing(null)}
            onSaved={(saved, created) => {
              setEditing(null);
              setNotice(created ? `เพิ่ม “${saved.name}” แล้ว` : `บันทึก “${saved.name}” แล้ว`);
              setReload((n) => n + 1);
            }}
          />
        )}
      </Dialog>

      {resource.status === "loading" && <LoadingState />}
      {resource.status === "error" && (
        <ErrorState error={resource.error ?? new ApiError("Unexpected API error")} onRetry={resource.retry} />
      )}

      {/* Table */}
      {resource.status === "success" && (
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
                        {s.type === "outbound" ? "ขาออก" : "ขาเข้า"}
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
                    {canEdit(s) && (
                      <button className="btn btn-outline p-1.5 text-xs" type="button" aria-label={`แก้ไข ${s.name}`}
                        onClick={() => { setNotice(null); setEditing(s); }}>
                        <MoreHorizontal className="w-4 h-4" />
                        แก้ไข
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState compact title="ไม่พบนักศึกษาแลกเปลี่ยน" message="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-line">
          <span className="text-sm text-faint">
            แสดง 1–{filtered.length} จาก {exchangeStudents.length} คน
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
