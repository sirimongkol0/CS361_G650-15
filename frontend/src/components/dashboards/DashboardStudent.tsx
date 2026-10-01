"use client";

import Link from "next/link";
import { CalendarDays, GraduationCap, MessageSquare, CheckCircle2, Clock, Star, ChevronRight, Bell, Building2 } from "lucide-react";
import { shown, upcomingActivities, useDashboardData } from "@/lib/dashboard-data";

const statCard =
  "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150 p-5";
const contentCard = "content-card bg-white rounded-base shadow-card";

const exchangeStatusColors: Record<string, string> = {
  "เสร็จสิ้น": "badge-green",
  "กำลังดำเนินการ": "badge-blue",
  "กำลังสมัคร": "badge-gold",
  "วางแผน": "badge-purple",
};

export default function DashboardStudent() {
  // There are no student accounts yet, so the dashboard shows published records for everyone.
  const data = useDashboardData();
  const upcoming = upcomingActivities(data.activities);
  const openActivities = upcoming.filter((a) => a.isOpen);
  const completedExchange = data.exchange.filter((e) => e.status === "เสร็จสิ้น").length;

  const summaryCards = [
    { icon: CalendarDays, label: "กิจกรรมที่กำลังจะมา", value: shown(data.loaded, upcoming.length), color: "#B45309", bg: "#FEF3C7" },
    { icon: CheckCircle2, label: "เปิดรับสมัคร", value: shown(data.loaded, openActivities.length), color: "#15803D", bg: "#DCFCE7" },
    { icon: GraduationCap, label: "โครงการแลกเปลี่ยน", value: shown(data.loaded, data.exchange.length), color: "#8B1538", bg: "#F5D6DE" },
    { icon: Building2, label: "คู่ความร่วมมือ", value: shown(data.loaded, data.partners.length), color: "#1D4ED8", bg: "#DBEAFE" },
  ];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            พื้นที่นักศึกษา
          </h1>
        </div>
        <p className="text-sm ml-4" style={{ color: "#6B7280" }}>กิจกรรมและโครงการแลกเปลี่ยนที่เผยแพร่</p>
      </div>

      {/* Welcome card */}
      <div
        className="rounded-xl p-5 mb-6 flex items-center gap-5"
        style={{ background: "linear-gradient(135deg, #8B1538 0%, #B8243E 100%)", color: "#fff" }}
      >
        <div
          className="rounded-full flex items-center justify-center w-14 h-14 flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
        >
          <GraduationCap className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            สวัสดี
          </div>
          <div className="text-sm opacity-80">ติดตามกิจกรรมที่กำลังจะมาและโครงการแลกเปลี่ยนได้ที่นี่</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {shown(data.loaded, completedExchange)}
          </div>
          <div className="text-xs opacity-70">โครงการที่เสร็จสิ้น</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6 stagger">
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

      <div className="grid gap-5 stagger" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* Exchange programmes */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>โครงการแลกเปลี่ยน</h2>
            <Link href="/exchange" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {data.loaded && data.exchange.length === 0 && (
              <p className="px-5 py-4 text-xs text-faint">ยังไม่มีโครงการแลกเปลี่ยนที่เผยแพร่</p>
            )}
            {data.exchange.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAFA]">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F5D6DE" }}>
                  <GraduationCap className="w-5 h-5" style={{ color: "#8B1538" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>{p.program}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{p.to} • {p.period}</div>
                </div>
                <span className={`badge ${exchangeStatusColors[p.status] ?? "badge-gray"}`}>{p.status}</span>
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
              {data.loaded && upcoming.length === 0 && <p className="text-xs text-faint">ยังไม่มีกิจกรรมที่กำลังจะมาถึง</p>}
              {upcoming.slice(0, 5).map((a) => (
                <Link key={a.id} href={`/activities/${a.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-paper">
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#C8961E" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{a.name}</div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>{a.date}{a.location && ` • ${a.location}`}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className={`${contentCard} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4" style={{ color: "#C8961E" }} />
              <h3 className="font-bold text-sm" style={{ color: "#111827" }}>Feedback</h3>
            </div>
            <p className="text-xs text-faint">
              รายการ Feedback ที่ต้องทำจะแสดงเมื่อระบบรองรับบัญชีนักศึกษา
            </p>
            <Link href="/feedback" className="btn btn-accent text-xs mt-3 py-1.5 px-3 gap-1 inline-flex">
              <MessageSquare className="w-3 h-3" />ดู Feedback ทั้งหมด
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
