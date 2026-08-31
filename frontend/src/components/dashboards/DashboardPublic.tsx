"use client";

import Link from "next/link";
import { Building2, CalendarDays, Globe, ChevronRight } from "lucide-react";
import { publicActivities, publicPartners } from "@/lib/mock";

// Tailwind-token equivalents of the legacy mock's utility classes
// (stat-card / content-card / table-row-hover / avatar live in legacy/figma-mock/src/index.css)
const statCard =
  "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150 p-5";
const contentCard = "content-card bg-white rounded-base shadow-card";

const kpis = [
  { icon: Building2, label: "หน่วยงานคู่ความร่วมมือ", value: "48", sub: "หน่วยงาน", color: "#8B1538", bg: "#F5D6DE" },
  { icon: CalendarDays, label: "ความร่วมมือที่ดำเนินอยู่", value: "12", sub: "โครงการ", color: "#B45309", bg: "#FEF3C7" },
  { icon: Globe, label: "กิจกรรมที่เปิดเผย", value: "28", sub: "กิจกรรม", color: "#15803D", bg: "#DCFCE7" },
];

export default function DashboardPublic() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2 h-6 rounded-full"
            style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }}
          />
          <h1
            className="text-2xl font-bold"
            style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            ข้อมูลความร่วมมือ
          </h1>
        </div>
        <p className="text-sm ml-4" style={{ color: "#6B7280" }}>
          ข้อมูลความร่วมมือของหลักสูตรที่เปิดเผยต่อสาธารณะ
        </p>
      </div>

      {/* Public notice */}
      <div className="flex items-center gap-3 p-4 rounded-xl mb-6 bg-paper shadow-lightring">
        <Globe className="w-5 h-5 flex-shrink-0" style={{ color: "#8B1538" }} />
        <p className="text-sm" style={{ color: "#374151" }}>
          คุณกำลังดูข้อมูลในฐานะ{" "}
          <span className="font-semibold">ผู้ใช้ทั่วไป</span>{" "}
          — แสดงเฉพาะข้อมูลที่หลักสูตรกำหนดให้เผยแพร่
        </p>
      </div>

      {/* KPI cards — public view */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {kpis.map((s) => (
          <div key={s.label} className={statCard}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: s.bg }}
            >
              <s.icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <div
              className="text-2xl font-extrabold mb-0.5"
              style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {s.value}
            </div>
            <div className="text-xs" style={{ color: "#6B7280" }}>
              {s.sub} • {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* Recent public activities */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>
              กิจกรรมล่าสุด
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {publicActivities.map((a, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAFA]">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F5D6DE" }}
                >
                  <CalendarDays className="w-4 h-4" style={{ color: "#8B1538" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>
                    {a.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                    {a.org} • {a.date}
                  </div>
                </div>
                {a.open ? (
                  <span className="badge badge-green">เปิดรับสมัคร</span>
                ) : (
                  <span className="badge badge-gray">ปิดแล้ว</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Partner list */}
        <div className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-bold" style={{ color: "#111827" }}>
              หน่วยงานคู่ความร่วมมือ
            </h2>
            <Link href="/partners" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#8B1538" }}>
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-2.5">
            {publicPartners.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#FAFAFA]">
                <div
                  className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: p.bg, color: p.color, width: 34, height: 34, fontSize: 11 }}
                >
                  {p.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
                    {p.name}
                  </div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>
                    {p.country} • {p.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
