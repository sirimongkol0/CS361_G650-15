"use client";

import Link from "next/link";
import { Building2, CalendarDays, Target, MessageSquare, ChevronRight } from "lucide-react";
import { formatThaiDate } from "@/lib/api";
import { shown, useMyInsights } from "@/lib/dashboard-data";

const statCard =
  "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150 p-5";
const contentCard = "content-card bg-white rounded-base shadow-card";

type Kpi = {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
  href?: string;
};

const quickActions = [
  { label: "จัดการกิจกรรมของฉัน", href: "/activities/manage", color: "#8B1538", bg: "#F5D6DE" },
  { label: "ดูนักศึกษาแลกเปลี่ยน", href: "/exchange", color: "#1D4ED8", bg: "#DBEAFE" },
];

export default function DashboardTeacher() {
  // Figures cover only the records this coordinator owns (GET /insights/me).
  const insights = useMyInsights();
  const mine = insights?.role === "coordinator" ? insights : null;
  const loaded = mine !== null;
  const counts = mine?.counts;

  const kpis: Kpi[] = [
    { icon: Building2, label: "หน่วยงานที่ดูแล", value: shown(loaded, counts?.partners ?? 0), color: "#8B1538", bg: "#F5D6DE", href: "/stakeholders" },
    { icon: CalendarDays, label: "กิจกรรมของฉัน", value: shown(loaded, counts?.activities ?? 0), color: "#1D4ED8", bg: "#DBEAFE", href: "/activities/manage" },
    { icon: Target, label: "ผลลัพธ์ที่บันทึก", value: shown(loaded, counts?.outcomes ?? 0), color: "#15803D", bg: "#DCFCE7" },
    { icon: MessageSquare, label: "Feedback รอตรวจสอบ", value: loaded ? `${counts!.feedbackPending} / ${counts!.feedback}` : "—", color: "#B45309", bg: "#FEF3C7", href: "/feedback" },
  ];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            ภาพรวมความร่วมมือ
          </h1>
        </div>
        <p className="text-sm ml-4" style={{ color: "#6B7280" }}>หน่วยงาน กิจกรรม และ Feedback ที่คุณดูแล</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4 mb-6 stagger">
        {kpis.map((s) => {
          const inner = (
            <>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div className="text-2xl font-extrabold mb-0.5" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value}</div>
              <div className="text-xs" style={{ color: "#6B7280" }}>{s.label}</div>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className={`${statCard} block`} style={{ textDecoration: "none" }}>{inner}</Link>
          ) : (
            <div key={s.label} className={statCard}>{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-5 stagger" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* My activities */}
        <div className={`${contentCard} col-span-2`}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>กิจกรรมล่าสุดของฉัน</h2>
            <Link href="/activities/manage" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {loaded && mine!.recentActivities.length === 0 && <p className="px-5 py-4 text-xs text-faint">ยังไม่มีกิจกรรมที่คุณดูแล</p>}
            {mine?.recentActivities.map((a) => (
              <Link key={a.id} href={`/activities/${a.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFAFA]">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#DBEAFE" }}>
                  <CalendarDays className="w-4 h-4" style={{ color: "#1D4ED8" }} aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>{a.name}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{formatThaiDate(a.date)}</div>
                </div>
                {a.status && <span className="badge badge-gray">{a.status}</span>}
              </Link>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className={`${contentCard} p-5 col-span-2`}>
          <h2 className="font-bold mb-4" style={{ color: "#111827" }}>ทางลัด</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <Link key={a.label} href={a.href}
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
