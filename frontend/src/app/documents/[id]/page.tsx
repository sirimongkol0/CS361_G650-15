"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/data-states";
import { RelatedRecords } from "@/components/related-records";
import { SourceLinks } from "@/components/source-links";
import { ApiError, loadDocument, useApiResource } from "@/lib/api";
import { DocumentDownload } from "@/components/document-download";
import { documentStatusLabels, documentTypeLabels, formatFileSize, label } from "@/lib/labels";
import { DetailToolbar } from "@/components/detail-toolbar";
import { DocumentPreview } from "@/components/document-preview";
import { ExpiryBadge } from "@/components/expiry-badge";
import { daysFromToday, relativeDays, useDocumentTitle } from "@/lib/list-tools";


export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const documents = useApiResource(() => Number.isInteger(id) && id > 0
    ? loadDocument(id) : Promise.reject(new ApiError("Invalid document id", 404)), [id]);
  useDocumentTitle(documents.status === "success" ? documents.data.title : "เอกสารข้อตกลง");

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
      <DetailToolbar kind="documents" id={doc.id} title={doc.title} />

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-ink font-display">{doc.title}</h1>
            {doc.type && <span className="badge badge-blue">{label(documentTypeLabels, doc.type)}</span>}
            <span className="badge badge-gray">{doc.status ? label(documentStatusLabels, doc.status) : "ไม่ระบุสถานะ"}</span>
            <ExpiryBadge expiryDate={doc.expiryDate} withText />
          </div>
          {(doc.org || doc.start || doc.expire) && (
            <p className="text-sm text-faint">
              {[doc.org, doc.start && `เริ่ม ${doc.start}`, doc.expire && `หมดอายุ ${doc.expire}`].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {(doc.start || doc.expire || doc.responsible || doc.signerOur || doc.signerPartner) && (
            <section className="bg-white rounded-base shadow-card p-5">
              <h2 className="font-bold mb-4 text-ink">ข้อมูลข้อตกลง</h2>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
                {doc.start && <div><dt className="text-xs font-semibold text-faint">วันที่มีผล</dt><dd className="text-sm font-medium text-ink">{doc.start}{(() => { const days = daysFromToday(doc.effectiveDate); return days !== null && days > 0 ? <span className="ml-1 text-xs text-faint">({relativeDays(days, "อีก", "")})</span> : null; })()}</dd></div>}
                {doc.expire && <div><dt className="text-xs font-semibold text-faint">วันหมดอายุ</dt><dd className="text-sm font-medium text-ink">{doc.expire}{(() => { const days = daysFromToday(doc.expiryDate); return days !== null ? <span className="ml-1 text-xs text-faint">({relativeDays(days, "เหลืออีก", "สิ้นสุดเมื่อ")})</span> : null; })()}</dd></div>}
                {doc.responsible && <div><dt className="text-xs font-semibold text-faint">ผู้รับผิดชอบ</dt><dd className="text-sm font-medium text-ink">{doc.responsible}</dd></div>}
                {doc.signerOur && <div><dt className="text-xs font-semibold text-faint">ผู้ลงนาม (ฝ่ายเรา)</dt><dd className="text-sm font-medium text-ink">{doc.signerOur}</dd></div>}
                {doc.signerPartner && <div><dt className="text-xs font-semibold text-faint">ผู้ลงนาม (หน่วยงาน)</dt><dd className="text-sm font-medium text-ink">{doc.signerPartner}</dd></div>}
              </dl>
            </section>
          )}

          {doc.scopeItems.length > 0 && (
            <section className="bg-white rounded-base shadow-card p-5">
              <h2 className="font-bold mb-4 text-ink">ขอบเขตความร่วมมือ</h2>
              <ul className="space-y-2.5 list-disc pl-5 text-sm text-mute">
                {doc.scopeItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
              </ul>
            </section>
          )}

          {doc.downloadable && (doc.mimeType === "application/pdf" || /\.pdf$/i.test(doc.fileName ?? "")) && <DocumentPreview id={doc.id} />}
          <RelatedRecords kind="activities" documentId={doc.id} />
          <SourceLinks sources={doc.sources} />
        </div>

        <aside className="space-y-5">
          <section className="bg-white rounded-base shadow-card p-5">
            <h2 className="font-bold mb-3 text-ink">ไฟล์เอกสาร</h2>
            <p className="text-sm text-faint mb-3">{doc.fileAvailabilityLabel}</p>
            {doc.fileName && <p className="text-sm text-mute break-words mb-2">{doc.fileName}</p>}
            {(doc.mimeType || doc.sizeBytes !== null) && <p className="text-xs text-faint mb-3">
              {[doc.mimeType, doc.sizeBytes !== null ? formatFileSize(doc.sizeBytes) : null].filter(Boolean).join(" • ")}
            </p>}
            {doc.downloadable && <DocumentDownload id={doc.id} fileName={doc.fileName} />}
          </section>
          {doc.partnerId !== null && doc.org && (
            <section className="bg-white rounded-base shadow-card p-5">
              <h2 className="font-bold mb-3 text-ink">หน่วยงาน</h2>
              <Link href={`/stakeholders/${doc.partnerId}`} className="text-sm font-semibold text-crimson hover:underline">{doc.org}</Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
