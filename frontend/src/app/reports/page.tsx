"use client";

// Reports for staff/admin. Every figure comes from GET /insights/summary, which
// aggregates in SQL; the year and stakeholder-type filters re-query the API.

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight, Printer, FileText, AlertTriangle, Building2, CalendarDays, MessageSquare, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  formatThaiDate, insightsQuery, loadInsightsSummary, useApiResource, type InsightsSummary, type LabelledCount,
} from "@/lib/api";
import { beYear, monthLabel } from "@/lib/dashboard-data";
import { documentStatusLabels, feedbackStatusLabels, label, partnerTypeLabels } from "@/lib/labels";
import { downloadFile } from "@/lib/download-file";
import { useDocumentTitle } from "@/lib/list-tools";
import { useRole } from "@/lib/role-context";
import { AccessState, ErrorState, LoadingState } from "@/components/data-states";
import { ExportCsvButton } from "@/components/list-ui";

const REPORT_ROLES = ["staff", "admin"];
const PIE_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#e11d48", "#64748b"];
const tooltipStyle = { border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 };
const card = "bg-white border border-line rounded-lg shadow-card p-5 break-inside-avoid";
const selectClass =
  "cursor-pointer rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";
const axis = { tick: { fontSize: 11, fill: "#94a3b8" }, tickLine: false, axisLine: false } as const;

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);
const sum = (rows: { count: number }[]) => rows.reduce((total, row) => total + row.count, 0);

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-faint">ยังไม่มีข้อมูลในช่วงที่เลือก</div>;
}

/** Activities per month; a selected year always shows all 12 months. */
function monthlyActivities(summary: InsightsSummary, year: number | null) {
  if (year === null) {
    return summary.activitiesByMonth.map(({ month, count }) => ({
      month: `${monthLabel(Number(month.slice(5, 7)) - 1)} ${beYear(Number(month.slice(0, 4))).slice(2)}`,
      กิจกรรม: count,
    }));
  }
  const counts = new Map(summary.activitiesByMonth.map((row) => [row.month, row.count]));
  return Array.from({ length: 12 }, (_, i) => ({
    month: monthLabel(i),
    กิจกรรม: counts.get(`${year}-${String(i + 1).padStart(2, "0")}`) ?? 0,
  }));
}

function CountList({ title, rows }: { title: string; rows: LabelledCount[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink mb-2">{title}</h3>
      {rows.length === 0 && <p className="text-xs text-faint">ไม่มีข้อมูล</p>}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex justify-between text-xs mb-1"><span className="text-mute">{row.label}</span><span className="text-ink font-semibold">{row.count}</span></div>
            <div className="h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full rounded-full bg-crimson" style={{ width: `${(row.count / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Report({ summary, year }: { summary: InsightsSummary; year: number | null }) {
  const monthly = monthlyActivities(summary, year);
  const partnerTypes = summary.partnersByType.map((row) => ({
    name: row.key ? label(partnerTypeLabels, row.key) : "ไม่ระบุประเภท", value: row.count,
  }));
  const ratings = [5, 4, 3, 2, 1].map((stars) => ({
    key: String(stars), label: `${stars} ดาว`, count: summary.feedbackByRating.find((r) => r.key === stars)?.count ?? 0,
  }));
  const feedbackStatus = summary.feedbackByStatus.map((row) => ({ ...row, label: label(feedbackStatusLabels, row.key) }));
  const agreementStatus = summary.agreementsByStatus.map((row) => ({
    key: row.key ?? "none", label: row.key ? label(documentStatusLabels, row.key) : "ไม่ระบุสถานะ", count: row.count,
  }));
  const period = year ? `ปี ${beYear(year)}` : "ทุกช่วงเวลา";

  const kpis = [
    { label: "หน่วยงาน", value: sum(summary.partnersByType), icon: Building2, color: "#7c3aed", bg: "#ede9fe" },
    { label: "ข้อตกลง MoU/MoA", value: sum(summary.agreementsByStatus), icon: FileText, color: "#d97706", bg: "#fef3c7" },
    { label: `กิจกรรม (${period})`, value: sum(summary.activitiesByMonth), icon: CalendarDays, color: "#1d4ed8", bg: "#dbeafe" },
    { label: `ผลลัพธ์ (${period})`, value: sum(summary.outcomesByType), icon: Target, color: "#16a34a", bg: "#dcfce7" },
    {
      label: `Feedback (${period})`,
      value: `${sum(summary.feedbackByStatus)}${summary.feedbackAverageRating == null ? "" : ` • ${summary.feedbackAverageRating.toFixed(1)}★`}`,
      icon: MessageSquare, color: "#be185d", bg: "#fce7f3",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={card}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: kpi.bg }}>
              <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} aria-hidden />
            </div>
            <div className="text-2xl font-bold mb-0.5 text-ink font-display">{kpi.value}</div>
            <div className="text-xs text-faint">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 mb-5 lg:grid-cols-[1fr_340px]">
        <section className={card}>
          <h2 className="font-bold mb-1 text-ink">จำนวนกิจกรรมรายเดือน</h2>
          <p className="text-xs mb-4 text-faint">{period} • ตามวันที่จัดกิจกรรม</p>
          <div style={{ height: 220 }}>
            {summary.activitiesByMonth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" interval={0} {...axis} />
                  <YAxis allowDecimals={false} {...axis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="กิจกรรม" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </section>

        <section className={card}>
          <h2 className="font-bold mb-1 text-ink">ประเภทหน่วยงาน</h2>
          <p className="text-xs mb-2 text-faint">หน่วยงานที่ยังไม่ถูกลบ</p>
          <div style={{ height: 220 }}>
            {partnerTypes.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={partnerTypes} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {partnerTypes.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </section>
      </div>

      <div className="grid gap-5 mb-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-bold mb-4 text-ink">ผลลัพธ์ตามประเภท</h2>
          {summary.outcomesByType.length === 0 ? <p className="text-sm text-faint">ยังไม่มีผลลัพธ์ในช่วงที่เลือก</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-faint"><th className="pb-2 font-medium">ประเภท</th><th className="pb-2 font-medium text-right">รายการ</th><th className="pb-2 font-medium text-right">มูลค่ารวม</th></tr></thead>
              <tbody>
                {summary.outcomesByType.map((row) => (
                  <tr key={row.key} className="border-t border-line">
                    <td className="py-2 text-ink">{row.label}</td>
                    <td className="py-2 text-right">{row.count}</td>
                    <td className="py-2 text-right">{row.totalValue.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={card}>
          <h2 className="font-bold mb-4 text-ink">Feedback</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <CountList title="ตามแหล่งที่มา" rows={summary.feedbackBySource} />
            <CountList title="ตามประเภทผู้ส่ง" rows={summary.feedbackByRespondentType} />
            <CountList title="ตามคะแนน" rows={ratings} />
            <CountList title="ตามสถานะ" rows={feedbackStatus} />
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-bold mb-4 text-ink">ข้อตกลงตามสถานะ</h2>
          <CountList title="ข้อตกลงทั้งหมด (ปัจจุบัน)" rows={agreementStatus} />
        </section>

        <section className={card}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#d97706]" aria-hidden />
            <h2 className="font-bold text-ink">ข้อตกลงที่ใกล้หมดอายุ</h2>
          </div>
          <div className="space-y-3">
            {summary.agreementsExpiring.length === 0 && (
              <p className="text-sm text-faint">ไม่มีข้อตกลงที่จะหมดอายุภายใน {summary.expiringWithinDays} วัน</p>
            )}
            {summary.agreementsExpiring.map((doc) => (
              <Link key={doc.id} href={`/documents/${doc.id}`} className="block p-3 rounded-xl bg-[#fef3c7] border border-[#fde68a]">
                <div className="font-semibold text-sm mb-0.5 text-[#92400e]">{doc.name}</div>
                {doc.partnerName && <div className="text-xs text-[#b45309]">{doc.partnerName}</div>}
                <div className="text-xs text-[#b45309] mt-1">หมดอายุ {formatThaiDate(doc.expiryDate)}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default function ReportsPage() {
  useDocumentTitle("รายงานและสถิติ");
  const { role, status: session } = useRole();
  const [year, setYear] = useState<number | null>(THIS_YEAR);
  const [stakeholderType, setStakeholderType] = useState<string>("");
  const allowed = session === "authenticated" && REPORT_ROLES.includes(role);
  const filters = { year, stakeholderType: stakeholderType || null };
  const summary = useApiResource(
    () => (allowed ? loadInsightsSummary(filters) : new Promise<InsightsSummary>(() => {})),
    [allowed, year, stakeholderType],
  );
  const [exportError, setExportError] = useState<string | null>(null);

  if (session === "loading") return <div className="p-6"><LoadingState /></div>;
  if (session !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (!allowed) return <div className="p-6"><AccessState status={403} /></div>;

  const exportCsv = () => {
    setExportError(null);
    downloadFile(`/insights/summary.csv${insightsQuery(filters)}`).catch((e: Error) => setExportError(e.message));
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint print:hidden">
            <Link href="/" className="text-faint hover:text-crimson">หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">รายงานและสถิติ</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">
            รายงานและสถิติ {year ? `ปี ${beYear(year)}` : "ทุกช่วงเวลา"}
          </h1>
          <p className="text-sm mt-0.5 text-faint">
            ภาพรวมเชิงสถิติของความร่วมมือ{stakeholderType && ` • ${label(partnerTypeLabels, stakeholderType)}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap print:hidden">
          <select className={selectClass} value={year ?? ""} aria-label="ปี"
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}>
            <option value="">ทุกปี</option>
            {YEARS.map((y) => <option key={y} value={y}>ปี {beYear(y)}</option>)}
          </select>
          <select className={selectClass} value={stakeholderType} aria-label="ประเภทหน่วยงาน"
            onChange={(e) => setStakeholderType(e.target.value)}>
            <option value="">ทุกประเภทหน่วยงาน</option>
            {Object.entries(partnerTypeLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
          <ExportCsvButton onExport={exportCsv} disabled={summary.status !== "success"} />
          <button type="button" className="btn btn-primary gap-2 text-sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" aria-hidden />พิมพ์ / PDF
          </button>
        </div>
      </div>
      {exportError && <p role="alert" className="mb-4 text-sm text-crimson">ส่งออกไม่สำเร็จ: {exportError}</p>}

      {summary.status === "loading" && <LoadingState />}
      {summary.status === "error" && <ErrorState error={summary.error} onRetry={summary.retry} />}
      {summary.status === "success" && <Report summary={summary.data} year={year} />}
    </div>
  );
}
