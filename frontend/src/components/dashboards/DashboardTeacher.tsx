"use client";

import Link from "next/link";
import { Building2, FileText, CalendarDays, GraduationCap, MessageSquare, ChevronRight, AlertTriangle, Star } from "lucide-react";
import { teacherStakeholders, teacherActivities, teacherRecentFeedback } from "@/lib/mock";

const statCard =
  "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150 p-5";
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

type Kpi = {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
  href?: string;
};

const kpis: Kpi[] = [
  { icon: Building2, label: "Stakeholder ที่รับผิดชอบ", value: "3", color: "#8B1538", bg: "#F5D6DE", href: "/stakeholders" },
  { icon: FileText, label: "MoU / MoA", value: "4", color: "#B45309", bg: "#FEF3C7" },
  { icon: CalendarDays, label: "กิจกรรม", value: "8", color: "#1D4ED8", bg: "#DBEAFE" },
  { icon: GraduationCap, label: "นักศึกษาในโครงการ", value: "12", color: "#15803D", bg: "#DCFCE7", href: "/exchange" },
  { icon: MessageSquare, label: "Feedback ล่าสุด", value: "24", color: "#7C3AED", bg: "#EDE9FE", href: "/feedback" },
];

const quickActions = [
  { label: "ดูนักศึกษา", href: "/exchange", color: "#1D4ED8", bg: "#DBEAFE" },
];

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

      {/* Warning: expiring MoU */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl mb-5" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#B45309" }} />
        <p className="text-sm" style={{ color: "#92400E" }}>
          <span className="font-bold">MoA สหกิจ บ.เทคโนโลยี</span> ใกล้หมดอายุใน{" "}
          <span className="font-bold">15 วัน</span> — กรุณาดำเนินการต่ออายุ
        </p>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* My stakeholders */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>Stakeholder ที่รับผิดชอบ</h2>
            <Link href="/stakeholders" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {teacherStakeholders.map((s, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFAFA]">
                <div
                  className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: s.bg, color: s.color, width: 36, height: 36, fontSize: 10 }}
                >
                  {s.initials}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm" style={{ color: "#111827" }}>{s.name}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{s.type} • {s.mou} MoU</div>
                </div>
                <Link href="/stakeholders/1" className="btn p-1.5 text-xs" style={{ background: "transparent", color: "#6B7280" }}>ดู</Link>
              </div>
            ))}
          </div>
        </div>

        {/* My activities */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>กิจกรรมที่รับผิดชอบ</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {teacherActivities.map((a, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFAFA]">
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
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>Feedback ล่าสุด</h2>
            <Link href="/feedback" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {teacherRecentFeedback.map((f, i) => (
              <div key={i} className="p-3 rounded-xl bg-paper shadow-lightring">
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
        <div className={`${contentCard} p-5`}>
          <h2 className="font-bold mb-4" style={{ color: "#111827" }}>การดำเนินการด่วน</h2>
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
