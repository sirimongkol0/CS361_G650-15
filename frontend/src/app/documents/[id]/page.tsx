"use client";

// Ported from legacy/figma-mock/src/pages/DocumentDetail.tsx (Next.js App Router + TU theme tokens).
// Mock detail content is written for document id=1 (MoU ความร่วมมือทางวิชาการ มช.);
// header fields fall back to it when the id does not resolve in the mock data.

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Edit,
} from "lucide-react";
import {
  documents,
  documentFile,
  documentInfoRows,
  documentRelatedActivities,
  documentScope,
  documentTimeline,
  documentStatusMap,
} from "@/lib/mock";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const doc = documents.find((d) => d.id === id);

  const title = doc?.title ?? "MoU ความร่วมมือทางวิชาการ มช.";
  const statusKey = doc?.status ?? "active";
  const statusLabel = documentStatusMap[statusKey].label;
  const type = doc?.type ?? "MoU";
  const org = doc?.org ?? "มหาวิทยาลัยเชียงใหม่";
  const start = doc?.start ?? "1 ม.ค. 2567";
  const expire = doc?.expire ?? "31 ธ.ค. 2571";

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs mb-5 text-faint">
        <Link href="/" className="text-faint hover:text-crimson">
          หน้าหลัก
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/documents" className="text-faint hover:text-crimson">
          เอกสารข้อตกลง
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-crimson">{title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-ink font-display">{title}</h1>
            <span className="badge badge-green">{statusLabel}</span>
            <span className="badge badge-blue">{type}</span>
          </div>
          <p className="text-sm text-faint">
            {org} • เริ่ม {start} • หมดอายุ {expire}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline gap-2">
            <Edit className="w-4 h-4" />
            แก้ไข
          </button>
          {/* MOCK: ยังไม่ต่อ S3/download — ปุ่ม no-op รอ V2 */}
          <button className="btn btn-primary gap-2" title="ดาวน์โหลด (mock)">
            <Download className="w-4 h-4" />
            ดาวน์โหลด
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Main */}
        <div className="space-y-5">
          {/* Info */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-4 text-ink">ข้อมูลข้อตกลง</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {documentInfoRows.map((row) => (
                <div key={row.label}>
                  <div className="text-xs font-semibold mb-0.5 text-faint">
                    {row.label}
                  </div>
                  <div className="text-sm font-medium text-ink">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-4 text-ink">ขอบเขตความร่วมมือ</h2>
            <ul className="space-y-2.5">
              {documentScope.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-mute"
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#16a34a]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Related Activities */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-ink">กิจกรรมที่เกี่ยวข้อง</h2>
              <Link href="/activities" className="text-xs font-semibold text-crimson">
                ดูทั้งหมด
              </Link>
            </div>
            <div className="space-y-3">
              {documentRelatedActivities.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#DBEAFE]">
                    <Clock className="w-4 h-4 text-[#1D4ED8]" />
                  </div>
                  <div className="flex-1">
                    {/* ลิงก์เฉพาะเมื่อ id ตรงกับ mock exports จริง กัน 404 */}
                    {a.activityId !== undefined ? (
                      <Link
                        href={`/activities/${a.activityId}`}
                        className="text-sm font-semibold hover:underline text-ink"
                      >
                        {a.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-ink">
                        {a.name}
                      </span>
                    )}
                    <div className="text-xs text-faint">{a.date}</div>
                  </div>
                  <span className={`badge ${a.statusColor}`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Document file */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-4 text-ink">เอกสาร</h2>
            <div
              className="rounded-xl p-4"
              style={{ background: "#FEF2F2", border: "2px dashed #FECACA" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FEE2E2]">
                  <FileText className="w-5 h-5 text-[#DC2626]" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-ink">
                    {documentFile.name}
                  </div>
                  <div className="text-xs text-faint">{documentFile.meta}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {/* MOCK: ยังไม่ต่อ S3 — ปุ่ม no-op รอ V2 */}
                <button
                  className="btn btn-outline text-xs flex-1 gap-1.5 py-2"
                  title="ดูตัวอย่าง (mock)"
                >
                  <Eye className="w-3.5 h-3.5" />
                  ดูตัวอย่าง
                </button>
                <button
                  className="btn btn-primary text-xs flex-1 gap-1.5 py-2"
                  title="ดาวน์โหลด (mock)"
                >
                  <Download className="w-3.5 h-3.5" />
                  ดาวน์โหลด
                </button>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-5 text-ink">ความคืบหน้า</h2>
            <div className="relative">
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[#E2E8F0]" />
              <div className="space-y-5">
                {documentTimeline.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 relative">
                    <div
                      className="z-10 w-3 h-3 rounded-full border-2"
                      style={{
                        borderColor: step.current
                          ? "#4f46e5"
                          : step.done
                            ? "#16a34a"
                            : "#d1d5db",
                        background: step.current
                          ? "#4f46e5"
                          : step.done
                            ? "#16a34a"
                            : "#fff",
                      }}
                    />
                    <div className="flex-1">
                      <div
                        className="text-sm font-semibold flex items-center gap-2"
                        style={{
                          color: step.current
                            ? "#4f46e5"
                            : step.done
                              ? "#1e293b"
                              : "#94a3b8",
                        }}
                      >
                        {step.label}
                        {step.current && (
                          <span className="badge text-xs bg-[#E0E7FF] text-[#4338CA]">
                            ปัจจุบัน
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-faint">{step.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Related Stakeholder */}
          <div className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-3 text-ink">หน่วยงาน</h2>
            <Link
              href="/stakeholders/1"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-soft transition-colors"
            >
              <div className="flex items-center justify-center rounded-full font-bold shrink-0 bg-[#EDE9FE] text-[#7C3AED]">
                มช
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-ink">
                  มหาวิทยาลัยเชียงใหม่
                </div>
                <div className="text-xs text-faint">มหาวิทยาลัย • ไทย 🇹🇭</div>
              </div>
              <ChevronRight className="w-4 h-4 text-faint" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
