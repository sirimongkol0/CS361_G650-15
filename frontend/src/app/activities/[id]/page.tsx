"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar, ChevronRight, Clock, FileText, MapPin, Users } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/data-states";
import { ApiError, formatThaiDate, loadActivity, useApiResource } from "@/lib/api";
import { useRole } from "@/lib/role-context";

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

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-xl font-bold text-ink font-display">{item.name}</h1>
            <span className={`badge ${item.statusColor}`}>{item.status}</span>
            <span className="badge badge-blue">{item.type}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-faint">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{item.date}{item.endDate ? ` – ${formatThaiDate(item.endDate)}` : ""}</span>
            {item.time && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{item.time}</span>}
            {item.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{item.location}</span>}
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{item.participants} ผู้เข้าร่วม</span>
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
        <section className="bg-white border border-line rounded-lg shadow-card p-5">
          <h2 className="font-bold mb-3 text-ink">รายละเอียดกิจกรรม</h2>
          {item.description ? (
            <p className="text-sm leading-relaxed text-faint whitespace-pre-line">{item.description}</p>
          ) : (
            <p className="text-sm text-faint">ยังไม่มีรายละเอียดเพิ่มเติมสำหรับกิจกรรมนี้</p>
          )}
        </section>

        <aside className="space-y-5">
          <section className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-4 text-ink">ข้อมูลกิจกรรม</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs font-semibold text-faint">หน่วยงาน</dt><dd className="mt-1 text-mute">
                {item.partnerId ? <Link href={`/stakeholders/${item.partnerId}`} className="text-crimson hover:underline">{item.org}</Link> : item.org}
              </dd></div>
              <div><dt className="text-xs font-semibold text-faint">ประเภท</dt><dd className="mt-1 text-mute">{item.type}</dd></div>
              <div><dt className="text-xs font-semibold text-faint">สถานที่</dt><dd className="mt-1 text-mute">{item.location ?? "—"}</dd></div>
              <div><dt className="text-xs font-semibold text-faint">เวลา</dt><dd className="mt-1 text-mute">{item.time ?? "—"}</dd></div>
              <div><dt className="text-xs font-semibold text-faint">เปิดรับสมัคร</dt><dd className="mt-1 text-mute">{item.isOpen ? "เปิด" : "ปิด"}</dd></div>
            </dl>
          </section>
          {role !== "public" && item.mouDocId !== undefined && (
            <section className="bg-white border border-line rounded-lg shadow-card p-5">
              <h2 className="font-bold mb-3 text-ink">เอกสารที่เกี่ยวข้อง</h2>
              <Link href={`/documents/${item.mouDocId}`} className="flex items-center gap-2 text-sm font-semibold text-crimson hover:underline">
                <FileText className="w-4 h-4" />{item.mou}
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
