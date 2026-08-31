"use client";

import Link from "next/link";
import { CalendarDays, GraduationCap, MessageSquare, CheckCircle2, Clock, Star, ChevronRight, Bell } from "lucide-react";
import { studentProjects, studentUpcomingActivities, studentPendingFeedback, studentExchange as mockStudentExchange, type StudentExchangeSummary } from "@/lib/mock";
import { loadExchangeStudents, useApiData } from "@/lib/api";

const statCard =
  "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150 p-5";
const contentCard = "content-card bg-white rounded-base shadow-card";

const summaryCards = [
  { icon: GraduationCap, label: "โครงการที่เข้าร่วม", value: "3", color: "#8B1538", bg: "#F5D6DE" },
  { icon: CalendarDays, label: "กิจกรรมที่กำลังจะมา", value: "2", color: "#B45309", bg: "#FEF3C7" },
  { icon: MessageSquare, label: "Feedback ที่ต้องทำ", value: "2", color: "#1D4ED8", bg: "#DBEAFE" },
  { icon: CheckCircle2, label: "เสร็จสิ้นแล้ว", value: "1", color: "#15803D", bg: "#DCFCE7" },
];

export default function DashboardStudent() {
  // API-first with mock.ts as fallback for the exchange summary card.
  // studentProjects / upcoming / pending stay on mock — no API endpoints yet.
  const studentExchange = useApiData<StudentExchangeSummary>(async () => {
    const s = (await loadExchangeStudents())[0];
    return s
      ? { program: s.program, org: s.to, period: s.period, status: s.status }
      : mockStudentExchange;
  }, mockStudentExchange);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            พื้นที่ของฉัน
          </h1>
        </div>
        <p className="text-sm ml-4" style={{ color: "#6B7280" }}>ข้อมูลโครงการและกิจกรรมของคุณ</p>
      </div>

      {/* Welcome card */}
      <div
        className="rounded-xl p-5 mb-6 flex items-center gap-5"
        style={{ background: "linear-gradient(135deg, #8B1538 0%, #B8243E 100%)", color: "#fff" }}
      >
        <div
          className="rounded-full flex items-center justify-center w-14 h-14 text-2xl font-extrabold flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
        >
          ส
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            สวัสดี, นายสมศักดิ์ ใจดี
          </div>
          <div className="text-sm opacity-80">นักศึกษาปริญญาโท • หลักสูตรวิทยาการคอมพิวเตอร์</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>3</div>
          <div className="text-xs opacity-70">โครงการ</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {summaryCards.map((s) => (
          <div key={s.label} className={statCard}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
              <s.icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-extrabold mb-0.5" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
            <div className="text-xs" style={{ color: "#6B7280" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* My Projects */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>โครงการของฉัน</h2>
            <Link href="/my-projects" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {studentProjects.map((p, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAFA]">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F5D6DE" }}>
                  <GraduationCap className="w-5 h-5" style={{ color: "#8B1538" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>{p.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{p.org} • {p.date}</div>
                </div>
                <span className={`badge ${p.statusColor}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Upcoming */}
          <div className={`${contentCard} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4" style={{ color: "#8B1538" }} />
              <h3 className="font-bold text-sm" style={{ color: "#111827" }}>กิจกรรมที่กำลังจะมาถึง</h3>
            </div>
            <div className="space-y-2.5">
              {studentUpcomingActivities.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-paper">
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#C8961E" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{a.name}</div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>{a.date} • {a.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending feedback */}
          <div className={`${contentCard} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4" style={{ color: "#C8961E" }} />
              <h3 className="font-bold text-sm" style={{ color: "#111827" }}>Feedback ที่ต้องทำ</h3>
            </div>
            <div className="space-y-2.5">
              {studentPendingFeedback.map((f, i) => (
                <div key={i} className="p-2.5 rounded-lg" style={{ background: "#FEF6E4", border: "1px solid #F5E0A8" }}>
                  <div className="text-sm font-semibold" style={{ color: "#111827" }}>{f.activity}</div>
                  <div className="text-xs mt-0.5 font-medium" style={{ color: "#B45309" }}>{f.deadline}</div>
                  <Link href="/feedback" className="btn btn-accent text-xs mt-2 py-1.5 px-3 gap-1 inline-flex">
                    <Star className="w-3 h-3" />ให้คะแนน
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Exchange summary */}
          <div className={`${contentCard} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-4 h-4" style={{ color: "#1D4ED8" }} />
              <h3 className="font-bold text-sm" style={{ color: "#111827" }}>Student Exchange</h3>
            </div>
            <div className="rounded-lg p-3" style={{ background: "#EFF6FF" }}>
              <div className="font-semibold text-sm" style={{ color: "#1D4ED8" }}>{studentExchange.program}</div>
              <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{studentExchange.org}</div>
              <div className="text-xs mt-1" style={{ color: "#6B7280" }}>{studentExchange.period}</div>
              <span className="badge badge-green mt-2 inline-flex">{studentExchange.status}</span>
            </div>
            <Link href="/exchange" className="text-xs font-semibold mt-3 block" style={{ color: "#8B1538" }}>
              ดูข้อมูลการแลกเปลี่ยน →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
