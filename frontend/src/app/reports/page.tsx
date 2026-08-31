"use client";

// Ported from legacy/figma-mock/src/pages/Reports.tsx (Next.js App Router + recharts + TU theme tokens).

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Download,
  TrendingUp,
  Building2,
  FileText,
  CalendarDays,
  GraduationCap,
  MessageSquare,
  AlertTriangle,
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
  AreaChart,
  Area,
} from "recharts";

const monthlyActivities = [
  { month: "ม.ค.", กิจกรรม: 8 }, { month: "ก.พ.", กิจกรรม: 12 }, { month: "มี.ค.", กิจกรรม: 15 },
  { month: "เม.ย.", กิจกรรม: 10 }, { month: "พ.ค.", กิจกรรม: 18 }, { month: "มิ.ย.", กิจกรรม: 22 },
  { month: "ก.ค.", กิจกรรม: 19 }, { month: "ส.ค.", กิจกรรม: 25 }, { month: "ก.ย.", กิจกรรม: 21 },
  { month: "ต.ค.", กิจกรรม: 16 }, { month: "พ.ย.", กิจกรรม: 14 }, { month: "ธ.ค.", กิจกรรม: 11 },
];

const collabTypes = [
  { name: "มหาวิทยาลัย", value: 22, color: "#4f46e5" },
  { name: "บริษัทเอกชน", value: 35, color: "#06b6d4" },
  { name: "สถาบันวิจัย", value: 15, color: "#10b981" },
  { name: "สมาคม/เครือข่าย", value: 18, color: "#f59e0b" },
  { name: "อื่น ๆ", value: 10, color: "#8b5cf6" },
];

const exchangeData = [
  { month: "ม.ค.", outbound: 2, inbound: 1 }, { month: "ก.พ.", outbound: 3, inbound: 2 },
  { month: "มี.ค.", outbound: 4, inbound: 3 }, { month: "เม.ย.", outbound: 3, inbound: 2 },
  { month: "พ.ค.", outbound: 5, inbound: 3 }, { month: "มิ.ย.", outbound: 6, inbound: 4 },
  { month: "ก.ค.", outbound: 5, inbound: 4 }, { month: "ส.ค.", outbound: 7, inbound: 5 },
];

const feedbackTrend = [
  { month: "ม.ค.", score: 4.2 }, { month: "ก.พ.", score: 4.3 }, { month: "มี.ค.", score: 4.1 },
  { month: "เม.ย.", score: 4.4 }, { month: "พ.ค.", score: 4.5 }, { month: "มิ.ย.", score: 4.6 },
  { month: "ก.ค.", score: 4.5 }, { month: "ส.ค.", score: 4.8 },
];

const topPartners = [
  { name: "มหาวิทยาลัยเชียงใหม่", activities: 12, students: 8, pct: 90 },
  { name: "National Taiwan University", activities: 8, students: 5, pct: 72 },
  { name: "บริษัท เทคโนโลยี จำกัด", activities: 7, students: 2, pct: 65 },
  { name: "University of Malaya", activities: 5, students: 3, pct: 50 },
  { name: "Chulabhorn Research Institute", activities: 9, students: 0, pct: 82 },
];

const expiringMou = [
  { title: "MoU UM 2565", org: "University of Malaya", expire: "31 พ.ค. 2568", daysLeft: 25 },
  { title: "MoA สหกิจ บ.เทคโนฯ", org: "บริษัท เทคโนโลยี จำกัด", expire: "30 มิ.ย. 2568", daysLeft: 15 },
];

const tooltipStyle = { border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 };

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState("2568");

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="text-faint hover:text-crimson">หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">รายงานและสถิติ</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">รายงานและสถิติ</h1>
          <p className="text-sm mt-0.5 text-faint">ภาพรวมข้อมูลเชิงสถิติสำหรับผู้บริหาร</p>
        </div>
        <div className="flex gap-2">
          <select
            className="cursor-pointer rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-crimson focus:ring-[3px] focus:ring-crimson/10"
            style={{ width: "auto" }}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="2568">ปีการศึกษา 2568</option>
            <option value="2567">ปีการศึกษา 2567</option>
          </select>
          <button className="btn btn-outline gap-2 text-sm"><Download className="w-4 h-4" />Export Excel</button>
          <button className="btn btn-primary gap-2 text-sm"><Download className="w-4 h-4" />Export PDF</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "หน่วยงาน", value: "48", change: "+4", icon: Building2, color: "#7c3aed", bg: "#ede9fe" },
          { label: "MoU / MoA", value: "23", change: "+2", icon: FileText, color: "#d97706", bg: "#fef3c7" },
          { label: "กิจกรรม", value: "156", change: "+8.5%", icon: CalendarDays, color: "#1d4ed8", bg: "#dbeafe" },
          { label: "นักศึกษาแลกเปลี่ยน", value: "32", change: "+12%", icon: GraduationCap, color: "#16a34a", bg: "#dcfce7" },
          { label: "Feedback (avg)", value: "4.5★", change: "+0.3", icon: MessageSquare, color: "#be185d", bg: "#fce7f3" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-line rounded-lg shadow-card p-5 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: kpi.bg }}>
                <kpi.icon className="w-4.5 h-4.5" style={{ color: kpi.color }} />
              </div>
              <span className="text-xs font-semibold flex items-center gap-0.5 text-[#16a34a]">
                <TrendingUp className="w-3 h-3" />{kpi.change}
              </span>
            </div>
            <div className="text-2xl font-bold mb-0.5 text-ink font-display">{kpi.value}</div>
            <div className="text-xs text-faint">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Bar + Pie */}
      <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: "1fr 340px" }}>
        <div className="bg-white border border-line rounded-lg shadow-card p-5">
          <h2 className="font-bold mb-1 text-ink">จำนวนกิจกรรมรายเดือน</h2>
          <p className="text-xs mb-4 text-faint">ปีการศึกษา {dateRange}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyActivities} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="กิจกรรม" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-line rounded-lg shadow-card p-5">
          <h2 className="font-bold mb-1 text-ink">ประเภทความร่วมมือ</h2>
          <p className="text-xs mb-2 text-faint">สัดส่วนหน่วยงาน</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={collabTypes} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                {collabTypes.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Exchange + Feedback */}
      <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="bg-white border border-line rounded-lg shadow-card p-5">
          <h2 className="font-bold mb-1 text-ink">จำนวน Student Exchange</h2>
          <p className="text-xs mb-4 text-faint">Outbound vs Inbound</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={exchangeData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="outbound" name="Outbound" fill="#4f46e5" radius={[3, 3, 0, 0]} />
              <Bar dataKey="inbound" name="Inbound" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-line rounded-lg shadow-card p-5">
          <h2 className="font-bold mb-1 text-ink">Feedback Score Trend</h2>
          <p className="text-xs mb-4 text-faint">คะแนนเฉลี่ยรายเดือน (จาก 5.0)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={feedbackTrend} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis domain={[3.5, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="score" name="คะแนน" stroke="#f59e0b" fill="url(#gScore)" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Top partners + Expiring */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 360px" }}>
        <div className="bg-white border border-line rounded-lg shadow-card p-5">
          <h2 className="font-bold mb-4 text-ink">หน่วยงานที่มีความร่วมมือสูงสุด</h2>
          <div className="space-y-4">
            {topPartners.map((p, i) => (
              <div key={i} className="flex items-center gap-4">
                <span
                  className="text-sm font-bold w-5 flex-shrink-0"
                  style={{ color: i < 3 ? "#4f46e5" : "#94a3b8" }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold truncate text-ink">{p.name}</span>
                    <span className="text-xs ml-2 flex-shrink-0 text-faint">
                      {p.activities} กิจกรรม {p.students > 0 ? `• ${p.students} นักศึกษา` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-line overflow-hidden">
                    <div className="h-full rounded-full bg-crimson" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
                <span className="text-sm font-bold flex-shrink-0 text-crimson">{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {/* Expiring MoU */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[#d97706]" />
              <h2 className="font-bold text-ink">MoU ที่ใกล้หมดอายุ</h2>
            </div>
            <div className="space-y-3">
              {expiringMou.map((m, i) => (
                <div key={i} className="p-3 rounded-xl bg-[#fef3c7] border border-[#fde68a]">
                  <div className="font-semibold text-sm mb-0.5 text-[#92400e]">{m.title}</div>
                  <div className="text-xs text-[#b45309]">{m.org}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#b45309]">หมดอายุ {m.expire}</span>
                    <span className="badge bg-[#FEF3C7] text-[#B45309] border border-[#fde68a]">เหลือ {m.daysLeft} วัน</span>
                  </div>
                </div>
              ))}
              <Link href="/documents" className="text-xs font-semibold text-crimson hover:underline">
                ดูเอกสารทั้งหมด →
              </Link>
            </div>
          </div>

          {/* Recent */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-3 text-ink">กิจกรรมล่าสุด</h2>
            <div className="space-y-2">
              {[
                { name: "อบรม AI for Education", date: "20 ส.ค. 2568", status: "badge-green" },
                { name: "สัมมนานวัตกรรมการเรียน", date: "15 ส.ค. 2568", status: "badge-green" },
                { name: "ศึกษาดูงาน บ.เทคโนโลยี", date: "10 ส.ค. 2568", status: "badge-blue" },
              ].map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[#f1f5f9]">
                  <span className="text-sm text-mute">{a.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-faint">{a.date}</span>
                    <span className={`badge ${a.status} text-xs`}>{a.status === "badge-green" ? "เสร็จ" : "ดำเนิน"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
