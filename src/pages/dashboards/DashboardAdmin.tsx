import { useState } from "react";
import { Link } from "react-router";
import {
  Building2, FileText, CalendarDays, GraduationCap, MessageSquare,
  TrendingUp, AlertTriangle, ChevronRight, Download, Star, Users,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const yearlyData = [
  { year: "2564", ความร่วมมือ: 28 }, { year: "2565", ความร่วมมือ: 34 },
  { year: "2566", ความร่วมมือ: 41 }, { year: "2567", ความร่วมมือ: 46 },
  { year: "2568", ความร่วมมือ: 48 },
];

const monthlyActivities = [
  { month: "ม.ค.", กิจกรรม: 8, feedback: 12 },
  { month: "ก.พ.", กิจกรรม: 12, feedback: 18 },
  { month: "มี.ค.", กิจกรรม: 15, feedback: 22 },
  { month: "เม.ย.", กิจกรรม: 10, feedback: 16 },
  { month: "พ.ค.", กิจกรรม: 18, feedback: 28 },
  { month: "มิ.ย.", กิจกรรม: 22, feedback: 31 },
  { month: "ก.ค.", กิจกรรม: 19, feedback: 24 },
  { month: "ส.ค.", กิจกรรม: 25, feedback: 35 },
];

const stakeholderTypes = [
  { name: "มหาวิทยาลัย", value: 22, color: "#8B1538" },
  { name: "บริษัทเอกชน", value: 35, color: "#C8961E" },
  { name: "สถาบันวิจัย", value: 15, color: "#1D4ED8" },
  { name: "สมาคม/เครือข่าย", value: 28, color: "#15803D" },
];

const topCollabs = [
  { name: "มหาวิทยาลัยเชียงใหม่", score: 92, activities: 12, feedback: 4.8, pct: 92 },
  { name: "National Taiwan University", score: 85, activities: 8, feedback: 4.7, pct: 85 },
  { name: "Chulabhorn Research Institute", score: 80, activities: 9, feedback: 4.6, pct: 80 },
  { name: "University of Malaya", score: 72, activities: 5, feedback: 4.5, pct: 72 },
  { name: "บริษัท เทคโนโลยี จำกัด", score: 68, activities: 7, feedback: 4.3, pct: 68 },
];

const feedbackDev = [
  { text: "หลักสูตรควรเพิ่ม practical skills ด้าน DevOps และ Cloud", source: "ศิษย์เก่า", rating: 4 },
  { text: "บัณฑิตมีทักษะการสื่อสารที่ควรพัฒนา", source: "ภาคอุตสาหกรรม", rating: 4 },
  { text: "ควรเพิ่มโครงการวิจัยร่วมกับต่างประเทศ", source: "คู่ความร่วมมือ", rating: 5 },
];

const watchMOU = [
  { title: "MoU UM 2565", org: "University of Malaya", days: 25 },
  { title: "MoA สหกิจ บ.เทคโนฯ", org: "บริษัท เทคโนโลยี จำกัด", days: 15 },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i=>(
        <Star key={i} className="w-3 h-3" fill={i<=n?"#F59E0B":"none"} color={i<=n?"#F59E0B":"#E5E7EB"} />
      ))}
    </span>
  );
}

export default function DashboardAdmin() {
  const [period, setPeriod] = useState("2568");

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
          <select className="input py-2 text-sm" style={{ width: "auto" }} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="2568">ปีการศึกษา 2568</option>
            <option value="2567">ปีการศึกษา 2567</option>
          </select>
          <button className="btn btn-outline text-sm gap-2"><Download className="w-4 h-4" />PDF</button>
          <button className="btn btn-accent text-sm gap-2"><Download className="w-4 h-4" />Excel</button>
        </div>
      </div>

      {/* Executive KPI */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { icon: Building2, label: "Stakeholder", value: "48", change: "+4.2%", color: "#8B1538", bg: "#F5D6DE" },
          { icon: TrendingUp, label: "Active Collaboration", value: "38", change: "+6%", color: "#C8961E", bg: "#FEF6E4" },
          { icon: FileText, label: "Active MoU / MoA", value: "21", change: null, warn: "2 ใกล้หมด", color: "#B45309", bg: "#FEF3C7" },
          { icon: CalendarDays, label: "Activities", value: "156", change: "+8.5%", color: "#1D4ED8", bg: "#DBEAFE" },
          { icon: GraduationCap, label: "Exchange Students", value: "32", change: "+12%", color: "#15803D", bg: "#DCFCE7" },
          { icon: Star, label: "Avg Feedback Score", value: "4.5★", change: "+0.3", color: "#7C3AED", bg: "#EDE9FE" },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ padding: "16px 14px" }}>
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
        <div className="content-card p-5">
          <h2 className="font-bold mb-1" style={{ color: "#111827" }}>จำนวนความร่วมมือรายปี</h2>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>Stakeholder ที่ Active</p>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={yearlyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
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
        <div className="content-card p-5">
          <h2 className="font-bold mb-1" style={{ color: "#111827" }}>กิจกรรมรายเดือน</h2>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>กิจกรรม vs Feedback</p>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={monthlyActivities} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="กิจกรรม" fill="#8B1538" radius={[3,3,0,0]} />
              <Bar dataKey="feedback" fill="#C8961E" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stakeholder types pie */}
        <div className="content-card p-5">
          <h2 className="font-bold mb-1" style={{ color: "#111827" }}>Stakeholder</h2>
          <p className="text-xs mb-1" style={{ color: "#9CA3AF" }}>ตามประเภท</p>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={stakeholderTypes} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3}>
                {stakeholderTypes.map((e, i) => <Cell key={i} fill={e.color} />)}
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
        <div className="content-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm" style={{ color: "#111827" }}>ความร่วมมือที่มีผลลัพธ์สูง</h2>
            <Link to="/reports" className="text-xs" style={{ color: "#8B1538" }}>ดูรายงาน →</Link>
          </div>
          <div className="space-y-3.5">
            {topCollabs.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-bold w-4 flex-shrink-0" style={{ color: i < 3 ? "#8B1538" : "#9CA3AF" }}>{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold truncate" style={{ color: "#111827" }}>{c.name}</span>
                    <span className="text-xs font-bold flex-shrink-0 ml-1" style={{ color: "#8B1538" }}>{c.score}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MoU watch */}
        <div className="content-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm" style={{ color: "#111827" }}>MoU ที่ต้องติดตาม</h2>
            <Link to="/documents" className="text-xs" style={{ color: "#8B1538" }}>ดูทั้งหมด →</Link>
          </div>
          <div className="space-y-3">
            {watchMOU.map((m, i) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-bold" style={{ color: "#92400E" }}>{m.title}</span>
                  <span className="badge badge-yellow">{m.days} วัน</span>
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
        <div className="content-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm" style={{ color: "#111827" }}>Feedback เพื่อพัฒนาหลักสูตร</h2>
            <Link to="/feedback" className="text-xs" style={{ color: "#8B1538" }}>ดูทั้งหมด →</Link>
          </div>
          <div className="space-y-3">
            {feedbackDev.map((f, i) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: "#F7F8FA", border: "1px solid var(--border)" }}>
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
      <div className="content-card p-5 mt-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold" style={{ color: "#111827" }}>การจัดการระบบ</h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>สิทธิ์เฉพาะผู้ดูแลระบบ</p>
          </div>
          <div className="flex gap-3">
            {[
              { label: "User Management", to: "/users", icon: Users },
              { label: "Reports & Analytics", to: "/reports", icon: TrendingUp },
              { label: "System Settings", to: "/settings", icon: Building2 },
            ].map((a) => (
              <Link key={a.label} to={a.to} className="btn btn-secondary gap-2 text-sm">
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
