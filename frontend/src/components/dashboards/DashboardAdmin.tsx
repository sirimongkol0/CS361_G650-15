"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2, FileText, CalendarDays, GraduationCap,
  TrendingUp, AlertTriangle, Download, Star, Users,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  adminYearlyTrend,
  adminMonthlyActivities,
  adminStakeholderTypes,
  adminTopCollaborations,
  adminFeedbackDevelopment as mockAdminFeedbackDevelopment,
  adminWatchMOU as mockAdminWatchMOU,
} from "@/lib/mock";
import { loadDocuments, loadFeedbackEntries, useApiData } from "@/lib/api";

const statCard = "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover transition-all duration-150";
const contentCard = "content-card bg-white rounded-base shadow-card";

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className="w-3 h-3" fill={i <= n ? "#F59E0B" : "none"} color={i <= n ? "#F59E0B" : "#E5E7EB"} />
      ))}
    </span>
  );
}

const kpis = [
  { icon: Building2, label: "Stakeholder", value: "48", change: "+4.2%", color: "#8B1538", bg: "#F5D6DE" },
  { icon: TrendingUp, label: "Active Collaboration", value: "38", change: "+6%", color: "#C8961E", bg: "#FEF6E4" },
  { icon: FileText, label: "Active MoU / MoA", value: "21", change: null, warn: "2 ใกล้หมด", color: "#B45309", bg: "#FEF3C7" },
  { icon: CalendarDays, label: "Activities", value: "156", change: "+8.5%", color: "#1D4ED8", bg: "#DBEAFE" },
  { icon: GraduationCap, label: "Exchange Students", value: "32", change: "+12%", color: "#15803D", bg: "#DCFCE7" },
  { icon: Star, label: "Avg Feedback Score", value: "4.5★", change: "+0.3", color: "#7C3AED", bg: "#EDE9FE" },
];

const systemActions = [
  { label: "User Management", href: "/users", icon: Users },
  { label: "Reports & Analytics", href: "/reports", icon: TrendingUp },
  { label: "System Settings", href: "/settings", icon: Building2 },
];

export default function DashboardAdmin() {
  const [period, setPeriod] = useState("2568");

  // API-first with mock.ts as fallback for the MoU watch list + feedback items.
  // Chart aggregates stay on mock — the API has no aggregate endpoints.
  const adminWatchMOU = useApiData(async () => {
    const docs = await loadDocuments();
    const watch = docs
      .filter((d) => d.status === "expiring")
      .map((d) => ({ title: d.title, org: d.org, days: d.daysLeft }));
    return watch.length > 0 ? watch : mockAdminWatchMOU;
  }, mockAdminWatchMOU);
  const adminFeedbackDevelopment = useApiData(async () => {
    const feedback = await loadFeedbackEntries();
    const items = feedback
      .filter((f) => f.comment)
      .slice(0, 3)
      .map((f) => ({ text: f.comment, source: f.source, rating: f.rating }));
    return items.length > 0 ? items : mockAdminFeedbackDevelopment;
  }, mockAdminFeedbackDevelopment);

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
          <p className="text-sm ml-4" style={{ color: "#6B7280" }}>Executive Dashboard — ปีการศึกษา {period}</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg px-3 py-2 text-sm bg-white cursor-pointer"
            style={{ border: "1.5px solid var(--border)", width: "auto" }}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="2568">ปีการศึกษา 2568</option>
            <option value="2567">ปีการศึกษา 2567</option>
          </select>
          <button className="btn btn-outline text-sm gap-2"><Download className="w-4 h-4" />PDF</button>
          <button className="btn btn-accent text-sm gap-2"><Download className="w-4 h-4" />Excel</button>
        </div>
      </div>

      {/* Executive KPI */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {kpis.map((s) => (
          <div key={s.label} className={statCard} style={{ padding: "16px 14px" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              {s.change && (
                <span className="text-xs font-semibold" style={{ color: "#15803D" }}>
                  <TrendingUp className="w-3 h-3 inline mr-0.5" />{s.change}
                </span>
              )}
              {s.warn && (
                <span className="text-xs font-semibold" style={{ color: "#B45309" }}>
                  <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                </span>
              )}
            </div>
            <div className="text-xl font-extrabold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{s.label}</div>
            {s.warn && <div className="text-xs font-semibold mt-1" style={{ color: "#B45309" }}>{s.warn}</div>}
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: "1fr 1fr 300px" }}>
        {/* Yearly trend */}
        <div className={`${contentCard} p-5`}>
          <h2 className="font-bold mb-1" style={{ color: "#111827" }}>จำนวนความร่วมมือรายปี</h2>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>Stakeholder ที่ Active</p>
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
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>กิจกรรม vs Feedback</p>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={adminMonthlyActivities} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="กิจกรรม" fill="#8B1538" radius={[3, 3, 0, 0]} />
              <Bar dataKey="feedback" fill="#C8961E" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stakeholder types pie */}
        <div className={`${contentCard} p-5`}>
          <h2 className="font-bold mb-1" style={{ color: "#111827" }}>Stakeholder</h2>
          <p className="text-xs mb-1" style={{ color: "#9CA3AF" }}>ตามประเภท</p>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={adminStakeholderTypes} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3}>
                {adminStakeholderTypes.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {/* Top collabs */}
        <div className={`${contentCard} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm" style={{ color: "#111827" }}>ความร่วมมือที่มีผลลัพธ์สูง</h2>
            <Link href="/reports" className="text-xs" style={{ color: "#8B1538" }}>ดูรายงาน →</Link>
          </div>
          <div className="space-y-3.5">
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
            <h2 className="font-bold text-sm" style={{ color: "#111827" }}>MoU ที่ต้องติดตาม</h2>
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
              <div className="text-sm font-semibold" style={{ color: "#15803D" }}>21 ข้อตกลงปกติ ✓</div>
            </div>
          </div>
        </div>

        {/* Feedback for development */}
        <div className={`${contentCard} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm" style={{ color: "#111827" }}>Feedback เพื่อพัฒนาหลักสูตร</h2>
            <Link href="/feedback" className="text-xs" style={{ color: "#8B1538" }}>ดูทั้งหมด →</Link>
          </div>
          <div className="space-y-3">
            {adminFeedbackDevelopment.map((f, i) => (
              <div key={i} className="p-3 rounded-xl bg-paper shadow-lightring">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs leading-relaxed flex-1" style={{ color: "#374151" }}>{f.text}</p>
                  <Stars n={f.rating} />
                </div>
                <span className="badge badge-blue text-xs">{f.source}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin-only: User management quick access */}
      <div className={`${contentCard} p-5 mt-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold" style={{ color: "#111827" }}>การจัดการระบบ</h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>สิทธิ์เฉพาะผู้ดูแลระบบ</p>
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
