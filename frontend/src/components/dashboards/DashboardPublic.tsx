"use client";

import Link from "next/link";
import { Building2, CalendarDays, ChevronRight, Globe } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { loadPublicActivities, loadPublicPartners, useApiResource } from "@/lib/api";

const statCard = "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150 p-5";
const contentCard = "content-card bg-white rounded-base shadow-card";

export default function DashboardPublic() {
  const activities = useApiResource(loadPublicActivities);
  const partners = useApiResource(loadPublicPartners);
  const activityData = activities.status === "success" ? activities.data : [];
  const partnerData = partners.status === "success" ? partners.data : [];
  const kpis = [
    { icon: Building2, label: "หน่วยงานคู่ความร่วมมือ", value: partners.status === "success" ? String(partnerData.length) : "—", sub: "หน่วยงาน", color: "#8B1538", bg: "#F5D6DE" },
    { icon: CalendarDays, label: "กิจกรรมที่เปิดรับ", value: activities.status === "success" ? String(activityData.filter((item) => item.open).length) : "—", sub: "โครงการ", color: "#B45309", bg: "#FEF3C7" },
    { icon: Globe, label: "กิจกรรมที่เปิดเผย", value: activities.status === "success" ? String(activityData.length) : "—", sub: "กิจกรรม", color: "#15803D", bg: "#DCFCE7" },
  ];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
          <h1 className="text-2xl font-bold text-ink font-display">ข้อมูลความร่วมมือ</h1>
        </div>
        <p className="text-sm ml-4 text-faint">ข้อมูลความร่วมมือของหลักสูตรที่เปิดเผยต่อสาธารณะ</p>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl mb-6 bg-paper shadow-lightring">
        <Globe className="w-5 h-5 flex-shrink-0 text-crimson" />
        <p className="text-sm text-mute">คุณกำลังดูข้อมูลในฐานะ <span className="font-semibold">ผู้ใช้ทั่วไป</span> — แสดงเฉพาะข้อมูลที่หลักสูตรกำหนดให้เผยแพร่</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map((item) => (
          <div key={item.label} className={statCard}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: item.bg }}><item.icon className="w-5 h-5" style={{ color: item.color }} /></div>
            <div className="text-2xl font-extrabold mb-0.5 text-ink font-display">{item.value}</div>
            <div className="text-xs text-faint">{item.sub} • {item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="font-bold text-ink">กิจกรรมล่าสุด</h2>
            <Link href="/activities" className="text-xs font-semibold flex items-center gap-1 text-crimson">ดูทั้งหมด <ChevronRight className="w-3 h-3" /></Link>
          </div>
          <div className="p-3">
            {activities.status === "loading" && <LoadingState compact title="กำลังโหลดกิจกรรม" />}
            {activities.status === "error" && <ErrorState compact error={activities.error} onRetry={activities.retry} />}
            {activities.status === "success" && activities.data.length === 0 && <EmptyState compact title="ยังไม่มีกิจกรรมที่เผยแพร่" />}
            {activities.status === "success" && activities.data.length > 0 && (
              <div className="divide-y divide-[#F3F4F6]">{activities.data.slice(0, 5).map((item) => (
                <Link key={item.id} href={`/activities/${item.id}`} className="flex items-center gap-4 px-2 py-4 hover:bg-[#FAFAFA] rounded-lg">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#F5D6DE]"><CalendarDays className="w-4 h-4 text-crimson" /></div>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate text-ink">{item.name}</div><div className="text-xs mt-0.5 text-faint">{item.org} • {item.date}</div></div>
                  <span className={`badge ${item.open ? "badge-green" : "badge-gray"}`}>{item.open ? "เปิดรับสมัคร" : "ปิดแล้ว"}</span>
                </Link>
              ))}</div>
            )}
          </div>
        </section>

        <section className={contentCard}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="font-bold text-ink">หน่วยงานคู่ความร่วมมือ</h2>
            <Link href="/stakeholders" className="text-xs font-semibold flex items-center gap-1 text-crimson">ดูทั้งหมด <ChevronRight className="w-3 h-3" /></Link>
          </div>
          <div className="p-4">
            {partners.status === "loading" && <LoadingState compact title="กำลังโหลดหน่วยงาน" />}
            {partners.status === "error" && <ErrorState compact error={partners.error} onRetry={partners.retry} />}
            {partners.status === "success" && partners.data.length === 0 && <EmptyState compact />}
            {partners.status === "success" && partners.data.length > 0 && (
              <div className="space-y-2.5">{partners.data.slice(0, 6).map((item) => (
                <Link key={item.id} href={`/stakeholders/${item.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#FAFAFA]">
                  <div className="rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{ background: item.bg, color: item.color, width: 34, height: 34, fontSize: 11 }}>{item.initials}</div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate text-ink">{item.name}</div><div className="text-xs text-faint">{item.country} • {item.type}</div></div>
                </Link>
              ))}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
