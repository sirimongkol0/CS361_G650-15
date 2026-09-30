"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/data-states";
import { RelatedRecords } from "@/components/related-records";
import { SourceLinks } from "@/components/source-links";
import { ApiError, loadDocument, useApiResource } from "@/lib/api";

import { DocumentDownload } from "@/components/document-download";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const documents = useApiResource(() => Number.isInteger(id) && id > 0
    ? loadDocument(id) : Promise.reject(new ApiError("Invalid document id", 404)), [id]);

  if (documents.status === "loading") {
    return <div className="p-6 max-w-screen-xl mx-auto"><LoadingState title="กำลังโหลดรายละเอียดเอกสาร" /></div>;
  }
  if (documents.status === "error") {
    return <div className="p-6 max-w-screen-xl mx-auto"><ErrorState error={documents.error} onRetry={documents.retry} /></div>;
  }

  const doc = documents.data;

return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs mb-5 text-faint">
        <Link href="/" className="hover:text-crimson">หน้าหลัก</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/documents" className="hover:text-crimson">เอกสารข้อตกลง</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-crimson">{doc.title}</span>
      </nav>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-ink font-display">{doc.title}</h1>
            <span className={`badge ${doc.downloadable ? "badge-green" : "badge-gray"}`}>
              {doc.fileAvailabilityLabel}
            </span>
            {doc.type && <span className="badge badge-blue">{doc.type}</span>}
            {doc.status && <span className="badge badge-gray">{doc.status}</span>}
          </div>
          {(doc.org || doc.start || doc.expire) && (
            <p className="text-sm text-faint">
              {[doc.org, doc.start && `เริ่ม ${doc.start}`, doc.expire && `หมดอายุ ${doc.expire}`].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>
        {doc.downloadable && (
          <DocumentDownload id={doc.id} fileName={doc.fileName} className="btn btn-primary gap-2" />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {(doc.start || doc.expire || doc.responsible || doc.signerOur || doc.signerPartner || doc.fileName || doc.mimeType || doc.sizeBytes !== null) && (
            <section className="bg-white border border-line rounded-lg shadow-card p-5">
              <h2 className="font-bold mb-4 text-ink">ข้อมูลข้อตกลง</h2>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
                {doc.start && <div><dt className="text-xs font-semibold text-faint">วันที่มีผล</dt><dd className="text-sm font-medium text-ink">{doc.start}</dd></div>}
                {doc.expire && <div><dt className="text-xs font-semibold text-faint">วันหมดอายุ</dt><dd className="text-sm font-medium text-ink">{doc.expire}</dd></div>}
                {doc.responsible && <div><dt className="text-xs font-semibold text-faint">ผู้รับผิดชอบ</dt><dd className="text-sm font-medium text-ink">{doc.responsible}</dd></div>}
                {doc.signerOur && <div><dt className="text-xs font-semibold text-faint">ผู้ลงนาม (ฝ่ายเรา)</dt><dd className="text-sm font-medium text-ink">{doc.signerOur}</dd></div>}
                {doc.signerPartner && <div><dt className="text-xs font-semibold text-faint">ผู้ลงนาม (หน่วยงาน)</dt><dd className="text-sm font-medium text-ink">{doc.signerPartner}</dd></div>}
                {doc.fileName && <div><dt className="text-xs font-semibold text-faint">ชื่อไฟล์</dt><dd className="text-sm font-medium text-ink break-all">{doc.fileName}</dd></div>}
                {doc.mimeType && <div><dt className="text-xs font-semibold text-faint">รูปแบบไฟล์</dt><dd className="text-sm font-medium text-ink">{doc.mimeType}</dd></div>}
                {doc.sizeBytes !== null && <div><dt className="text-xs font-semibold text-faint">ขนาดไฟล์</dt><dd className="text-sm font-medium text-ink">{doc.sizeBytes.toLocaleString()} bytes</dd></div>}
              </dl>
            </section>
          )}

          {doc.scopeItems.length > 0 && (
            <section className="bg-white border border-line rounded-lg shadow-card p-5">
              <h2 className="font-bold mb-4 text-ink">ขอบเขตความร่วมมือ</h2>
              <ul className="space-y-2.5 list-disc pl-5 text-sm text-mute">
                {doc.scopeItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
              </ul>
            </section>
          )}

          <RelatedRecords kind="activities" documentId={doc.id} />
          <SourceLinks sources={doc.sources} />
        </div>

        <aside className="space-y-5">
          <section className="bg-white border border-line rounded-lg shadow-card p-5">
            <h2 className="font-bold mb-3 text-ink">ไฟล์เอกสาร</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FEE2E2]">
                <FileText className="w-5 h-5 text-[#DC2626]" />
              </div>
              <div>
                <div className="font-semibold text-sm text-ink">{doc.fileName ?? doc.title}</div>
                <div className="text-xs text-faint">{doc.downloadable ? "ไฟล์พร้อมดาวน์โหลด" : doc.fileAvailability === "unavailable" ? "ระบุว่าไฟล์ยังไม่พร้อมใช้งาน" : "มีเฉพาะข้อมูลเมทาดาทา ไม่มีไฟล์ให้ดาวน์โหลด"}</div>
              </div>
            </div>
            {doc.downloadable && <DocumentDownload id={doc.id} fileName={doc.fileName} className="btn btn-outline mt-4 w-full justify-center gap-2" />}
          </section>
          {doc.partnerId !== null && doc.org && (
            <section className="bg-white border border-line rounded-lg shadow-card p-5">
              <h2 className="font-bold mb-3 text-ink">หน่วยงาน</h2>
              <Link href={`/stakeholders/${doc.partnerId}`} className="text-sm font-semibold text-crimson hover:underline">{doc.org}</Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
