"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, FileText, CalendarDays, GraduationCap, MessageSquare, AlertTriangle, Plus, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  agreementState, expiringAgreements, isAgreement, beYear, countByMonth, monthLabel,
  recentActivities, shown, useDashboardData, yearsIn,
} from "@/lib/dashboard-data";

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
  const data = useDashboardData();
  const years = yearsIn(data.activities.map((a) => a.startDate));
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const year = selectedYear ?? years[0] ?? new Date().getFullYear();

  const agreements = data.documents.filter(isAgreement);
  const staffExpiringDocs = expiringAgreements(data.documents).map((d) => ({title: d.title, org: d.org, expire: d.expire, days: d.daysLeft}));
  const activeAgreements = agreements.filter((d) => agreementState(d) === "active").length;
  const monthly = countByMonth(data.activities.map((a) => a.startDate), year)
    .map((count, i) => ({ month: monthLabel(i), กิจกรรม: count }));
  const staffRecentActivities = recentActivities(data.activities, 5);

  const kpis: Kpi[] = [
    { icon: Building2, label: "Stakeholder", value: shown(data.loaded, data.partners.length), color: "#8B1538", bg: "#F5D6DE", href: "/stakeholders" },
    { icon: FileText, label: "MoU / MoA", value: shown(data.loaded, agreements.length), color: "#B45309", bg: "#FEF3C7" },
    { icon: CalendarDays, label: "กิจกรรม", value: shown(data.loaded, data.activities.length), color: "#1D4ED8", bg: "#DBEAFE" },
    { icon: GraduationCap, label: "นักศึกษา", value: shown(data.loaded, data.exchange.length), color: "#15803D", bg: "#DCFCE7", href: "/exchange" },
    { icon: MessageSquare, label: "Feedback", value: shown(data.loaded, data.feedback.length), color: "#7C3AED", bg: "#EDE9FE", href: "/feedback" },
    { icon: AlertTriangle, label: "ใกล้หมดอายุ", value: shown(data.loaded, staffExpiringDocs.length), color: "#B45309", bg: "#FEF3C7" },
  ];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
            <h1 className="text-2xl font-bold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Course Collaboration Management
            </h1>
          </div>
          <p className="text-sm ml-4" style={{ color: "#6B7280" }}>ภาพรวมการบริหารความร่วมมือหลักสูตร</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg px-3 py-2 text-sm bg-white cursor-pointer"
            style={{ border: "1.5px solid var(--border)", width: "auto" }}
            value={year}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            aria-label="ปี"
          >
            {(years.length ? years : [year]).map((y) => <option key={y} value={y}>ปี {beYear(y)}</option>)}
          </select>
          <button className="btn btn-outline text-sm gap-2"><Download className="w-4 h-4" />Export</button>
          <button className="btn btn-primary text-sm gap-2"><Plus className="w-4 h-4" />เพิ่มกิจกรรม</button>
        </div>
      </div>

      {staffExpiringDocs.length > 0 && (<div className="bg-amber-50 rounded-xl p-4 mb-5 text-sm">มีข้อตกลงใกล้หมดอายุ {staffExpiringDocs.length} ฉบับ</div>)}

      {/* KPI row */}
      <div className="grid grid-cols-6 gap-3 mb-6 stagger">
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
            <h2 className="font-bold" style={{ color: "#111827" }}>MoU ที่ต้องติดตาม</h2>
          </div>
          <div className="space-y-3">
            {staffExpiringDocs.map((d, i) => (
              <div key={i} className="p-3.5 rounded-xl" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm" style={{ color: "#92400E" }}>{d.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#B45309" }}>{d.org}</div>
                  </div>
                  <span className="badge" style={{ background: "#FEF3C7", color: "#B45309" }}>{d.days} วัน</span>
                </div>
                <div className="text-xs mt-1" style={{ color: "#B45309" }}>หมดอายุ {d.expire}</div>
                <div className="flex gap-2 mt-2.5">
                  <button className="btn btn-outline text-xs py-1.5 flex-1">ต่ออายุ</button>
                </div>
              </div>
            ))}
            <div className="p-3 rounded-xl" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <div className="text-sm font-semibold" style={{ color: "#15803D" }}>{shown(data.loaded, activeAgreements)} ข้อตกลงที่ใช้งานปกติ</div>
              <div className="text-xs" style={{ color: "#16A34A" }}>ไม่มีการดำเนินการที่จำเป็น</div>
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
