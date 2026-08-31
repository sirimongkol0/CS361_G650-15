"use client";

// Ported from legacy/figma-mock/src/pages/ActivityDetail.tsx (Next.js App Router + TU theme tokens).
// Mock detail content is written for activity id=1 (อบรมเชิงปฏิบัติการ AI for Education);
// header fields fall back to it when the id does not resolve in the mock data.

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  MapPin,
  Users,
  Calendar,
  FileText,
  Star,
  Download,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import {
  activities,
  activityFeedbackList,
  activityFiles,
  activityInfoRows,
  activityOutcomeStats,
  activityOutcomes,
  activityParticipants,
  activityPhotos,
} from "@/lib/mock";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "text-[#F59E0B]" : "text-line"}`}
          fill={i <= rating ? "#f59e0b" : "none"}
        />
      ))}
    </div>
  );
}

export default function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const activity = activities.find((a) => a.id === id);

  const name = activity?.name ?? "อบรมเชิงปฏิบัติการ AI for Education";
  const status = activity?.status ?? "เสร็จสิ้น";
  const statusColor = activity?.statusColor ?? "badge-green";
  const type = activity?.type ?? "อบรม";
  const date = activity?.date ?? "20 ส.ค. 2568";
  const org = activity?.org ?? "National Taiwan University";
  const participantsCount = activity?.participants ?? 45;
  const mouDocId = activity?.mouDocId ?? 2;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs mb-5 text-faint">
        <Link href="/" className="text-faint hover:text-crimson">
          หน้าหลัก
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/activities" className="text-faint hover:text-crimson">
          กิจกรรม
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-crimson">{name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-ink font-display">{name}</h1>
            <span className={`badge ${statusColor}`}>{status}</span>
            <span className="badge badge-blue">{type}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-faint">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {date}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              ห้อง 301 อาคารวิจัย NTU
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {participantsCount} ผู้เข้าร่วม
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline">แก้ไข</button>
          <button className="btn btn-primary gap-2">
            <FileText className="w-4 h-4" />
            ออกรายงาน
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-5">
          {/* Description */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-3 text-ink">รายละเอียดกิจกรรม</h2>
            <p className="text-sm leading-relaxed text-faint">
              โครงการอบรมเชิงปฏิบัติการ &quot;AI for Education&quot; เป็นความร่วมมือระหว่างหลักสูตร
              กับ National Taiwan University มุ่งเน้นการนำเทคโนโลยี AI มาประยุกต์ใช้ในการเรียนการสอน
              ผู้เข้าร่วมได้รับความรู้ด้าน Machine Learning, Natural Language Processing,
              และการออกแบบประสบการณ์การเรียนรู้ที่ใช้ AI เป็นเครื่องมือ
            </p>
          </div>

          {/* Outcomes */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-4 text-ink">ผลลัพธ์และผลสำเร็จ</h2>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {activityOutcomeStats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl p-4 text-center"
                  style={{ background: s.bg }}
                >
                  <div
                    className="text-2xl font-bold mb-0.5 font-display"
                    style={{ color: s.color }}
                  >
                    {s.value}
                  </div>
                  <div className="text-xs text-faint">{s.sub}</div>
                  <div className="text-xs font-semibold mt-1 text-ink">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            <h3 className="font-semibold text-sm mb-3 text-ink">ผลลัพธ์หลัก</h3>
            <ul className="space-y-2">
              {activityOutcomes.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-mute"
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#16a34a]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Photos */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-ink">ภาพกิจกรรม</h2>
              <button className="btn btn-outline text-xs gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                เพิ่มรูป
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {activityPhotos.map((src, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden aspect-video bg-[#F1F5F9]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`กิจกรรม ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-ink">Feedback จากผู้เข้าร่วม</h2>
              <div className="flex items-center gap-2">
                <StarRow rating={5} />
                <span className="text-sm font-bold text-ink">4.8 / 5</span>
              </div>
            </div>
            <div className="space-y-3">
              {activityFeedbackList.map((f, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center rounded-full font-bold shrink-0 bg-[#EDE9FE] text-[#7C3AED]"
                        style={{ width: 28, height: 28, fontSize: 11 }}
                      >
                        {f.name[0]}
                      </div>
                      <span className="text-sm font-semibold text-ink">
                        {f.name}
                      </span>
                    </div>
                    <StarRow rating={f.rating} />
                  </div>
                  <p className="text-sm text-faint">{f.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Info */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-4 text-ink">ข้อมูลกิจกรรม</h2>
            <div className="space-y-3 text-sm">
              {activityInfoRows.map((row) => (
                <div key={row.label} className="flex gap-2">
                  <span
                    className="text-xs font-semibold flex-shrink-0 mt-0.5 text-faint"
                    style={{ width: 100 }}
                  >
                    {row.label}
                  </span>
                  <span className="text-mute">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-ink">ผู้เข้าร่วม</h2>
              <span className="text-sm font-bold text-crimson">
                {participantsCount} คน
              </span>
            </div>
            <div className="space-y-2.5">
              {activityParticipants.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-full font-bold shrink-0 bg-[#EDE9FE] text-[#7C3AED]"
                    style={{ width: 32, height: 32, fontSize: 11 }}
                  >
                    {p.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink">
                      {p.name}
                    </div>
                    <div className="text-xs text-faint">{p.role}</div>
                  </div>
                </div>
              ))}
              <button className="text-xs font-semibold mt-1 text-crimson">
                ดูทั้งหมด {participantsCount} คน →
              </button>
            </div>
          </div>

          {/* Related MoU */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-3 text-ink">MoU ที่เกี่ยวข้อง</h2>
            <Link
              href={`/documents/${mouDocId}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-soft transition-colors"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EDE9FE]">
                <FileText className="w-4 h-4 text-[#7C3AED]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">
                  MoU NTU 2567
                </div>
                <div className="text-xs text-faint">หมดอายุ 31 ธ.ค. 2571</div>
              </div>
              <ChevronRight className="w-4 h-4 text-faint" />
            </Link>
          </div>

          {/* Related Stakeholder */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-3 text-ink">หน่วยงาน</h2>
            <Link
              href="/stakeholders/2"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-soft transition-colors"
            >
              <div className="flex items-center justify-center rounded-full font-bold shrink-0 bg-[#DBEAFE] text-[#1D4ED8]">
                NTU
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">
                  National Taiwan University
                </div>
                <div className="text-xs text-faint">ไต้หวัน 🇹🇼</div>
              </div>
              <ChevronRight className="w-4 h-4 text-faint" />
            </Link>
          </div>

          {/* Documents */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-3 text-ink">เอกสารที่เกี่ยวข้อง</h2>
            <div className="space-y-2">
              {activityFiles.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#F8FAFC]"
                >
                  <FileText className="w-4 h-4 flex-shrink-0 text-[#DC2626]" />
                  <span className="text-xs flex-1 truncate text-mute">{f}</span>
                  {/* MOCK: ยังไม่ต่อ S3/download — ปุ่ม no-op รอ V2 */}
                  <button title="ดาวน์โหลด (mock)">
                    <Download className="w-3.5 h-3.5 text-faint" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
