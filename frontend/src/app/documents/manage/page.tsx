"use client";

// V3-3 agreement management: drafts, PDF upload, approval/status, CSTU review,
// publication and soft delete. The buttons follow docs/decisions/v3-role-permissions.md;
// the backend re-checks every action, and its reason is shown when it refuses.

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Download, FilePlus2, Settings2, Trash2, Upload } from "lucide-react";
import {
  apiBase, apiDelete, apiGetFresh, apiPatch, apiPost, apiPut, apiUpload, formatThaiDate, loadManagedDocuments,
  loadPublicPartners, useApiResource, type ManagedDocument, type PartnerView,
} from "@/lib/api";
import { cstuStatusColors, cstuStatusLabels, documentStatusLabels, label, scopeLevelLabels } from "@/lib/labels";
import { canManage, useRole } from "@/lib/role-context";
import { AccessState, EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Dialog, Field, FormError, Notice, inputCls, orNull, useAction } from "@/components/form-ui";
import { useDocumentTitle } from "@/lib/list-tools";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // same limit as the backend (MAX_UPLOAD_BYTES)

// Mirrors TRANSITIONS in backend/routers/documents.py.
const TRANSITIONS: Record<string, string[]> = {
  draft: ["approved", "cancelled"],
  approved: ["active", "cancelled"],
  active: ["expired", "cancelled"],
  expiring: ["expired", "cancelled"],
  expired: [],
  cancelled: [],
};
const transitionLabels: Record<string, string> = {
  approved: "อนุมัติ",
  active: "เริ่มมีผล",
  expired: "หมดอายุ",
  cancelled: "ยกเลิก",
};
const statusColors: Record<string, string> = {
  draft: "badge-gray", approved: "badge-blue", active: "badge-green",
  expiring: "badge-gold", expired: "badge-gray", cancelled: "badge-gray",
};

const currentStatus = (doc: ManagedDocument) => doc.status ?? "draft";

export default function ManageDocumentsPage() {
  useDocumentTitle("จัดการข้อตกลง");
  const { role, user, status: session } = useRole();
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const allowed = session === "authenticated" && canManage(role);
  const documents = useApiResource<ManagedDocument[]>(
    () => (allowed ? loadManagedDocuments() : new Promise<never>(() => {})),
    [allowed, reload]
  );
  const partners = useApiResource<PartnerView[]>(
    () => (allowed ? loadPublicPartners() : new Promise<never>(() => {})),
    [allowed]
  );
  const partnerList = partners.status === "success" ? partners.data : [];
  // Keep the last loaded list while reloading after an action, so the open dialog stays open.
  const [rows, setRows] = useState<ManagedDocument[] | null>(null);
  useEffect(() => {
    if (documents.status === "success") setRows(documents.data);
  }, [documents.status, documents.data]);
  const selected = rows?.find((d) => d.id === selectedId) ?? null;

  const refresh = (message?: string) => {
    setNotice(message ?? null);
    setReload((n) => n + 1);
  };

  if (session === "loading") return <div className="p-6"><LoadingState /></div>;
  if (session !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (!canManage(role)) return <div className="p-6"><AccessState status={403} /></div>;

  const isStaff = role === "staff" || role === "admin";

  return (
    <div className="mx-auto max-w-screen-xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-faint">
            <Link href="/documents" className="text-faint hover:text-crimson">เอกสารข้อตกลง</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-crimson">จัดการข้อตกลง</span>
          </nav>
          <h1 className="font-display text-2xl font-bold text-ink">จัดการข้อตกลง</h1>
          <p className="mt-0.5 text-sm text-faint">
            {isStaff
              ? "ข้อตกลงทั้งหมด รวมฉบับร่างและรายการที่ยังไม่เผยแพร่"
              : "ข้อตกลงที่คุณรับผิดชอบ สร้างร่างและแนบไฟล์ได้ การอนุมัติและเผยแพร่เป็นของเจ้าหน้าที่"}
          </p>
        </div>
        <button className="btn btn-primary gap-2" type="button" onClick={() => { setNotice(null); setCreating(true); }}>
          <FilePlus2 className="h-4 w-4" />
          สร้างร่างข้อตกลง
        </button>
      </div>

      <Notice text={notice} />

      {rows === null && documents.status === "loading" && <LoadingState />}
      {documents.status === "error" && <ErrorState error={documents.error} onRetry={documents.retry} />}
      {rows !== null && rows.length === 0 && (
        <EmptyState title="ยังไม่มีข้อตกลงที่คุณจัดการได้" message="กด “สร้างร่างข้อตกลง” เพื่อเริ่ม" />
      )}
      {rows !== null && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-soft text-left text-xs font-semibold text-faint">
                  <th className="px-5 py-3">ชื่อข้อตกลง</th>
                  <th className="px-4 py-3">หน่วยงาน</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">CSTU</th>
                  <th className="px-4 py-3">เผยแพร่</th>
                  <th className="px-4 py-3">ไฟล์</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((doc) => (
                  <tr key={doc.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">
                      {doc.name}
                      {doc.ownerUserId === user?.id && <span className="badge badge-indigo ml-2">ของคุณ</span>}
                    </td>
                    <td className="px-4 py-3 text-faint">{doc.partner?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusColors[currentStatus(doc)] ?? "badge-gray"}`}>
                        {label(documentStatusLabels, currentStatus(doc))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${cstuStatusColors[doc.cstuStatus]}`}>{label(cstuStatusLabels, doc.cstuStatus)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {doc.isPublished ? <span className="badge badge-green">เผยแพร่</span> : <span className="badge badge-gray">ไม่เผยแพร่</span>}
                    </td>
                    <td className="px-4 py-3 text-faint">{doc.fileName ? "PDF" : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn btn-outline gap-1.5 px-3 py-1.5 text-xs" type="button"
                        onClick={() => { setNotice(null); setSelectedId(doc.id); }}>
                        <Settings2 className="h-3.5 w-3.5" />
                        จัดการ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={creating} title="สร้างร่างข้อตกลง" onClose={() => setCreating(false)} wide>
        <DocumentForm
          partners={partnerList}
          onCancel={() => setCreating(false)}
          onSaved={(doc) => { setCreating(false); refresh(`สร้างร่าง “${doc.name}” แล้ว`); setSelectedId(doc.id); }}
        />
      </Dialog>

      <Dialog open={selected !== null} title={selected ? `จัดการ: ${selected.name}` : ""} onClose={() => setSelectedId(null)} wide>
        {selected && (
          <ManagePanel
            key={selected.id}
            doc={selected}
            partners={partnerList}
            isStaff={isStaff}
            isOwner={selected.ownerUserId === user?.id}
            onChanged={(message) => refresh(message)}
            onDeleted={(message) => { setSelectedId(null); refresh(message); }}
          />
        )}
      </Dialog>
    </div>
  );
}

/* ---------- Create / edit form ---------- */

function DocumentForm({
  doc, partners, onSaved, onCancel,
}: {
  doc?: ManagedDocument;
  partners: PartnerView[];
  onSaved: (doc: ManagedDocument) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: doc?.name ?? "",
    doc_type: doc?.docType ?? "mou",
    partner_id: doc?.partnerId ? String(doc.partnerId) : "",
    effective_date: doc?.effectiveDate ?? "",
    expiry_date: doc?.expiryDate ?? "",
    responsible: doc?.responsible ?? "",
    signer_our: doc?.signerOur ?? "",
    signer_partner: doc?.signerPartner ?? "",
    scope_level: doc?.scopeLevel ?? "",
  });
  const action = useAction();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name.trim(),
      doc_type: form.doc_type,
      partner_id: form.partner_id ? Number(form.partner_id) : null,
      effective_date: orNull(form.effective_date),
      expiry_date: orNull(form.expiry_date),
      responsible: orNull(form.responsible),
      signer_our: orNull(form.signer_our),
      signer_partner: orNull(form.signer_partner),
      scope_level: orNull(form.scope_level),
    };
    let saved: ManagedDocument | null = null;
    const ok = await action.run(async () => {
      saved = doc
        ? await apiPatch<ManagedDocument>(`/documents/${doc.id}`, body)
        : await apiPost<ManagedDocument>("/documents/", body);
    });
    if (ok && saved) onSaved(saved);
  }

  return (
    <form onSubmit={submit}>
      <FormError error={action.error} />
      <Field label="ชื่อข้อตกลง *">
        <input className={inputCls} value={form.name} onChange={set("name")} required maxLength={255} />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="ประเภท">
          <select className={inputCls} value={form.doc_type} onChange={set("doc_type")}>
            <option value="mou">MoU</option>
            <option value="moa">MoA</option>
          </select>
        </Field>
        <Field label="หน่วยงานคู่ความร่วมมือ">
          <select className={inputCls} value={form.partner_id} onChange={set("partner_id")}>
            <option value="">— ไม่ระบุ —</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="วันที่เริ่มมีผล">
          <input className={inputCls} type="date" value={form.effective_date} onChange={set("effective_date")} />
        </Field>
        <Field label="วันหมดอายุ" hint="ต้องไม่ก่อนวันที่เริ่มมีผล">
          <input className={inputCls} type="date" value={form.expiry_date} min={form.effective_date || undefined} onChange={set("expiry_date")} />
        </Field>
        <Field label="ผู้รับผิดชอบ">
          <input className={inputCls} value={form.responsible} onChange={set("responsible")} />
        </Field>
        <Field label="ระดับความร่วมมือ">
          <select className={inputCls} value={form.scope_level} onChange={set("scope_level")}>
            <option value="">— ยังไม่ระบุ —</option>
            {Object.entries(scopeLevelLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </Field>
        <Field label="ผู้ลงนาม (ฝ่ายเรา)">
          <input className={inputCls} value={form.signer_our} onChange={set("signer_our")} />
        </Field>
        <Field label="ผู้ลงนาม (หน่วยงาน)">
          <input className={inputCls} value={form.signer_partner} onChange={set("signer_partner")} />
        </Field>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button className="btn btn-outline" type="button" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" type="submit" disabled={action.busy}>
          {action.busy ? "กำลังบันทึก…" : doc ? "บันทึกการแก้ไข" : "สร้างร่าง"}
        </button>
      </div>
    </form>
  );
}

/* ---------- Manage one agreement ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-line p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function ManagePanel({
  doc, partners, isStaff, isOwner, onChanged, onDeleted,
}: {
  doc: ManagedDocument;
  partners: PartnerView[];
  isStaff: boolean;
  isOwner: boolean;
  onChanged: (message: string) => void;
  onDeleted: (message: string) => void;
}) {
  const status = currentStatus(doc);
  // Coordinators edit only their own drafts; staff/admin edit any status.
  const canEdit = isStaff || (isOwner && status === "draft");
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [cstu, setCstu] = useState<string>(doc.cstuStatus);
  const [evidence, setEvidence] = useState(doc.cstuEvidence ?? "");
  const [sourceUrl, setSourceUrl] = useState("");
  // Public pages list only documents with a verified source; "keep" needs one.
  const needsSource = cstu === "keep" && doc.sources.length === 0 && !sourceUrl.trim();
  const action = useAction();

  const act = async (fn: () => Promise<unknown>, message: string) => {
    if (await action.run(fn)) onChanged(message);
  };

  function pickFile(selected: File | null) {
    setFile(null);
    setFileProblem(null);
    if (!selected) return;
    if (selected.type !== "application/pdf") return setFileProblem("รองรับเฉพาะไฟล์ PDF");
    if (selected.size > MAX_UPLOAD_BYTES) return setFileProblem("ไฟล์ต้องไม่เกิน 10 MB");
    setFile(selected);
  }

  async function openInternalFile() {
    // Open the tab during the click (popup blockers allow it), then point it at the
    // short-lived link once the API returns it.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    const ok = await action.run(async () => {
      const { url } = await apiGetFresh<{ url: string }>(`/documents/${doc.id}/internal-url`);
      // Local storage answers with a path on the API; S3 with a full presigned URL.
      const target = new URL(url, new URL(apiBase(), window.location.href)).toString();
      if (tab) tab.location.href = target;
      else window.location.href = target;
    });
    if (!ok) tab?.close();
  }

  if (editing) {
    return (
      <DocumentForm
        doc={doc}
        partners={partners}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => { setEditing(false); onChanged(`บันทึก “${saved.name}” แล้ว`); }}
      />
    );
  }

  return (
    <div>
      <FormError error={action.error} />

      <Section title="ข้อมูลข้อตกลง">
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div><dt className="inline text-faint">หน่วยงาน: </dt><dd className="inline">{doc.partner?.name ?? "—"}</dd></div>
          <div><dt className="inline text-faint">ประเภท: </dt><dd className="inline">{doc.docType?.toUpperCase() ?? "—"}</dd></div>
          <div><dt className="inline text-faint">ช่วงเวลา: </dt><dd className="inline">{formatThaiDate(doc.effectiveDate)} – {formatThaiDate(doc.expiryDate)}</dd></div>
          <div><dt className="inline text-faint">ผู้รับผิดชอบ: </dt><dd className="inline">{doc.responsible ?? "—"}</dd></div>
        </dl>
        {canEdit ? (
          <button className="btn btn-outline mt-3 text-sm" type="button" onClick={() => setEditing(true)}>แก้ไขข้อมูล</button>
        ) : (
          <p className="mt-3 text-xs text-faint">แก้ไขได้เฉพาะฉบับร่างของคุณ หรือโดยเจ้าหน้าที่</p>
        )}
      </Section>

      <Section title="ไฟล์ข้อตกลง (PDF)">
        <p className="mb-2 text-sm">
          {doc.fileName ? <>ไฟล์ปัจจุบัน: <span className="font-medium">{doc.fileName}</span></> : "ยังไม่มีไฟล์"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {doc.fileName && (
            <button className="btn btn-outline gap-1.5 text-sm" type="button" onClick={openInternalFile} disabled={action.busy}>
              <Download className="h-4 w-4" />
              เปิดไฟล์ (ลิงก์ 5 นาที)
            </button>
          )}
          {canEdit && (
            <>
              <input type="file" accept="application/pdf" className="text-sm"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)} aria-label="เลือกไฟล์ PDF" />
              <button className="btn btn-primary gap-1.5 text-sm" type="button" disabled={!file || action.busy}
                onClick={() => file && act(() => apiUpload(`/documents/${doc.id}/file`, file), doc.fileName ? "แทนไฟล์แล้ว" : "อัปโหลดไฟล์แล้ว")}>
                <Upload className="h-4 w-4" />
                {doc.fileName ? "แทนไฟล์" : "อัปโหลด"}
              </button>
            </>
          )}
        </div>
        {fileProblem && <p className="mt-2 text-sm text-red-700">{fileProblem}</p>}
        <p className="mt-2 text-xs text-faint">PDF เท่านั้น ไม่เกิน 10 MB</p>
      </Section>

      <Section title="สถานะข้อตกลง">
        <p className="mb-2 text-sm">
          ปัจจุบัน: <span className={`badge ${statusColors[status] ?? "badge-gray"}`}>{label(documentStatusLabels, status)}</span>
        </p>
        {isStaff ? (
          TRANSITIONS[status]?.length ? (
            <div className="flex flex-wrap gap-2">
              {TRANSITIONS[status].map((next) => (
                <button key={next} type="button" disabled={action.busy}
                  className={`btn text-sm ${next === "cancelled" ? "btn-outline" : "btn-primary"}`}
                  onClick={() => (next !== "cancelled" || confirm("ยืนยันยกเลิกข้อตกลงนี้? ย้อนกลับไม่ได้")) &&
                    act(() => apiPost(`/documents/${doc.id}/transition`, { status: next }), `เปลี่ยนสถานะเป็น “${label(documentStatusLabels, next)}” แล้ว`)}>
                  {transitionLabels[next]}
                </button>
              ))}
            </div>
          ) : <p className="text-xs text-faint">สถานะนี้สิ้นสุดแล้ว เปลี่ยนต่อไม่ได้</p>
        ) : (
          <p className="text-xs text-faint">การอนุมัติและเปลี่ยนสถานะทำโดยเจ้าหน้าที่ (ผู้สร้างไม่ใช่ผู้อนุมัติ)</p>
        )}
      </Section>

      {isStaff && (
        <Section title="ความเกี่ยวข้องกับ CSTU">
          <div className="grid gap-x-4 sm:grid-cols-[200px_1fr]">
            <Field label="ผลการตรวจ">
              <select className={inputCls} value={cstu} onChange={(e) => setCstu(e.target.value)}>
                {Object.entries(cstuStatusLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </Field>
            <Field label="หลักฐาน / แหล่งที่มา" hint="จำเป็นเมื่อเลือก “คงไว้” หรือ “นอกขอบเขต”">
              <textarea className={inputCls} rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
            </Field>
          </div>
          <Field
            label="ลิงก์แหล่งที่มาที่ตรวจแล้ว (https://)"
            hint={doc.sources.length
              ? `มีแหล่งที่มาแล้ว ${doc.sources.length} รายการ เพิ่มได้ถ้าต้องการ`
              : "จำเป็นเมื่อเลือก “คงไว้” หน้าสาธารณะแสดงเฉพาะเอกสารที่มีแหล่งที่มาที่ตรวจแล้ว"}
          >
            <input className={inputCls} type="url" pattern="https://.*" value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
          </Field>
          <button className="btn btn-primary text-sm" type="button"
            disabled={action.busy || (cstu !== "review" && !evidence.trim()) || needsSource}
            onClick={() => act(() => apiPut(`/documents/${doc.id}/cstu-status`, {
              cstu_status: cstu, cstu_evidence: orNull(evidence), source_url: orNull(sourceUrl),
            }), "บันทึกผลการตรวจ CSTU แล้ว")}>
            บันทึกผลการตรวจ
          </button>
        </Section>
      )}

      {isStaff && (
        <Section title="การเผยแพร่">
          <p className="mb-2 text-sm">
            {doc.isPublished ? "อนุญาตให้เผยแพร่" : "ไม่เผยแพร่"}
            {doc.isPublished && doc.cstuStatus !== "keep" && (
              <span className="ml-2 text-xs text-gold-dark">ยังไม่แสดงสาธารณะจนกว่าผลการตรวจ CSTU เป็น “คงไว้”</span>
            )}
          </p>
          <button className="btn btn-outline text-sm" type="button" disabled={action.busy}
            onClick={() => act(() => apiPost(`/documents/${doc.id}/${doc.isPublished ? "unpublish" : "publish"}`),
              doc.isPublished ? "ยกเลิกการเผยแพร่แล้ว" : "เผยแพร่แล้ว")}>
            {doc.isPublished ? "ยกเลิกการเผยแพร่" : "เผยแพร่"}
          </button>
        </Section>
      )}

      {isStaff && (
        <div className="flex justify-end">
          <button className="btn gap-1.5 text-sm text-red-700 hover:bg-red-50" type="button" disabled={action.busy}
            onClick={async () => {
              if (!confirm(`ลบ “${doc.name}”? รายการจะถูกซ่อนและเก็บประวัติไว้ใน audit log`)) return;
              if (await action.run(() => apiDelete(`/documents/${doc.id}`))) onDeleted(`ลบ “${doc.name}” แล้ว`);
            }}>
            <Trash2 className="h-4 w-4" />
            ลบข้อตกลง
          </button>
        </div>
      )}
    </div>
  );
}
