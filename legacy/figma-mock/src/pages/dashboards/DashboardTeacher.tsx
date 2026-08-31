import { Link } from "react-router";
import { Building2, FileText, CalendarDays, GraduationCap, MessageSquare, ChevronRight, AlertTriangle, Clock, Star } from "lucide-react";

const myStakeholders = [
  { name: "มหาวิทยาลัยเชียงใหม่", type: "มหาวิทยาลัย", mou: 2, initials: "มช", bg: "#F5D6DE", color: "#8B1538" },
  { name: "National Taiwan University", type: "มหาวิทยาลัย", mou: 1, initials: "NTU", bg: "#DBEAFE", color: "#1D4ED8" },
  { name: "บริษัท เทคโนโลยี จำกัด", type: "บริษัทเอกชน", mou: 1, initials: "TC", bg: "#FEF3C7", color: "#B45309" },
];

const myActivities = [
  { name: "อบรมเชิงปฏิบัติการ AI for Education", org: "NTU", date: "20 ส.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green", participants: 45 },
  { name: "Workshop Data Science", org: "UM", date: "5 ก.ย. 2568", status: "กำลังวางแผน", statusColor: "badge-gold", participants: 30 },
  { name: "การเยี่ยมชมบริษัท", org: "บ.เทคโนฯ", date: "10 ส.ค. 2568", status: "กำลังดำเนินการ", statusColor: "badge-blue", participants: 25 },
];

const recentFeedback = [
  { title: "ความพึงพอใจการอบรม AI", source: "ผู้เข้าร่วม", rating: 5, date: "21 ส.ค. 2568" },
  { title: "Feedback ภาคอุตสาหกรรม", source: "คู่ความร่วมมือ", rating: 4, date: "18 ส.ค. 2568" },
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

export default function DashboardTeacher() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            ความร่วมมือที่รับผิดชอบ
          </h1>
        </div>
        <p className="text-sm ml-4" style={{ color: "#6B7280" }}>ภาพรวมงานในความรับผิดชอบของคุณ</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { icon: Building2, label: "Stakeholder ที่รับผิดชอบ", value: "3", color: "#8B1538", bg: "#F5D6DE", to: "/stakeholders" },
          { icon: FileText, label: "MoU / MoA", value: "4", color: "#B45309", bg: "#FEF3C7", to: "/documents" },
          { icon: CalendarDays, label: "กิจกรรม", value: "8", color: "#1D4ED8", bg: "#DBEAFE", to: "/activities" },
          { icon: GraduationCap, label: "นักศึกษาในโครงการ", value: "12", color: "#15803D", bg: "#DCFCE7", to: "/exchange" },
          { icon: MessageSquare, label: "Feedback ล่าสุด", value: "24", color: "#7C3AED", bg: "#EDE9FE", to: "/feedback" },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="stat-card block" style={{ textDecoration: "none" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
              <s.icon className="w-4.5 h-4.5" style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-extrabold mb-0.5" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
            <div className="text-xs" style={{ color: "#6B7280" }}>{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Warning: expiring MoU */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl mb-5" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#B45309" }} />
        <p className="text-sm" style={{ color: "#92400E" }}>
          <span className="font-bold">MoA สหกิจ บ.เทคโนโลยี</span> ใกล้หมดอายุใน{" "}
          <span className="font-bold">15 วัน</span> — กรุณาดำเนินการต่ออายุ
        </p>
        <Link to="/documents" className="btn btn-accent text-xs py-1.5 px-3 ml-auto">ดูเอกสาร</Link>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* My stakeholders */}
        <div className="content-card">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>Stakeholder ที่รับผิดชอบ</h2>
            <Link to="/stakeholders" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {myStakeholders.map((s, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 table-row-hover">
                <div className="avatar text-xs" style={{ background: s.bg, color: s.color, width: 36, height: 36, fontSize: 10 }}>{s.initials}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm" style={{ color: "#111827" }}>{s.name}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{s.type} • {s.mou} MoU</div>
                </div>
                <Link to="/stakeholders/1" className="btn btn-ghost p-1.5 text-xs">ดู</Link>
              </div>
            ))}
          </div>
        </div>

        {/* My activities */}
        <div className="content-card">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>กิจกรรมที่รับผิดชอบ</h2>
            <Link to="/activities" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {myActivities.map((a, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 table-row-hover">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#DBEAFE" }}>
                  <CalendarDays className="w-4 h-4" style={{ color: "#1D4ED8" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>{a.name}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{a.org} • {a.date} • {a.participants} คน</div>
                </div>
                <span className={`badge ${a.statusColor}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent feedback */}
        <div className="content-card">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>Feedback ล่าสุด</h2>
            <Link to="/feedback" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {recentFeedback.map((f, i) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: "#F7F8FA", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between mb-1.5">
                  <span className="font-semibold text-sm" style={{ color: "#111827" }}>{f.title}</span>
                  <Stars n={f.rating} />
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "#9CA3AF" }}>
                  <span className="badge badge-blue text-xs">{f.source}</span>
                  <span>{f.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="content-card p-5">
          <h2 className="font-bold mb-4" style={{ color: "#111827" }}>การดำเนินการด่วน</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "เพิ่มกิจกรรม", to: "/activities", color: "#8B1538", bg: "#F5D6DE" },
              { label: "บันทึกผลกิจกรรม", to: "/activities/1", color: "#15803D", bg: "#DCFCE7" },
              { label: "ดู MoU ทั้งหมด", to: "/documents", color: "#B45309", bg: "#FEF3C7" },
              { label: "ดูนักศึกษา", to: "/exchange", color: "#1D4ED8", bg: "#DBEAFE" },
            ].map((a) => (
              <Link key={a.label} to={a.to}
                className="p-3.5 rounded-xl text-sm font-semibold flex items-center gap-2"
                style={{ background: a.bg, color: a.color, textDecoration: "none" }}
              >
                <ChevronRight className="w-4 h-4" />
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
