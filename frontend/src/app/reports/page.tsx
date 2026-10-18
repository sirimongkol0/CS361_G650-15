"use client";

// Reports for staff/admin, computed from the API data the dashboards load
// (lib/dashboard-data.ts). The year selector filters every dated figure.

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Printer,
  FileText,
  AlertTriangle,
  Building2,
  CalendarDays,
  GraduationCap,
  MessageSquare,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  averageRating, beYear, countByMonth, expiringAgreements, isAgreement, monthLabel,
  partnersByEngagement, recentActivities, shown, useDashboardData, yearsIn,
} from "@/lib/dashboard-data";
import { label, partnerTypeLabels } from "@/lib/labels";
import { downloadCsv, useDocumentTitle } from "@/lib/list-tools";
import { useRole } from "@/lib/role-context";
import { AccessState, LoadingState } from "@/components/data-states";
import { ExportCsvButton } from "@/components/list-ui";

const REPORT_ROLES = ["staff", "admin"];
const PIE_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#e11d48", "#64748b"];
const tooltipStyle = { border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 };
const card = "bg-white border border-line rounded-lg shadow-card p-5";

const inYear = (iso: string | null | undefined, year: number) => Boolean(iso) && Number(iso!.slice(0, 4)) === year;

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-faint">ยังไม่มีข้อมูลในปีนี้</div>;
}

export default function ReportsPage() {
  useDocumentTitle("รายงานและสถิติ");
  const { role, status: session } = useRole();
  const data = useDashboardData();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const years = yearsIn([
    ...data.activities.map((a) => a.startDate),
    ...data.exchange.map((e) => e.raw.startDate),
    ...data.feedback.map((f) => f.dateIso),
    ...data.documents.map((d) => d.effectiveDate),
  ]);
  const year = selectedYear ?? years[0] ?? new Date().getFullYear();

  if (session === "loading") return <div className="p-6"><LoadingState /></div>;
  if (session !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (!REPORT_ROLES.includes(role)) return <div className="p-6"><AccessState status={403} /></div>;

  const yearActivities = data.activities.filter((a) => inYear(a.startDate, year));
  const yearExchange = data.exchange.filter((e) => inYear(e.raw.startDate, year));
  const yearFeedback = data.feedback.filter((f) => inYear(f.dateIso, year));
  const yearAgreements = data.documents.filter((d) => isAgreement(d) && inYear(d.effectiveDate, year));
  const yearRating = averageRating(yearFeedback);

  const activityCounts = countByMonth(data.activities.map((a) => a.startDate), year);
  const outbound = countByMonth(data.exchange.filter((e) => e.type === "outbound").map((e) => e.raw.startDate), year);
  const inbound = countByMonth(data.exchange.filter((e) => e.type === "inbound").map((e) => e.raw.startDate), year);
  const feedbackCounts = countByMonth(yearFeedback.map((f) => f.dateIso), year);
  const ratingByMonth = Array.from({ length: 12 }, (_, month) =>
    averageRating(yearFeedback.filter((f) => Number(f.dateIso?.slice(5, 7)) - 1 === month)));

  const monthly = activityCounts.map((count, i) => ({
    month: monthLabel(i),
    กิจกรรม: count,
    outbound: outbound[i],
    inbound: inbound[i],
    score: ratingByMonth[i] == null ? null : Number(ratingByMonth[i]!.toFixed(2)),
  }));

  const typeCounts = new Map<string, number>();
  for (const partner of data.partners) {
    const name = partner.type ? label(partnerTypeLabels, partner.type) : "ไม่ระบุประเภท";
    typeCounts.set(name, (typeCounts.get(name) ?? 0) + 1);
  }
  const partnerTypes = Array.from(typeCounts, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const topPartners = partnersByEngagement({ partners: data.partners, documents: yearAgreements, activities: yearActivities }).slice(0, 5);
  const topTotal = topPartners[0]?.total ?? 1;
  const exchangeByPartner = (partnerId: number) => yearExchange.filter((e) => e.raw.partnerId === partnerId).length;

  const expiring = expiringAgreements(data.documents);
  const recent = recentActivities(yearActivities, 5);
  const hasExchange = outbound.some(Boolean) || inbound.some(Boolean);
  const hasRating = ratingByMonth.some((r) => r != null);

  const kpis = [
    { label: "หน่วยงาน (ทั้งหมด)", value: shown(data.loaded, data.partners.length), icon: Building2, color: "#7c3aed", bg: "#ede9fe" },
    { label: `ข้อตกลงที่เริ่มมีผลในปี ${beYear(year)}`, value: shown(data.loaded, yearAgreements.length), icon: FileText, color: "#d97706", bg: "#fef3c7" },
    { label: `กิจกรรมในปี ${beYear(year)}`, value: shown(data.loaded, yearActivities.length), icon: CalendarDays, color: "#1d4ed8", bg: "#dbeafe" },
    { label: `นักศึกษาแลกเปลี่ยนในปี ${beYear(year)}`, value: shown(data.loaded, yearExchange.length), icon: GraduationCap, color: "#16a34a", bg: "#dcfce7" },
    { label: "คะแนนความคิดเห็นเฉลี่ย", value: data.loaded ? (yearRating == null ? "—" : `${yearRating.toFixed(1)}★`) : "—", icon: MessageSquare, color: "#be185d", bg: "#fce7f3" },
  ];

  const exportCsv = () => downloadCsv(
    `pcsms-report-${beYear(year)}.csv`,
    ["เดือน", "กิจกรรม", "นักศึกษาแลกเปลี่ยนขาออก", "นักศึกษาแลกเปลี่ยนขาเข้า", "ความคิดเห็น", "คะแนนเฉลี่ย"],
    monthly.map((row, i) => [`${row.month} ${beYear(year)}`, row.กิจกรรม, row.outbound, row.inbound, feedbackCounts[i], row.score]),
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint print:hidden">
            <Link href="/" className="text-faint hover:text-crimson">หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">รายงานและสถิติ</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">รายงานและสถิติ ปี {beYear(year)}</h1>
          <p className="text-sm mt-0.5 text-faint">ภาพรวมเชิงสถิติของความร่วมมือ</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <select
            className="cursor-pointer rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-crimson focus:ring-[3px] focus:ring-crimson/10"
            style={{ width: "auto" }}
            value={year}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            aria-label="ปี"
          >
            {(years.length ? years : [year]).map((y) => <option key={y} value={y}>ปี {beYear(y)}</option>)}
          </select>
          <ExportCsvButton onExport={exportCsv} disabled={!data.loaded} />
          <button type="button" className="btn btn-primary gap-2 text-sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />พิมพ์
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`${card} transition-shadow hover:shadow-card-hover`}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: kpi.bg }}>
              <kpi.icon className="w-4.5 h-4.5" style={{ color: kpi.color }} />
            </div>
            <div className="text-2xl font-bold mb-0.5 text-ink font-display">{kpi.value}</div>
            <div className="text-xs text-faint">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Bar + Pie */}
      <div className="grid gap-5 mb-5 lg:grid-cols-[1fr_340px]">
        <div className={card}>
          <h2 className="font-bold mb-1 text-ink">จำนวนกิจกรรมรายเดือน</h2>
          <p className="text-xs mb-4 text-faint">ปี {beYear(year)} • ตามวันที่จัดกิจกรรม</p>
          <div style={{ height: 220 }}>
            {yearActivities.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" interval={0} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="กิจกรรม" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>

        <div className={card}>
          <h2 className="font-bold mb-1 text-ink">ประเภทหน่วยงาน</h2>
          <p className="text-xs mb-2 text-faint">หน่วยงานที่เผยแพร่ทั้งหมด</p>
          <div style={{ height: 220 }}>
            {partnerTypes.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={partnerTypes} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {partnerTypes.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-faint">ยังไม่มีหน่วยงาน</div>}
          </div>
        </div>
      </div>

      {/* Row 2: Exchange + Feedback */}
      <div className="grid gap-5 mb-5 lg:grid-cols-2">
        <div className={card}>
          <h2 className="font-bold mb-1 text-ink">จำนวนนักศึกษาแลกเปลี่ยน</h2>
          <p className="text-xs mb-4 text-faint">ขาออกเทียบกับขาเข้า • ตามวันที่เริ่ม</p>
          <div style={{ height: 180 }}>
            {hasExchange ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" interval={0} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="outbound" name="ขาออก" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="inbound" name="ขาเข้า" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>

        <div className={card}>
          <h2 className="font-bold mb-1 text-ink">แนวโน้มคะแนนความคิดเห็น</h2>
          <p className="text-xs mb-4 text-faint">คะแนนเฉลี่ยรายเดือน (จาก 5.0) • {yearFeedback.length} ความคิดเห็น</p>
          <div style={{ height: 180 }}>
            {hasRating ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" interval={0} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="score" name="คะแนน" stroke="#f59e0b" strokeWidth={2} connectNulls dot={{ fill: "#f59e0b", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>
      </div>

      {/* Row 3: Top partners + Expiring */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className={card}>
          <h2 className="font-bold mb-1 text-ink">หน่วยงานที่มีความร่วมมือสูงสุด</h2>
          <p className="text-xs mb-4 text-faint">นับข้อตกลงที่เริ่มมีผลและกิจกรรมในปี {beYear(year)}</p>
          {topPartners.length ? (
            <div className="space-y-4">
              {topPartners.map((row, i) => {
                const students = exchangeByPartner(row.partner.id);
                const pct = Math.round((row.total / topTotal) * 100);
                return (
                  <div key={row.partner.id} className="flex items-center gap-4">
                    <span className="text-sm font-bold w-5 flex-shrink-0" style={{ color: i < 3 ? "#4f46e5" : "#94a3b8" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <Link href={`/stakeholders/${row.partner.id}`} className="text-sm font-semibold truncate text-ink hover:text-crimson">{row.partner.name}</Link>
                        <span className="text-xs ml-2 flex-shrink-0 text-faint">
                          {row.agreements} ข้อตกลง • {row.activities} กิจกรรม{students > 0 ? ` • ${students} นักศึกษา` : ""}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line overflow-hidden">
                        <div className="h-full rounded-full bg-crimson" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-faint">ยังไม่มีข้อมูลในปีนี้</p>}
        </div>

        <div className="space-y-5">
          <div className={card}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[#d97706]" />
              <h2 className="font-bold text-ink">ข้อตกลงที่ใกล้หมดอายุ</h2>
            </div>
            <div className="space-y-3">
              {expiring.length === 0 && <p className="text-sm text-faint">ไม่มีข้อตกลงที่จะหมดอายุภายใน 90 วัน</p>}
              {expiring.map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`} className="block p-3 rounded-xl bg-[#fef3c7] border border-[#fde68a]">
                  <div className="font-semibold text-sm mb-0.5 text-[#92400e]">{doc.title}</div>
                  {doc.org && <div className="text-xs text-[#b45309]">{doc.org}</div>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#b45309]">หมดอายุ {doc.expire}</span>
                    <span className="badge bg-[#FEF3C7] text-[#B45309] border border-[#fde68a]">เหลือ {doc.daysLeft} วัน</span>
                  </div>
                </Link>
              ))}
              <Link href="/documents" className="inline-block text-xs font-semibold text-crimson print:hidden">ดูข้อตกลงทั้งหมด →</Link>
            </div>
          </div>

          <div className={card}>
            <h2 className="font-bold mb-3 text-ink">กิจกรรมล่าสุดในปี {beYear(year)}</h2>
            <div className="space-y-2">
              {recent.length === 0 && <p className="text-sm text-faint">ยังไม่มีกิจกรรมในปีนี้</p>}
              {recent.map((a) => (
                <Link key={a.id} href={`/activities/${a.id}`} className="flex items-center justify-between gap-2 py-2 border-b border-[#f1f5f9]">
                  <span className="text-sm text-mute">{a.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-faint">{a.date}</span>
                    <span className={`badge ${a.statusColor} text-xs`}>{a.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
