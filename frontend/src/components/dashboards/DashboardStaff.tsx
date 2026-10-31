"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, FileText, CalendarDays, Target, AlertTriangle, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatThaiDate, insightsQuery, loadActivities, useApiData, type ActivityView } from "@/lib/api";
import {
  RECENT_YEARS, THIS_YEAR, beYear, countFor, daysUntil, monthlyFromSummary, recentActivities, shown, sumCounts,
  useYearSummary,
} from "@/lib/dashboard-data";
import { downloadFile } from "@/lib/download-file";
import { ExportCsvButton } from "@/components/list-ui";

const statCard =
  "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150";
const contentCard = "content-card bg-white rounded-base shadow-card";

type Kpi = {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
  href?: string;
};

export default function DashboardStaff() {
  const [year, setYear] = useState(THIS_YEAR);
  const summary = useYearSummary(year);
  const loaded = summary !== null;
  const activities = useApiData<ActivityView[]>(() => loadActivities().catch(() => []), [], []);

  const staffExpiringDocs = (summary?.agreementsExpiring ?? []).map((d) => ({
    id: d.id, title: d.name, org: d.partnerName ?? "", expire: formatThaiDate(d.expiryDate), days: daysUntil(d.expiryDate),
  }));
  const activeAgreements = countFor(summary?.agreementsByStatus, "active");
  const monthly = monthlyFromSummary(summary, year);
  const staffRecentActivities = recentActivities(activities, 5);
  const exportMonthly = () => { downloadFile(`/insights/summary.csv${insightsQuery({ year })}`).catch(() => {}); };

  const kpis: Kpi[] = [
    { icon: Building2, label: "หน่วยงานคู่ความร่วมมือ", value: shown(loaded, sumCounts(summary?.partnersByType)), color: "#8B1538", bg: "#F5D6DE", href: "/stakeholders" },
    { icon: FileText, label: "ข้อตกลง MoU/MoA", value: shown(loaded, sumCounts(summary?.agreementsByStatus)), color: "#B45309", bg: "#FEF3C7" },
    { icon: CalendarDays, label: `กิจกรรมปี ${beYear(year)}`, value: shown(loaded, sumCounts(summary?.activitiesByMonth)), color: "#1D4ED8", bg: "#DBEAFE" },
    { icon: Target, label: `ผลลัพธ์ปี ${beYear(year)}`, value: shown(loaded, sumCounts(summary?.outcomesByType)), color: "#15803D", bg: "#DCFCE7", href: "/reports" },
    { icon: AlertTriangle, label: "ใกล้หมดอายุ", value: shown(loaded, staffExpiringDocs.length), color: "#B45309", bg: "#FEF3C7" },
  ];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
            <h1 className="text-2xl font-bold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              ภาพรวมความร่วมมือของหลักสูตร
            </h1>
          </div>
          <p className="text-sm ml-4" style={{ color: "#6B7280" }}>ข้อตกลง กิจกรรม และเรื่องที่ต้องติดตาม</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg px-3 py-2 text-sm bg-white cursor-pointer"
            style={{ border: "1.5px solid var(--border)", width: "auto" }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="ปี"
          >
            {RECENT_YEARS.map((y) => <option key={y} value={y}>ปี {beYear(y)}</option>)}
          </select>
          <ExportCsvButton onExport={exportMonthly} disabled={!loaded} />
          <Link href="/activities/manage?new=1" className="btn btn-primary text-sm gap-2"><Plus className="w-4 h-4" />เพิ่มกิจกรรม</Link>
        </div>
      </div>

      {staffExpiringDocs.length > 0 && (<div className="bg-amber-50 rounded-xl p-4 mb-5 text-sm">มีข้อตกลงใกล้หมดอายุ {staffExpiringDocs.length} ฉบับ</div>)}

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-3 mb-6 stagger">
        {kpis.map((s) => {
          const inner = (
            <>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: s.bg }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div className="text-xl font-extrabold mb-0.5" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
              <div className="text-xs" style={{ color: "#6B7280" }}>{s.label}</div>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className={`${statCard} block`} style={{ textDecoration: "none", padding: "16px 14px" }}>{inner}</Link>
          ) : (
            <div key={s.label} className={statCard} style={{ padding: "16px 14px" }}>{inner}</div>
          );
        })}
      </div>

      {/* Chart + Recent activities */}
      <div className="grid gap-5 mb-5 stagger" style={{ gridTemplateColumns: "1fr 380px" }}>
        <div className={`${contentCard} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold" style={{ color: "#111827" }}>จำนวนกิจกรรมรายเดือน</h2>
              <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>ปี {beYear(year)} • ตามวันที่จัดกิจกรรม</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" interval={0} tick={{ fontSize: 10, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="กิจกรรม" fill="#8B1538" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expiring docs */}
        <div className={`${contentCard} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold" style={{ color: "#111827" }}>ข้อตกลงที่ต้องติดตาม</h2>
          </div>
          <div className="space-y-3">
            {staffExpiringDocs.map((d) => (
              <div key={d.id} className="p-3.5 rounded-xl" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm" style={{ color: "#92400E" }}>{d.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#B45309" }}>{d.org}</div>
                  </div>
                  <span className="badge" style={{ background: "#FEF3C7", color: "#B45309" }}>{d.days} วัน</span>
                </div>
                <div className="text-xs mt-1" style={{ color: "#B45309" }}>หมดอายุ {d.expire}</div>
                <div className="flex gap-2 mt-2.5">
                  <Link href={`/documents/manage?open=${d.id}`} className="btn btn-outline text-xs py-1.5 flex-1">เปิดข้อตกลง</Link>
                </div>
              </div>
            ))}
            <div className="p-3 rounded-xl" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <div className="text-sm font-semibold" style={{ color: "#15803D" }}>ข้อตกลงที่มีผล {shown(loaded, activeAgreements)} ฉบับ</div>
              {loaded && staffExpiringDocs.length === 0 && (
                <div className="text-xs" style={{ color: "#16A34A" }}>ยังไม่มีเรื่องที่ต้องดำเนินการ</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activities table */}
      <div className={contentCard}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-bold" style={{ color: "#111827" }}>กิจกรรมล่าสุด</h2>
          <Link href="/activities" className="text-xs font-semibold" style={{ color: "#8B1538" }}>ดูทั้งหมด →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "#F9FAFB" }}>
                {[ "ชื่อกิจกรรม", "หน่วยงาน", "วันที่", "สถานะ" ].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#6B7280" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffRecentActivities.map((a, i) => (
                <tr key={i} className="hover:bg-[#FAFAFA] border-b" style={{ borderColor: "#F3F4F6" }}>
                  <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: "#111827" }}>{a.name}</td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "#6B7280" }}>{a.org}</td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: "#6B7280" }}>{a.date}</td>
                  <td className="px-5 py-3.5"><span className={`badge ${a.statusColor}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
