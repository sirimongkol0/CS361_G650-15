"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2, FileText, CalendarDays, GraduationCap,
  TrendingUp, Users,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { label, partnerTypeLabels } from "@/lib/labels";
import { insightsQuery } from "@/lib/api";
import {
  RECENT_YEARS, THIS_YEAR, beYear, countFor, daysUntil, monthlyFromSummary, shown, sumCounts, useYearSummary,
} from "@/lib/dashboard-data";
import { downloadFile } from "@/lib/download-file";
import { ExportCsvButton } from "@/components/list-ui";

const statCard = "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover transition-all duration-150";
const contentCard = "content-card bg-white rounded-base shadow-card";

const systemActions = [
  { label: "ผู้ใช้และสิทธิ์", href: "/users", icon: Users },
  { label: "ตั้งค่าบัญชี", href: "/settings", icon: Building2 },
];

export default function DashboardAdmin() {
  const [year, setYear] = useState(THIS_YEAR);
  const summary = useYearSummary(year);
  const loaded = summary !== null;

  const adminWatchMOU = (summary?.agreementsExpiring ?? []).map((d) => ({
    title: d.name, org: d.partnerName ?? "", days: daysUntil(d.expiryDate),
  }));
  const activeAgreements = countFor(summary?.agreementsByStatus, "active");
  const top = summary?.topPartners ?? [];
  const topTotal = top[0]?.total ?? 0;
  const adminTopCollaborations = top.map((row) => ({
    name: row.name, score: row.total, pct: topTotal ? Math.round((row.total / topTotal) * 100) : 0,
  }));
  const adminYearlyTrend = (summary?.agreementsByYear ?? []).map((row) => ({ year: beYear(row.year), ความร่วมมือ: row.count }));
  const adminMonthlyActivities = monthlyFromSummary(summary, year);
  const partnerTotal = sumCounts(summary?.partnersByType);
  const adminStakeholderTypes = (summary?.partnersByType ?? [])
    .map((row) => ({ name: row.key ? label(partnerTypeLabels, row.key) : "ไม่ระบุประเภท", value: row.count }));
  const topTypeCount = adminStakeholderTypes[0]?.value ?? 1;
  const exportMonthly = () => { downloadFile(`/insights/summary.csv${insightsQuery({ year })}`).catch(() => {}); };

  const kpis = [
    { icon: Building2, label: "หน่วยงานคู่ความร่วมมือ", value: shown(loaded, partnerTotal), color: "#8B1538", bg: "#F5D6DE" },
    { icon: TrendingUp, label: `ผลลัพธ์ปี ${beYear(year)}`, value: shown(loaded, sumCounts(summary?.outcomesByType)), color: "#C8961E", bg: "#FEF6E4" },
    { icon: FileText, label: "ข้อตกลง MoU/MoA ที่มีผล", value: shown(loaded, activeAgreements), warn: adminWatchMOU.length ? `ใกล้หมดอายุ ${adminWatchMOU.length} ฉบับ` : null, color: "#B45309", bg: "#FEF3C7" },
    { icon: CalendarDays, label: `กิจกรรมปี ${beYear(year)}`, value: shown(loaded, sumCounts(summary?.activitiesByMonth)), color: "#1D4ED8", bg: "#DBEAFE" },
    { icon: GraduationCap, label: `Feedback ปี ${beYear(year)}`, value: shown(loaded, sumCounts(summary?.feedbackByStatus)), color: "#15803D", bg: "#DCFCE7" },
  ];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
            <h1 className="text-2xl font-bold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              ภาพรวมความร่วมมือระดับหลักสูตร
            </h1>
          </div>
          <p className="text-sm ml-4" style={{ color: "#6B7280" }}>ภาพรวมปี {beYear(year)}</p>
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
        </div>
      </div>

      {/* Executive KPI */}
      <div className="grid grid-cols-5 gap-3 mb-6 stagger">
        {kpis.map((s) => (
          <div key={s.label} className={statCard} style={{ padding: "16px 14px" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
            </div>
            <div className="text-xl font-extrabold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{s.label}</div>
            {s.warn && <div className="text-xs font-semibold mt-1" style={{ color: "#B45309" }}>{s.warn}</div>}
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-5 mb-5 stagger" style={{ gridTemplateColumns: "1fr 1fr 300px" }}>
        {/* Yearly trend */}
        <div className={`${contentCard} p-5`}>
          <h2 className="font-bold mb-1" style={{ color: "#111827" }}>จำนวนความร่วมมือรายปี</h2>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>นับจากปีที่ข้อตกลงเริ่มมีผล</p>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={adminYearlyTrend} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="gCollab" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B1538" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8B1538" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="ความร่วมมือ" stroke="#8B1538" fill="url(#gCollab)" strokeWidth={2.5} dot={{ fill: "#8B1538", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly activities */}
        <div className={`${contentCard} p-5`}>
          <h2 className="font-bold mb-1" style={{ color: "#111827" }}>กิจกรรมรายเดือน</h2>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>ปี {beYear(year)} • ตามวันที่จัดกิจกรรม</p>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={adminMonthlyActivities} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" interval={0} tick={{ fontSize: 10, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="กิจกรรม" fill="#8B1538" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stakeholder types: one labelled bar per type, largest first */}
        <div className={`${contentCard} p-5`}>
          <h2 className="font-bold mb-1" style={{ color: "#111827" }}>หน่วยงานคู่ความร่วมมือ</h2>
          <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>ตามประเภท • {shown(loaded, partnerTotal)} หน่วยงาน</p>
          {loaded && adminStakeholderTypes.length === 0 && <p className="text-xs text-faint">ยังไม่มีหน่วยงาน</p>}
          <ul className="space-y-2">
            {adminStakeholderTypes.map((t) => (
              <li key={t.name}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span style={{ color: "#374151" }}>{t.name}</span>
                  <span className="font-semibold" style={{ color: "#111827" }}>{t.value}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                  <div className="h-full rounded-full" style={{ width: `${(t.value / topTypeCount) * 100}%`, background: "#8B1538" }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-5 stagger" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Top collabs */}
        <div className={`${contentCard} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm" style={{ color: "#111827" }}>หน่วยงานที่มีความร่วมมือมากที่สุด</h2>
          </div>
          <p className="text-xs -mt-2 mb-3" style={{ color: "#9CA3AF" }}>นับรวมข้อตกลงและกิจกรรมที่เผยแพร่แล้ว</p>
          <div className="space-y-3.5">
            {loaded && adminTopCollaborations.length === 0 && <p className="text-xs text-faint">ยังไม่มีข้อมูล</p>}
            {adminTopCollaborations.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-bold w-4 flex-shrink-0" style={{ color: i < 3 ? "#8B1538" : "#9CA3AF" }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold truncate" style={{ color: "#111827" }}>{c.name}</span>
                    <span className="text-xs font-bold flex-shrink-0 ml-1" style={{ color: "#8B1538" }}>{c.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: "#8B1538" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MoU watch */}
        <div className={`${contentCard} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm" style={{ color: "#111827" }}>ข้อตกลงที่ต้องติดตาม</h2>
          </div>
          <div className="space-y-3">
            {adminWatchMOU.map((m, i) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-bold" style={{ color: "#92400E" }}>{m.title}</span>
                  <span className="badge" style={{ background: "#FEF3C7", color: "#B45309" }}>{m.days} วัน</span>
                </div>
                <div className="text-xs" style={{ color: "#B45309" }}>{m.org}</div>
              </div>
            ))}
            <div className="p-3 rounded-xl" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <div className="text-sm font-semibold" style={{ color: "#15803D" }}>ข้อตกลงที่มีผล {shown(loaded, activeAgreements)} ฉบับ ✓</div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin-only: User management quick access */}
      <div className={`${contentCard} p-5 mt-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold" style={{ color: "#111827" }}>การจัดการระบบ</h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>เฉพาะผู้ดูแลระบบ</p>
          </div>
          <div className="flex gap-3">
            {systemActions.map((a) => (
              <Link key={a.label} href={a.href} className="btn btn-secondary gap-2 text-sm">
                <a.icon className="w-4 h-4" />
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
