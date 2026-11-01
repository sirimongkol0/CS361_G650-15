"use client";

// V4-6 (#99): what was improved because of feedback (PDCA "Act").
// Staff/admin see it per feedback entry; coordinators see the improvements on
// feedback about their own partners/activities. Only staff/admin delete.

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Wrench } from "lucide-react";
import {
  createImprovement, deleteImprovement, formatThaiDate, loadImprovementFeedbackOptions, loadImprovements,
  updateImprovement, useApiResource, type Improvement, type ImprovementFeedback, type ImprovementStatus,
} from "@/lib/api";
import { improvementStatusLabels, label } from "@/lib/labels";
import { DateInput, Field, FormError, inputCls, orNull, useAction } from "@/components/form-ui";
import { ErrorState, LoadingState } from "@/components/data-states";

const STATUSES: ImprovementStatus[] = ["planned", "in_progress", "done"];

export const improvementStatusColors: Record<ImprovementStatus, string> = {
  planned: "badge-gray",
  in_progress: "badge-gold",
  done: "badge-green",
};

function ImprovementForm({ initial, feedbackId, options, onDone, onCancel }: {
  initial?: Improvement;
  /** Pre-selected, fixed entry when the form is opened from one feedback. */
  feedbackId?: number;
  options: ImprovementFeedback[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [actionDate, setActionDate] = useState(initial?.actionDate ?? "");
  const [responsible, setResponsible] = useState(initial?.responsible ?? "");
  const [status, setStatus] = useState<ImprovementStatus>(initial?.status ?? "planned");
  const [linked, setLinked] = useState<number[]>(
    initial?.feedbacks.map((f) => f.id) ?? (feedbackId != null ? [feedbackId] : [])
  );
  const action = useAction();

  const toggle = (id: number) => setLinked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      title: title.trim(), description: orNull(description), actionDate: actionDate || null,
      responsible: orNull(responsible), status, feedbackIds: linked,
    };
    const ok = await action.run(() => (initial ? updateImprovement(initial.id, body) : createImprovement(body)));
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-line p-3 space-y-2 bg-soft">
      <FormError error={action.error} />
      <Field label="สิ่งที่ปรับปรุง">
        <input className={inputCls} required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="รายละเอียด">
        <textarea className={`${inputCls} resize-y`} rows={2} maxLength={5000} value={description}
          onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="วันที่ดำเนินการ"><DateInput value={actionDate} onChange={(e) => setActionDate(e.target.value)} /></Field>
        <Field label="สถานะ">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ImprovementStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{label(improvementStatusLabels, s)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="ผู้รับผิดชอบ">
        <input className={inputCls} maxLength={200} placeholder="เช่น กรรมการบริหารหลักสูตร" value={responsible}
          onChange={(e) => setResponsible(e.target.value)} />
      </Field>
      <fieldset>
        <legend className="text-xs font-semibold text-mute mb-1">ความคิดเห็นที่เกี่ยวข้อง (เลือกได้หลายรายการ)</legend>
        <div className="max-h-40 overflow-y-auto rounded-md border border-line bg-white p-2 space-y-1">
          {options.length === 0 && <p className="text-xs text-faint">ไม่มีความคิดเห็นที่เลือกได้</p>}
          {options.map((f) => (
            <label key={f.id} className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={linked.includes(f.id)} onChange={() => toggle(f.id)} />
              <span>{f.title}{f.date && <span className="text-xs text-faint"> · {formatThaiDate(f.date)}</span>}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary py-1.5" disabled={action.busy || linked.length === 0 || !title.trim()}>
          บันทึกการปรับปรุง
        </button>
        <button type="button" className="btn btn-outline py-1.5" onClick={onCancel}>ยกเลิก</button>
      </div>
    </form>
  );
}

/** Improvements for one feedback entry, or (no feedbackId) every improvement the caller may see. */
export function ImprovementSection({ feedbackId, canDelete, onChanged }: {
  feedbackId?: number;
  canDelete: boolean;
  onChanged?: () => void;
}) {
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const resource = useApiResource(
    () => Promise.all([loadImprovements(feedbackId), loadImprovementFeedbackOptions()]),
    [feedbackId, reload]
  );
  const action = useAction();

  const changed = () => {
    setEditing(null);
    setReload((n) => n + 1);
    onChanged?.();
  };
  const remove = async (row: Improvement) => {
    if (!window.confirm(`ลบการปรับปรุง "${row.title}"?`)) return;
    if (await action.run(() => deleteImprovement(row.id))) changed();
  };

  return (
    <section className="mt-5 pt-4 border-t border-line" aria-label="การปรับปรุงจากความคิดเห็น">
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Wrench className="w-4 h-4 text-faint" />
          การปรับปรุงที่ดำเนินการ
        </h3>
        {resource.status === "success" && editing === null && (
          <button type="button" className="btn btn-outline gap-1 py-1 px-2 text-xs" onClick={() => setEditing("new")}>
            <Plus className="w-3.5 h-3.5" />
            เพิ่ม
          </button>
        )}
      </div>
      <FormError error={action.error} />
      {resource.status === "loading" && <LoadingState title="กำลังโหลดการปรับปรุง…" />}
      {resource.status === "error" && <ErrorState error={resource.error} onRetry={resource.retry} />}
      {resource.status === "success" && (() => {
        const [rows, options] = resource.data;
        return (
          <div className="space-y-2">
            {editing === "new" && (
              <ImprovementForm feedbackId={feedbackId} options={options} onDone={changed} onCancel={() => setEditing(null)} />
            )}
            {rows.length === 0 && editing !== "new" && (
              <p className="text-xs text-faint">ยังไม่มีการบันทึกการปรับปรุงจากความคิดเห็นนี้</p>
            )}
            {rows.map((row) => editing === row.id ? (
              <ImprovementForm key={row.id} initial={row} options={options} onDone={changed} onCancel={() => setEditing(null)} />
            ) : (
              <article key={row.id} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{row.title}</p>
                  <span className={`badge ${improvementStatusColors[row.status]}`}>{label(improvementStatusLabels, row.status)}</span>
                </div>
                {row.description && <p className="mt-1 text-sm text-mute whitespace-pre-line">{row.description}</p>}
                <p className="mt-1 text-xs text-faint">
                  {row.actionDate ? formatThaiDate(row.actionDate) : "ยังไม่กำหนดวันที่"}
                  {row.responsible && <> · {row.responsible}</>}
                </p>
                {row.feedbacks.length > (feedbackId != null ? 1 : 0) && (
                  <p className="mt-1 text-xs text-faint">จากความคิดเห็น: {row.feedbacks.map((f) => f.title).join(", ")}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn btn-outline gap-1 py-1 px-2 text-xs" onClick={() => setEditing(row.id)}>
                    <Pencil className="w-3 h-3" />
                    แก้ไข
                  </button>
                  {canDelete && (
                    <button type="button" className="btn btn-outline gap-1 py-1 px-2 text-xs" disabled={action.busy}
                      onClick={() => remove(row)}>
                      <Trash2 className="w-3 h-3" />
                      ลบ
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        );
      })()}
    </section>
  );
}
