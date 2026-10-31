"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import {
  apiDelete, apiGetFresh, apiPatch, apiPost, formatThaiDate, useApiResource,
  type Outcome, type OutcomeContextField, type OutcomeInput, type OutcomePage, type OutcomeType,
} from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { DateInput, Dialog, Field, FormError, Notice, inputCls, orNull, useAction } from "@/components/form-ui";

type Draft = { outcomeTypeId: string; title: string; value: string; unit: string; occurredOn: string; evidenceUrl: string; description: string };
// List filters stay snake_case query parameters, like the other endpoints'.
const queryParam: Record<OutcomeContextField, string> = {
  partnerId: "partner_id", activityId: "activity_id", documentId: "document_id", exchangeId: "exchange_id",
};
const emptyDraft: Draft = { outcomeTypeId: "", title: "", value: "", unit: "", occurredOn: "", evidenceUrl: "", description: "" };

function toDraft(row: Outcome): Draft {
  return {
    outcomeTypeId: String(row.outcomeType.id), title: row.title,
    value: row.value === null ? "" : String(row.value), unit: row.unit === row.outcomeType.unit ? "" : row.unit ?? "",
    occurredOn: row.occurredOn ?? "", evidenceUrl: row.evidenceUrl ?? "", description: row.description ?? "",
  };
}

/**
 * Outcomes of one partner, agreement, activity or exchange record. Each row's
 * canEdit comes from the server; canAdd only shows the add button (the server
 * still refuses records the caller is not responsible for).
 */
export function OutcomeSection({ field, id, canAdd, canPublish }: {
  field: OutcomeContextField; id: number; canAdd: boolean; canPublish: boolean;
}) {
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Outcome | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const action = useAction();
  const outcomes = useApiResource(() => apiGetFresh<OutcomePage>(`/outcomes/?${queryParam[field]}=${id}&page_size=100`), [field, id, reload]);
  // Loaded on every render so a type an admin just added is offered straight away.
  const types = useApiResource(() => editing !== null ? apiGetFresh<OutcomeType[]>("/outcomes/types") : Promise.resolve([]), [editing !== null]);

  const done = (message: string) => { setNotice(message); setEditing(null); setReload((n) => n + 1); };
  const open = (row: Outcome | "new") => { action.clear(); setDraft(row === "new" ? emptyDraft : toDraft(row)); setEditing(row); };
  const set = (key: keyof Draft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body: OutcomeInput = {
      outcomeTypeId: Number(draft.outcomeTypeId), title: draft.title.trim(),
      value: draft.value.trim() === "" ? null : Number(draft.value), unit: orNull(draft.unit),
      occurredOn: orNull(draft.occurredOn), evidenceUrl: orNull(draft.evidenceUrl), description: orNull(draft.description),
    };
    if (editing === "new") {
      if (await action.run(() => apiPost("/outcomes/", { ...body, [field]: id }))) done("เพิ่มผลลัพธ์แล้ว");
    } else if (editing) {
      if (await action.run(() => apiPatch(`/outcomes/${editing.id}`, body))) done("บันทึกผลลัพธ์แล้ว");
    }
  };

  const togglePublish = async (row: Outcome) => {
    if (await action.run(() => apiPatch(`/outcomes/${row.id}`, { isPublished: !row.isPublished }))) {
      done(row.isPublished ? "ยกเลิกการเผยแพร่แล้ว" : "เผยแพร่ผลลัพธ์แล้ว");
    }
  };

  const remove = async (row: Outcome) => {
    if (!window.confirm(`ลบผลลัพธ์ "${row.title}" ?`)) return;
    if (await action.run(() => apiDelete(`/outcomes/${row.id}`))) done("ลบผลลัพธ์แล้ว");
  };

  return (
    <section className="bg-white rounded-base shadow-card p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-bold text-ink">ผลลัพธ์</h2>
        {canAdd && <button type="button" className="btn btn-outline gap-1 print:hidden" onClick={() => open("new")}><Plus className="w-3.5 h-3.5" />เพิ่มผลลัพธ์</button>}
      </div>
      <Notice text={notice} />
      {!editing && <FormError error={action.error} />}
      {outcomes.status === "loading" && <LoadingState compact title="กำลังโหลดผลลัพธ์…" />}
      {outcomes.status === "error" && <ErrorState error={outcomes.error} onRetry={outcomes.retry} />}
      {outcomes.status === "success" && (outcomes.data.items.length === 0 ? <EmptyState compact title="ยังไม่มีผลลัพธ์" /> : (
        <ul className="divide-y divide-paper">
          {outcomes.data.items.map((row) => (
            <li key={row.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-ink">{row.title}</span>
                  <span className="badge badge-gray">{row.outcomeType.name_th}</span>
                  {row.canEdit && !row.isPublished && <span className="badge badge-gray">ยังไม่เผยแพร่</span>}
                </div>
                <div className="text-xs text-faint mt-1 flex flex-wrap gap-x-3">
                  {row.value !== null && <span>{row.value.toLocaleString("th-TH")} {row.unit ?? ""}</span>}
                  {row.occurredOn && <span>{formatThaiDate(row.occurredOn)}</span>}
                  {row.evidenceUrl && <a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-crimson hover:underline">หลักฐาน<ExternalLink className="w-3 h-3" /></a>}
                </div>
                {row.description && <p className="text-sm text-faint mt-1 whitespace-pre-line">{row.description}</p>}
              </div>
              {row.canEdit && (
                <div className="flex gap-1 flex-shrink-0 print:hidden">
                  {canPublish && <button type="button" className="btn btn-outline text-xs" disabled={action.busy} onClick={() => togglePublish(row)}>{row.isPublished ? "ยกเลิกเผยแพร่" : "เผยแพร่"}</button>}
                  <button type="button" className="btn p-1.5 text-faint hover:bg-soft" aria-label={`แก้ไข ${row.title}`} onClick={() => open(row)}><Pencil className="w-3.5 h-3.5" /></button>
                  {canPublish && <button type="button" className="btn p-1.5 text-faint hover:bg-soft" aria-label={`ลบ ${row.title}`} disabled={action.busy} onClick={() => remove(row)}><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ))}

      <Dialog open={editing !== null} title={editing === "new" ? "เพิ่มผลลัพธ์" : "แก้ไขผลลัพธ์"} onClose={() => setEditing(null)}>
        <form onSubmit={submit}>
          <Field label="ประเภทผลลัพธ์">
            <select className={inputCls} required value={draft.outcomeTypeId} onChange={(e) => set("outcomeTypeId")(e.target.value)}>
              <option value="" disabled>เลือกประเภท</option>
              {types.status === "success" && types.data.map((t) => <option key={t.id} value={t.id}>{t.name_th}{t.unit ? ` (${t.unit})` : ""}</option>)}
            </select>
          </Field>
          {types.status === "error" && <ErrorState error={types.error} onRetry={types.retry} />}
          <Field label="ชื่อผลลัพธ์"><input className={inputCls} required maxLength={300} value={draft.title} onChange={(e) => set("title")(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="จำนวน"><input className={inputCls} type="number" step="any" value={draft.value} onChange={(e) => set("value")(e.target.value)} /></Field>
            <Field label="หน่วย" hint="เว้นว่างเพื่อใช้หน่วยของประเภท"><input className={inputCls} maxLength={50} value={draft.unit} onChange={(e) => set("unit")(e.target.value)} /></Field>
          </div>
          <Field label="วันที่เกิดผลลัพธ์"><DateInput value={draft.occurredOn} onChange={(e) => set("occurredOn")(e.target.value)} /></Field>
          <Field label="ลิงก์หลักฐาน" hint="ต้องขึ้นต้นด้วย https://"><input className={inputCls} type="url" pattern="https://.*" value={draft.evidenceUrl} onChange={(e) => set("evidenceUrl")(e.target.value)} /></Field>
          <Field label="รายละเอียด"><textarea className={inputCls} rows={3} maxLength={5000} value={draft.description} onChange={(e) => set("description")(e.target.value)} /></Field>
          <FormError error={action.error} />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>ยกเลิก</button>
            <button className="btn btn-primary" disabled={action.busy}>บันทึก</button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
