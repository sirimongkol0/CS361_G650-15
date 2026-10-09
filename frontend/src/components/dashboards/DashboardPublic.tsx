"use client";

import Link from "next/link";
import { PartnerAvatar } from "@/components/partner-avatar";
import { AlarmClock, Building2, CalendarDays, ChevronRight, FileText, Globe, RefreshCw } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { documentTypeLabels, partnerTypeLabels, label } from "@/lib/labels";
import { getLastFetchedAt, loadActivities, loadDocuments, loadPublicPartners, useApiResource } from "@/lib/api";
import { expiringAgreements } from "@/lib/dashboard-data";
import { ExpiryBadge } from "@/components/expiry-badge";
import { useDocumentTitle } from "@/lib/list-tools";
import { latestActivities } from "@/lib/activity-display";
import { countByScope } from "@/lib/scope-summary";
import { ScopeLevelBadge } from "@/components/scope-level-badge";

const statCard = "stat-card bg-white rounded-base shadow-card hover:shadow-card-hover hover:-translate-y-px transition-all duration-150 p-5";
const contentCard = "content-card bg-white rounded-base shadow-card";

export default function DashboardPublic() {
  useDocumentTitle("ภาพรวม");
  const activities = useApiResource(loadActivities);
  const partners = useApiResource(loadPublicPartners);
  const activityData = activities.status === "success" ? activities.data : [];
  const partnerData = partners.status === "success" ? partners.data : [];
  const documents = useApiResource(loadDocuments);
  const documentData = documents.status === "success" ? documents.data : [];
  const agreementData = documentData.filter(item => item.documentKind === "agreement");
  // Newest first (from the API loader), but records with a downloadable file lead the preview.
  const agreementPreview = [...agreementData].sort((a, b) => Number(b.downloadable) - Number(a.downloadable)).slice(0, 5);
  const latest = latestActivities(activityData);
  const endingSoon = expiringAgreements(documentData).slice(0, 5);
  const allLoaded = [activities, partners, documents].every((resource) => resource.status === "success");
  const lastFetched = allLoaded ? getLastFetchedAt() : null;
  // Headline = CSTU directly (scope "program"); broader levels are counted separately, never as CSTU.
  const kpis = [
    { icon: Building2, label: "หน่วยงานคู่ความร่วมมือ", loaded: partners.status === "success", counts: countByScope(partnerData), sub: "รายการ", href: "/stakeholders", note: null as string | null, color: "#8B1538", bg: "#F5D6DE" },
    { icon: Globe, label: "กิจกรรม", loaded: activities.status === "success", counts: countByScope(activityData), sub: "กิจกรรม", href: "/activities", note: null, color: "#15803D", bg: "#DCFCE7" },
    { icon: FileText, label: "ข้อตกลง MoU/MoA", loaded: documents.status === "success", counts: countByScope(agreementData), sub: "ฉบับ", href: "/documents", note: "ไม่รวมแบบฟอร์ม", color: "#7C3AED", bg: "#EDE9FE" },
  ];

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-6 rounded-full" style={{ background: "linear-gradient(180deg, #8B1538, #C8961E)" }} />
          <h1 className="text-2xl font-bold text-ink font-display">ความร่วมมือของ CSTU</h1>
        </div>
        <p className="text-sm ml-4 text-faint">ความร่วมมือของหลักสูตรวิทยาการคอมพิวเตอร์ ระดับปริญญาตรี ศูนย์รังสิต และข้อตกลงระดับคณะ/มหาวิทยาลัยที่เกี่ยวข้อง</p>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl mb-6 bg-paper shadow-lightring">
        <Globe className="w-5 h-5 flex-shrink-0 text-crimson" />
        <p className="text-sm text-mute flex-1">แสดงเฉพาะข้อมูลที่อนุญาตให้เผยแพร่ ทุกรายการมีป้ายระดับความร่วมมือ และตัวเลข CSTU โดยตรงแยกจากระดับคณะ/มหาวิทยาลัย</p>
        {lastFetched && (
          <span className="flex items-center gap-1.5 text-xs text-faint whitespace-nowrap" title={lastFetched.toLocaleString("th-TH")}>
            <RefreshCw className="w-3 h-3" />
            อัปเดตข้อมูลเมื่อ {lastFetched.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 stagger">
        {kpis.map((item) => (
          <Link key={item.label} href={`${item.href}?scope=program`} className={`${statCard} block`} title={`ดู${item.label} CSTU โดยตรงทั้งหมด`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: item.bg }}><item.icon className="w-5 h-5" style={{ color: item.color }} /></div>
            <div className="text-2xl font-extrabold mb-0.5 text-ink font-display">{item.loaded ? String(item.counts.program) : "—"}</div>
            <div className="text-xs text-faint">{item.label} (CSTU โดยตรง){item.note && ` • ${item.note}`}</div>
            {item.loaded && (item.counts.broader > 0 || item.counts.unclassified > 0) && (
              <div className="text-xs mt-1.5 text-faint">
                {[
                  item.counts.broader > 0 && `ระดับคณะ/มหาวิทยาลัยอีก ${item.counts.broader} ${item.sub}`,
                  item.counts.unclassified > 0 && `ยังไม่จัดระดับ ${item.counts.unclassified}`,
                ].filter(Boolean).join(" • ")}
              </div>
            )}
          </Link>
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
              <div className="divide-y divide-soft">{latest.map((item) => (
                <Link key={item.id} href={`/activities/${item.id}`} className="flex items-center gap-4 px-2 py-4 hover:bg-[#FAFAFA] rounded-lg">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#F5D6DE]"><CalendarDays className="w-4 h-4 text-crimson" /></div>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate text-ink">{item.name}</div><div className="text-xs mt-0.5 text-faint">{item.org} • {item.date}</div></div>
                  <ScopeLevelBadge level={item.scopeLevel} />
                  <span className={`badge ${item.statusColor}`}>{item.status}</span>
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
                  <PartnerAvatar partner={item} />
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate text-ink">{item.name}</div><div className="text-xs text-faint">{item.country} • {label(partnerTypeLabels, item.type)}</div></div>
                  <ScopeLevelBadge level={item.scopeLevel} />
                </Link>
              ))}</div>
            )}
          </div>
        </section>
      </div>

      {endingSoon.length > 0 && (
        <section className={`${contentCard} mt-5`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="font-bold text-ink flex items-center gap-2"><AlarmClock className="w-4 h-4 text-[#92670A]" />ข้อตกลงใกล้หมดอายุ</h2>
            <Link href="/documents?sort=expire" className="text-xs font-semibold text-crimson">เรียงตามวันหมดอายุ</Link>
          </div>
          <div className="p-3 divide-y divide-soft">{endingSoon.map((doc) => (
            <Link key={doc.id} href={`/documents/${doc.id}`} className="flex items-center gap-4 p-3 hover:bg-soft rounded-lg">
              <FileText className="w-5 h-5 text-[#92670A]" />
              <div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate text-ink">{doc.title}</div><div className="text-xs text-faint">{doc.org}{doc.expire ? ` • หมดอายุ ${doc.expire}` : ""}</div></div>
              <ExpiryBadge expiryDate={doc.expiryDate} />
            </Link>
          ))}</div>
        </section>
      )}

      <section className={`${contentCard} mt-5`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-bold text-ink">เอกสารข้อตกลง</h2>
          <Link href="/documents" className="text-xs font-semibold text-crimson">ดูทั้งหมด</Link>
        </div>
        <div className="p-3">
          {documents.status === "loading" && <LoadingState compact title="กำลังโหลดเอกสาร" />}
          {documents.status === "error" && <ErrorState compact error={documents.error} onRetry={documents.retry} />}
          {documents.status === "success" && agreementData.length === 0 && <EmptyState compact title="ยังไม่มีข้อตกลงที่เผยแพร่" />}
          <div className="divide-y divide-soft">{agreementPreview.map((doc) => (
            <Link key={doc.id} href={`/documents/${doc.id}`} className="flex items-center gap-4 p-3 hover:bg-soft rounded-lg">
              <FileText className="w-5 h-5 text-crimson" />
              <div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate text-ink">{doc.title}</div><div className="text-xs text-faint">{doc.org}{doc.start ? ` • เริ่ม ${doc.start}` : ""}</div></div>
              <ScopeLevelBadge level={doc.scopeLevel} />
              {doc.type && <span className="badge badge-blue">{label(documentTypeLabels, doc.type)}</span>}
            </Link>
          ))}</div>
        </div>
      </section>
    </div>
  );
}
