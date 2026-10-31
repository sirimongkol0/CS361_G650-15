"use client";

import { activityTypeColors, activityTypeLabels, label, displayDescription } from "@/lib/labels";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Calendar, Download, FileText, ChevronRight, Clock, MapPin, Users, MessageSquare } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { ApiError, loadActivity, loadDocuments, useApiResource } from "@/lib/api";
import { canManage, useRole } from "@/lib/role-context";
import { SourceLinks } from "@/components/source-links";
import { activityDateLabel } from "@/lib/activity-display";
import { DetailToolbar } from "@/components/detail-toolbar";
import { OutcomeSection } from "@/components/outcome-section";
import { daysFromToday, relativeDays, useDocumentTitle } from "@/lib/list-tools";
import { downloadFile } from "@/lib/download-file";

export default function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const { role, status: session } = useRole();
  const activity = useApiResource(
    () =>
      Number.isInteger(id) && id > 0
        ? loadActivity(id)
        : Promise.reject(new ApiError("Invalid activity id", 404)),
    [id]
  );
  const documents = useApiResource(loadDocuments);
  const [reportError, setReportError] = useState<string | null>(null);
  const exportReport = () => {
    setReportError(null);
    downloadFile(`/insights/activities/${id}.csv`).catch((e: Error) => setReportError(e.message));
  };
  useDocumentTitle(activity.status === "success" ? activity.data.name : "กิจกรรม");

  if (activity.status === "loading") {
    return <div className="p-6 max-w-screen-xl mx-auto"><LoadingState title="กำลังโหลดกิจกรรม…" /></div>;
  }
  if (activity.status === "error") {
    return (
      <div className="p-6 max-w-screen-xl mx-auto">
        <ErrorState error={activity.error} onRetry={activity.retry} />
        <div className="mt-4 text-center"><Link href="/activities" className="text-sm font-semibold text-crimson hover:underline">กลับไปที่รายการกิจกรรม</Link></div>
      </div>
    );
  }

  const item = activity.data;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs mb-5 text-faint print:hidden">
        <Link href="/" className="hover:text-crimson">หน้าหลัก</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/activities" className="hover:text-crimson">กิจกรรม</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-crimson">{item.name}</span>
      </nav>
      <DetailToolbar kind="activities" id={item.id} title={item.name} />

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-xl font-bold text-ink font-display">{item.name}</h1>
            <span className={`badge ${item.statusColor}`}>{item.status}</span>
            <span className={`badge ${activityTypeColors[item.type] ?? "badge-gray"}`}>{label(activityTypeLabels, item.type)}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-faint">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{item.date}{item.endDate ? ` – ${activityDateLabel(item.endDate, null, item.datePrecision)}` : ""}{(() => {
              // Relative time only for exact dates; month/year precision would be misleading.
              const days = item.datePrecision === "month" || item.datePrecision === "year" ? null : daysFromToday(item.startDate);
              return days !== null ? <span className="text-xs">({relativeDays(days, "อีก", "เมื่อ")})</span> : null;
            })()}</span>
            {item.time && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{item.time}</span>}
            {item.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{item.location}</span>}
            {item.participants > 0 && <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />ผู้เข้าร่วม {item.participants} คน</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap print:hidden">
        {session === "authenticated" && role !== "public" && (
          <Link href={`/feedback?activityId=${item.id}`} className="btn btn-primary gap-2"><MessageSquare className="w-4 h-4" />ส่ง Feedback</Link>
        )}
        {canManage(role) && (
          <div className="flex gap-2">
            <Link href={`/activities/manage?edit=${item.id}`} className="btn btn-outline">แก้ไข</Link>
            <button className="btn btn-outline gap-2" type="button" onClick={exportReport}><Download className="w-4 h-4" aria-hidden />ออกรายงาน</button>
            <button className="btn btn-primary gap-2" type="button" onClick={() => window.print()}><FileText className="w-4 h-4" aria-hidden />พิมพ์ / PDF</button>
          </div>
        )}
        {reportError && <p role="alert" className="w-full text-sm text-crimson">ออกรายงานไม่สำเร็จ: {reportError}</p>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
        <section className="bg-white rounded-base shadow-card p-5">
          <h2 className="font-bold mb-3 text-ink">รายละเอียดกิจกรรม</h2>
          {item.description ? (
            <p className="text-sm leading-relaxed text-faint whitespace-pre-line">{displayDescription(item.description)}</p>
          ) : (
            <p className="text-sm text-faint">ยังไม่มีรายละเอียดเพิ่มเติมสำหรับกิจกรรมนี้</p>
          )}
        </section>

        <OutcomeSection field="activityId" id={item.id} canAdd={canManage(role)} canPublish={role === "staff" || role === "admin"} />

        <SourceLinks sources={item.sources} />
        </div>
        <aside className="space-y-5">
          <section className="bg-white rounded-base shadow-card p-5">
            <h2 className="font-bold mb-4 text-ink">ข้อมูลกิจกรรม</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs font-semibold text-faint">หน่วยงาน</dt><dd className="mt-1 text-mute">
                {item.partnerId ? <Link href={`/stakeholders/${item.partnerId}`} className="text-crimson hover:underline">{item.org}</Link> : item.org}
              </dd></div>
              <div><dt className="text-xs font-semibold text-faint">ประเภท</dt><dd className="mt-1 text-mute">{label(activityTypeLabels, item.type)}</dd></div>
              <div><dt className="text-xs font-semibold text-faint">สถานที่</dt><dd className="mt-1 text-mute">{item.location ?? "—"}</dd></div>
              <div><dt className="text-xs font-semibold text-faint">เวลา</dt><dd className="mt-1 text-mute">{item.time ?? "—"}</dd></div>
              <div><dt className="text-xs font-semibold text-faint">เปิดรับสมัคร</dt><dd className="mt-1 text-mute">{item.isOpen === null ? "ไม่ระบุ" : item.isOpen ? "เปิด" : "ปิด"}</dd></div>
            </dl>
          </section>
          {item.mouDocId != null && (
            <section className="bg-white rounded-base shadow-card p-5">
              <h2 className="font-bold mb-3 text-ink">ข้อตกลงที่เกี่ยวข้อง</h2>
              <Link href={`/documents/${item.mouDocId}`} className="flex items-center gap-2 text-sm font-semibold text-crimson hover:underline"><FileText className="w-4 h-4" />{(documents.status === "success" && documents.data.find((doc) => doc.id === item.mouDocId)?.title) || item.mou}</Link>
            </section>
          )}
          {item.mouDocId == null && <EmptyState compact title="ยังไม่มีข้อตกลงที่เกี่ยวข้อง" />}
        </aside>
      </div>
    </div>
  );
}
