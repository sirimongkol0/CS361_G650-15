"use client";

// One partner's collaboration over the years (GET /insights/partners/{id}), for
// renewal talks and the annual report. Staff/admin only.

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ApiError, loadPartnerTimeline, useApiResource } from "@/lib/api";
import { beYear } from "@/lib/dashboard-data";
import { label, partnerTypeLabels } from "@/lib/labels";
import { useDocumentTitle } from "@/lib/list-tools";
import { useRole } from "@/lib/role-context";
import { AccessState, ErrorState, LoadingState } from "@/components/data-states";

const REPORT_ROLES = ["staff", "admin"];
const card = "bg-white border border-line rounded-lg shadow-card p-5 break-inside-avoid";
const KINDS = [
  { key: "agreements", name: "ข้อตกลงที่เริ่มมีผล", color: "#d97706" },
  { key: "activities", name: "กิจกรรม", color: "#1d4ed8" },
  { key: "outcomes", name: "ผลลัพธ์", color: "#16a34a" },
  { key: "feedback", name: "Feedback", color: "#be185d" },
] as const;

export default function PartnerReportPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const { role, status: session } = useRole();
  const allowed = session === "authenticated" && REPORT_ROLES.includes(role);
  const report = useApiResource(
    () => (!allowed ? new Promise<never>(() => {})
      : Number.isInteger(id) && id > 0 ? loadPartnerTimeline(id)
        : Promise.reject(new ApiError("Invalid partner id", 404))),
    [allowed, id],
  );
  useDocumentTitle(report.status === "success" ? `รายงาน ${report.data.partner.name}` : "รายงานหน่วยงาน");

  if (session === "loading") return <div className="p-6"><LoadingState /></div>;
  if (session !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (!allowed) return <div className="p-6"><AccessState status={403} /></div>;
  if (report.status === "loading") return <div className="p-6"><LoadingState /></div>;
  if (report.status === "error") return <div className="p-6"><ErrorState error={report.error} onRetry={report.retry} /></div>;

  const { partner, timeline, totals } = report.data;
  const chart = timeline.map((row) => ({ ...row, ปี: beYear(row.year) }));
  const activeYears = timeline.filter((row) => row.activities + row.outcomes + row.feedback > 0).map((row) => row.year);
  const span = activeYears.length
    ? `มีความเคลื่อนไหว ${activeYears.length} ปี (${[...new Set([activeYears[0], activeYears[activeYears.length - 1]])].map(beYear).join("–")})`
    : "ยังไม่มีกิจกรรม ผลลัพธ์ หรือ Feedback ที่บันทึกไว้";

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint print:hidden">
        <Link href="/reports" className="text-faint hover:text-crimson">รายงานและสถิติ</Link>
        <ChevronRight className="w-3 h-3" aria-hidden />
        <span className="text-crimson">{partner.name}</span>
      </nav>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink font-display">รายงานความร่วมมือ: {partner.name}</h1>
          <p className="text-sm mt-0.5 text-faint">{partner.type ? label(partnerTypeLabels, partner.type) : "ไม่ระบุประเภท"} • {span}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link href={`/stakeholders/${partner.id}`} className="btn btn-outline text-sm">ดูข้อมูลหน่วยงาน</Link>
          <button type="button" className="btn btn-primary gap-2 text-sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" aria-hidden />พิมพ์ / PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KINDS.map((kind) => (
          <div key={kind.key} className={card}>
            <div className="text-2xl font-bold text-ink font-display" style={{ color: kind.color }}>{totals[kind.key]}</div>
            <div className="text-xs text-faint">{kind.name} (ทั้งหมด)</div>
          </div>
        ))}
      </div>

      <section className={`${card} mb-5`}>
        <h2 className="font-bold mb-4 text-ink">ความต่อเนื่องรายปี</h2>
        {timeline.length === 0 ? <p className="text-sm text-faint">ยังไม่มีข้อมูลที่ระบุวันที่</p> : (
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="ปี" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {KINDS.map((kind) => <Bar key={kind.key} dataKey={kind.key} name={kind.name} fill={kind.color} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="font-bold mb-3 text-ink">ตารางรายปี</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="pb-2 font-medium">ปี</th>
              {KINDS.map((kind) => <th key={kind.key} className="pb-2 font-medium text-right">{kind.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {timeline.map((row) => (
              <tr key={row.year} className="border-t border-line">
                <td className="py-2 text-ink">{beYear(row.year)}</td>
                {KINDS.map((kind) => <td key={kind.key} className="py-2 text-right">{row[kind.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-faint">นับตามวันที่ของแต่ละรายการ รายการที่ไม่มีวันที่รวมอยู่ในยอดทั้งหมดเท่านั้น</p>
      </section>
    </div>
  );
}
