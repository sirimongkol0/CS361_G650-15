"use client";

import { activityTypeColors, activityTypeLabels, label, displayDescription } from "@/lib/labels";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar, FileText, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { ApiError, loadActivity, loadDocuments, useApiResource } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { SourceLinks } from "@/components/source-links";
import { activityDateLabel } from "@/lib/activity-display";
import { DetailToolbar } from "@/components/detail-toolbar";
import { daysFromToday, relativeDays, useDocumentTitle } from "@/lib/list-tools";

export default function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const { role } = useRole();
  const activity = useApiResource(
    () =>
      Number.isInteger(id) && id > 0
        ? loadActivity(id)
        : Promise.reject(new ApiError("Invalid activity id", 404)),
    [id]
  );
  const documents = useApiResource(loadDocuments);
  useDocumentTitle(activity.status === "success" ? activity.data.name : "กิจกรรม");

  if (activity.status === "loading") {
    return <div className="p-6 max-w-screen-xl mx-auto"><LoadingState title="กำลังโหลดรายละเอียดกิจกรรม" /></div>;
  }
  if (activity.status === "error") {
    return (
      <div className="p-6 max-w-screen-xl mx-auto">
        <ErrorState error={activity.error} onRetry={activity.retry} />
        <div className="mt-4 text-center"><Link href="/activities" className="text-sm font-semibold text-crimson hover:underline">กลับไปหน้ารายการกิจกรรม</Link></div>
      </div>
    );
  }

  const item = activity.data;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs mb-5 text-faint">
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
            {item.participants > 0 && <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{item.participants} ผู้เข้าร่วม</span>}
          </div>
        </div>
        {role !== "public" && (
          <div className="flex gap-2">
            <button className="btn btn-outline" type="button">แก้ไข</button>
            <button className="btn btn-primary gap-2" type="button"><FileText className="w-4 h-4" />ออกรายงาน</button>
          </div>
        )}
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
              <h2 className="font-bold mb-3 text-ink">เอกสารที่เกี่ยวข้อง</h2>
              <Link href={`/documents/${item.mouDocId}`} className="flex items-center gap-2 text-sm font-semibold text-crimson hover:underline"><FileText className="w-4 h-4" />{(documents.status === "success" && documents.data.find((doc) => doc.id === item.mouDocId)?.title) || item.mou}</Link>
            </section>
          )}
          {item.mouDocId == null && <EmptyState compact title="ยังไม่มีข้อตกลงที่เกี่ยวข้องที่เผยแพร่" />}
        </aside>
      </div>
    </div>
  );
}
