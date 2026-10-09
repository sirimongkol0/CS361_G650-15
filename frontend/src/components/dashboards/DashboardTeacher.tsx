"use client";

import Link from "next/link";
import { Building2, FileText, CalendarDays, GraduationCap, MessageSquare, ChevronRight, Star } from "lucide-react";
import { label, partnerTypeLabels } from "@/lib/labels";
import {
  expiringAgreements, isAgreement, partnersByEngagement, recentActivities, shown, useDashboardData,
} from "@/lib/dashboard-data";

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

const quickActions = [
  { label: "ดูนักศึกษา", href: "/exchange", color: "#1D4ED8", bg: "#DBEAFE" },
];

export default function DashboardTeacher() {
  // There is no per-user assignment data yet, so every list covers all published records.
  const data = useDashboardData();
  const teacherStakeholders = partnersByEngagement(data).slice(0, 5);
  const teacherActivities = recentActivities(data.activities, 5);
  const teacherRecentFeedback = data.feedback.slice(0, 3);

  const nextExpiring = expiringAgreements(data.documents)[0];

  const kpis: Kpi[] = [
    { icon: Building2, label: "หน่วยงานคู่ความร่วมมือ", value: shown(data.loaded, data.partners.length), color: "#8B1538", bg: "#F5D6DE", href: "/stakeholders" },
    { icon: FileText, label: "ข้อตกลง MoU/MoA", value: shown(data.loaded, data.documents.filter(isAgreement).length), color: "#B45309", bg: "#FEF3C7", href: "/documents" },
    { icon: CalendarDays, label: "กิจกรรม", value: shown(data.loaded, data.activities.length), color: "#1D4ED8", bg: "#DBEAFE", href: "/activities" },
    { icon: GraduationCap, label: "นักศึกษาแลกเปลี่ยน", value: shown(data.loaded, data.exchange.length), color: "#15803D", bg: "#DCFCE7", href: "/exchange" },
    { icon: MessageSquare, label: "ความคิดเห็น", value: shown(data.loaded, data.feedback.length), color: "#7C3AED", bg: "#EDE9FE", href: "/feedback" },
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
        <p className="text-sm ml-4" style={{ color: "#6B7280" }}>ข้อมูลที่เผยแพร่ทั้งหมด (ยังไม่แยกตามผู้รับผิดชอบ)</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-5 gap-4 mb-6 stagger">
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

      {nextExpiring && <div className="bg-amber-50 rounded-xl p-4 mb-5 text-sm">{nextExpiring.title} ใกล้หมดอายุใน {nextExpiring.daysLeft} วัน</div>}

      <div className="grid gap-5 stagger" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* My stakeholders */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>หน่วยงานที่มีความร่วมมือมากที่สุด</h2>
            <Link href="/stakeholders" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {data.loaded && teacherStakeholders.length === 0 && <p className="px-5 py-4 text-xs text-faint">ยังไม่มีข้อมูล</p>}
            {teacherStakeholders.map(({ partner: s, agreements, activities }) => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFAFA]">
                <div
                  className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: s.bg, color: s.color, width: 36, height: 36, fontSize: 10 }}
                >
                  {s.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>{s.name}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>
                    {label(partnerTypeLabels, s.type)} • {agreements} MoU/MoA • {activities} กิจกรรม
                  </div>
                </div>
                <Link href={`/stakeholders/${s.id}`} className="btn p-1.5 text-xs" style={{ background: "transparent", color: "#6B7280" }}>ดู</Link>
              </div>
            ))}
          </div>
        </div>

        {/* My activities */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>กิจกรรมล่าสุด</h2>
            <Link href="/activities" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {data.loaded && teacherActivities.length === 0 && <p className="px-5 py-4 text-xs text-faint">ยังไม่มีกิจกรรมที่เผยแพร่</p>}
            {teacherActivities.map((a, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFAFA]">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#DBEAFE" }}>
                  <CalendarDays className="w-4 h-4" style={{ color: "#1D4ED8" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>{a.name}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{a.org} • {a.date}{a.participants > 0 && ` • ${a.participants} คน`}</div>
                </div>
                <span className={`badge ${a.statusColor}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent feedback */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>ความคิดเห็นล่าสุด</h2>
            <Link href="/feedback" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {data.loaded && teacherRecentFeedback.length === 0 && <p className="text-xs text-faint">ยังไม่มีความคิดเห็นที่เผยแพร่</p>}
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
