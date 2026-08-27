import { useState } from "react";
import { Link } from "react-router";
import {
  Building2, FileText, CalendarDays, GraduationCap, MessageSquare,
  TrendingUp, ArrowUpRight, AlertTriangle, ChevronRight, Star
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const monthlyData = [
  { month: "ม.ค.", กิจกรรม: 8, feedback: 12, นักศึกษา: 3 },
  { month: "ก.พ.", กิจกรรม: 12, feedback: 18, นักศึกษา: 4 },
  { month: "มี.ค.", กิจกรรม: 15, feedback: 22, นักศึกษา: 6 },
  { month: "เม.ย.", กิจกรรม: 10, feedback: 16, นักศึกษา: 5 },
  { month: "พ.ค.", กิจกรรม: 18, feedback: 28, นักศึกษา: 8 },
  { month: "มิ.ย.", กิจกรรม: 22, feedback: 31, นักศึกษา: 7 },
  { month: "ก.ค.", กิจกรรม: 19, feedback: 24, นักศึกษา: 9 },
  { month: "ส.ค.", กิจกรรม: 25, feedback: 35, นักศึกษา: 11 },
  { month: "ก.ย.", กิจกรรม: 21, feedback: 29, นักศึกษา: 8 },
  { month: "ต.ค.", กิจกรรม: 16, feedback: 20, นักศึกษา: 6 },
  { month: "พ.ย.", กิจกรรม: 14, feedback: 17, นักศึกษา: 4 },
  { month: "ธ.ค.", กิจกรรม: 11, feedback: 15, นักศึกษา: 3 },
];

const recentActivities = [
  { name: "อบรมเชิงปฏิบัติการ AI for Education", org: "National Taiwan University", date: "20 ส.ค. 2568", status: "เสร็จสิ้น", participants: 45, statusColor: "badge-green" },
  { name: "สัมมนาวิชาการนวัตกรรมการเรียนการสอน", org: "มหาวิทยาลัยเชียงใหม่", date: "15 ส.ค. 2568", status: "เสร็จสิ้น", participants: 80, statusColor: "badge-green" },
  { name: "การเยี่ยมชมบริษัทและศึกษาดูงาน", org: "บริษัท เทคโนโลยี จำกัด", date: "10 ส.ค. 2568", status: "กำลังดำเนินการ", participants: 25, statusColor: "badge-blue" },
  { name: "Workshop Data Science for Business", org: "University of Malaya", date: "5 ส.ค. 2568", status: "กำลังดำเนินการ", participants: 30, statusColor: "badge-blue" },
  { name: "โครงการวิจัยร่วม AI Healthcare", org: "บริษัท ABC จำกัด", date: "1 ส.ค. 2568", status: "วางแผน", participants: 15, statusColor: "badge-purple" },
];

const recentFeedback = [
  { title: "ความพึงพอใจการอบรม AI for Education", source: "ผู้เข้าร่วมกิจกรรม", rating: 5, date: "21 ส.ค. 2568", status: "ตรวจสอบแล้ว", statusColor: "badge-green" },
  { title: "ข้อเสนอแนะหลักสูตรปริญญาโท", source: "ศิษย์เก่า", rating: 4, date: "18 ส.ค. 2568", status: "รอดำเนินการ", statusColor: "badge-yellow" },
  { title: "Feedback จากภาคอุตสาหกรรม", source: "คู่ความร่วมมือ", rating: 5, date: "15 ส.ค. 2568", status: "ตรวจสอบแล้ว", statusColor: "badge-green" },
  { title: "ประเมินสหกิจศึกษา ภาคเรียนที่ 1/2568", source: "ระบบสหกิจศึกษา", rating: 4, date: "12 ส.ค. 2568", status: "รอดำเนินการ", statusColor: "badge-yellow" },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? "star-filled fill-amber-400" : "star-empty"}`} fill={i <= rating ? "#f59e0b" : "none"} />
      ))}
    </div>
  );
}

const statCards = [
  {
    label: "หน่วยงานคู่ความร่วมมือ",
    value: "48",
    unit: "หน่วยงาน",
    change: "+4.2%",
    icon: Building2,
    iconBg: "#ede9fe",
    iconColor: "#7c3aed",
    to: "/stakeholders",
  },
  {
    label: "MoU / MoA",
    value: "23",
    unit: "ฉบับ",
    change: null,
    warning: "2 ฉบับใกล้หมดอายุ",
    icon: FileText,
    iconBg: "#fef3c7",
    iconColor: "#d97706",
    to: "/documents",
  },
  {
    label: "กิจกรรม",
    value: "156",
    unit: "กิจกรรม",
    change: "+8.5%",
    icon: CalendarDays,
    iconBg: "#dbeafe",
    iconColor: "#1d4ed8",
    to: "/activities",
  },
  {
    label: "นักศึกษาแลกเปลี่ยน",
    value: "32",
    unit: "คน",
    change: "+12%",
    icon: GraduationCap,
    iconBg: "#dcfce7",
    iconColor: "#16a34a",
    to: "/exchange",
  },
  {
    label: "Feedback",
    value: "128",
    unit: "รายการ",
    change: null,
    sub: "คะแนนเฉลี่ย 4.5 / 5",
    icon: MessageSquare,
    iconBg: "#fce7f3",
    iconColor: "#be185d",
    to: "/feedback",
  },
];

export default function Dashboard() {
  const [year, setYear] = useState("2568");

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            หน้าหลัก
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>ภาพรวมความร่วมมือและกิจกรรม</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input py-1.5 text-sm" style={{ width: "auto" }} value={year} onChange={e => setYear(e.target.value)}>
            <option value="2568">ปีการศึกษา 2568</option>
            <option value="2567">ปีการศึกษา 2567</option>
            <option value="2566">ปีการศึกษา 2566</option>
          </select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.to} className="stat-card block hover:no-underline" style={{ textDecoration: "none" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: card.iconBg }}>
                  <Icon className="w-5 h-5" style={{ color: card.iconColor }} />
                </div>
                {card.change && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: "#16a34a" }}>
                    <TrendingUp className="w-3 h-3" />
                    {card.change}
                  </span>
                )}
                {card.warning && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: "#d97706" }}>
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: "#1e293b", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {card.value}
              </div>
              <div className="text-xs" style={{ color: "#64748b" }}>{card.unit} • {card.label}</div>
              {card.warning && (
                <div className="mt-2 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md w-fit"
                  style={{ background: "#fef3c7", color: "#b45309" }}>
                  <AlertTriangle className="w-3 h-3" />
                  {card.warning}
                </div>
              )}
              {card.sub && (
                <div className="mt-1 text-xs font-medium" style={{ color: "#be185d" }}>{card.sub}</div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Charts + recent */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 380px" }}>
        {/* Chart */}
        <div className="content-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-base" style={{ color: "#1e293b" }}>สรุปกิจกรรมรายเดือน</h2>
              <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>ปีการศึกษา {year}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gActivity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFeedback" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ fontWeight: 600, color: "#1e293b" }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="กิจกรรม" stroke="#4f46e5" fill="url(#gActivity)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="feedback" stroke="#16a34a" fill="url(#gFeedback)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Feedback */}
        <div className="content-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base" style={{ color: "#1e293b" }}>Feedback ล่าสุด</h2>
            <Link to="/feedback" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#4f46e5" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentFeedback.map((f, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "#1e293b" }}>{f.title}</p>
                  <span className={`badge ${f.statusColor} flex-shrink-0`}>{f.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#94a3b8" }}>{f.source}</span>
                  <StarRating rating={f.rating} />
                </div>
                <div className="text-xs mt-1" style={{ color: "#cbd5e1" }}>{f.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="content-card mt-5">
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="font-bold text-base" style={{ color: "#1e293b" }}>กิจกรรมล่าสุด</h2>
          </div>
          <div className="flex items-center gap-2">
            <input className="input py-1.5 text-sm" placeholder="ค้นหากิจกรรม..." style={{ width: 200 }} />
            <Link to="/activities" className="btn btn-ghost text-xs gap-1" style={{ color: "#4f46e5" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#64748b" }}>ชื่อกิจกรรม</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#64748b" }}>หน่วยงาน</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#64748b" }}>วันที่</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#64748b" }}>ผู้เข้าร่วม</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#64748b" }}>สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {recentActivities.map((a, i) => (
                <tr key={i} className="table-row-hover border-b" style={{ borderColor: "#f1f5f9" }}>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold" style={{ color: "#1e293b" }}>{a.name}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm" style={{ color: "#64748b" }}>{a.org}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm" style={{ color: "#64748b" }}>{a.date}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-semibold" style={{ color: "#1e293b" }}>{a.participants} คน</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`badge ${a.statusColor}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link to="/activities/1" className="btn btn-ghost p-1.5">
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
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
