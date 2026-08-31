"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, FileText, CalendarDays, GraduationCap, MessageSquare, AlertTriangle, TrendingUp, ChevronRight, Plus, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { staffMonthlyActivities, staffRecentActivities, staffExpiringDocs } from "@/lib/mock";

const statCard =
  "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150";
const contentCard = "content-card bg-white rounded-base shadow-card";

const kpis = [
  { icon: Building2, label: "Stakeholder", value: "48", color: "#8B1538", bg: "#F5D6DE", href: "/partners" },
  { icon: FileText, label: "MoU / MoA", value: "23", color: "#B45309", bg: "#FEF3C7", href: "/documents" },
  { icon: CalendarDays, label: "กิจกรรม", value: "156", color: "#1D4ED8", bg: "#DBEAFE", href: "/activities" },
  { icon: GraduationCap, label: "นักศึกษา", value: "32", color: "#15803D", bg: "#DCFCE7", href: "/exchange" },
  { icon: MessageSquare, label: "Feedback", value: "128", color: "#7C3AED", bg: "#EDE9FE", href: "/feedback" },
  { icon: AlertTriangle, label: "ใกล้หมดอายุ", value: "2", color: "#B45309", bg: "#FEF3C7", href: "/documents" },
];

export default function DashboardStaff() {
  const [year, setYear] = useState("2568");

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
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="2568">ปีการศึกษา 2568</option>
            <option value="2567">ปีการศึกษา 2567</option>
          </select>
          <button className="btn btn-outline text-sm gap-2"><Download className="w-4 h-4" />Export</button>
          <button className="btn btn-primary text-sm gap-2"><Plus className="w-4 h-4" />เพิ่มกิจกรรม</button>
        </div>
      </div>

      {/* Expiry alert */}
      {staffExpiringDocs.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl mb-5" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#B45309" }} />
          <div className="flex-1 text-sm" style={{ color: "#92400E" }}>
            <span className="font-bold">⚠ {staffExpiringDocs.length} ข้อตกลงใกล้หมดอายุ</span>
            {staffExpiringDocs.map((d, i) => (
              <span key={i}> — {d.title} เหลืออีก {d.days} วัน</span>
            ))}
          </div>
          <Link href="/documents" className="btn text-xs py-1.5 px-3" style={{ background: "#B45309", color: "#fff" }}>ดูรายการ</Link>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {kpis.map((s) => (
          <Link key={s.label} href={s.href} className={`${statCard} block`} style={{ textDecoration: "none", padding: "16px 14px" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: s.bg }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div className="text-xl font-extrabold mb-0.5" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
            <div className="text-xs" style={{ color: "#6B7280" }}>{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Chart + Recent activities */}
      <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: "1fr 380px" }}>
        <div className={`${contentCard} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold" style={{ color: "#111827" }}>จำนวนกิจกรรมรายเดือน</h2>
              <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>ปีการศึกษา {year}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#15803D" }}>
              <TrendingUp className="w-3.5 h-3.5" />+8.5% จากปีที่แล้ว
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={staffMonthlyActivities} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
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
            <Link href="/documents" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
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
                  <Link href="/documents/1" className="btn text-xs py-1.5 flex-1 justify-center" style={{ background: "#8B1538", color: "#fff" }}>ดูเอกสาร</Link>
                  <button className="btn btn-outline text-xs py-1.5 flex-1">ต่ออายุ</button>
                </div>
              </div>
            ))}
            <div className="p-3 rounded-xl" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <div className="text-sm font-semibold" style={{ color: "#15803D" }}>21 ข้อตกลงที่ใช้งานปกติ</div>
              <div className="text-xs" style={{ color: "#16A34A" }}>ไม่มีการดำเนินการที่จำเป็น</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activities table */}
      <div className={contentCard}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-bold" style={{ color: "#111827" }}>กิจกรรมล่าสุด</h2>
          <Link href="/activities" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
            ดูทั้งหมด <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "#F9FAFB" }}>
                {["ชื่อกิจกรรม", "หน่วยงาน", "วันที่", "สถานะ", ""].map((h) => (
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
                  <td className="px-5 py-3.5">
                    <Link href="/activities/1" className="btn p-1.5 text-xs" style={{ background: "transparent", color: "#6B7280" }}>ดูรายละเอียด</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
