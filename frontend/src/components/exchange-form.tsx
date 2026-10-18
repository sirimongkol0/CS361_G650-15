"use client";

// Add/edit an exchange record (V3-4). Coordinators manage their own records,
// staff/admin all; only staff/admin may change publication.

import { useState, type FormEvent } from "react";
import { apiPatch, apiPost, type RawExchange } from "@/lib/api";
import { Field, FormError, inputCls, orNull, useAction } from "@/components/form-ui";

const STATUSES = ["วางแผน", "กำลังสมัคร", "กำลังดำเนินการ", "เสร็จสิ้น"];

export function ExchangeForm({
  record, isStaff, onSaved, onCancel,
}: {
  record?: RawExchange;
  isStaff: boolean;
  onSaved: (record: RawExchange, created: boolean) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: record?.name ?? "",
    type: record?.type ?? "outbound",
    from_program: record?.fromProgram ?? "",
    to_organization: record?.toOrganization ?? "",
    start_date: record?.startDate ?? "",
    end_date: record?.endDate ?? "",
    program: record?.program ?? "",
    status: record?.status ?? "วางแผน",
    user_id: record?.userId != null ? String(record.userId) : "",
    is_published: record?.isPublished ?? false,
  });
  const action = useAction();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      type: form.type,
      from_program: orNull(form.from_program),
      to_organization: orNull(form.to_organization),
      start_date: orNull(form.start_date),
      end_date: orNull(form.end_date),
      program: orNull(form.program),
      status: orNull(form.status),
    };
    // The student account can be linked when the record is created.
    if (!record) body.user_id = form.user_id ? Number(form.user_id) : null;
    if (isStaff) body.is_published = form.is_published;
    let saved: RawExchange | null = null;
    const ok = await action.run(async () => {
      saved = record
        ? await apiPatch<RawExchange>(`/exchange/${record.id}`, body)
        : await apiPost<RawExchange>("/exchange/", body);
    });
    if (ok && saved) onSaved(saved, !record);
  }

  return (
    <form onSubmit={submit}>
      <FormError error={action.error} />
      <Field label="ชื่อ-นามสกุลนักศึกษา *">
        <input className={inputCls} value={form.name} onChange={set("name")} required maxLength={255} />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="ประเภท">
          <select className={inputCls} value={form.type} onChange={set("type")}>
            <option value="outbound">ไปแลกเปลี่ยน (Outbound)</option>
            <option value="inbound">มารับการแลกเปลี่ยน (Inbound)</option>
          </select>
        </Field>
        <Field label="สถานะ">
          <select className={inputCls} value={form.status} onChange={set("status")}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="จาก (หลักสูตร/สถาบันต้นทาง)">
          <input className={inputCls} value={form.from_program} onChange={set("from_program")} />
        </Field>
        <Field label="ไป (สถาบันปลายทาง)">
          <input className={inputCls} value={form.to_organization} onChange={set("to_organization")} />
        </Field>
        <Field label="วันที่เริ่ม">
          <input className={inputCls} type="date" value={form.start_date} onChange={set("start_date")} />
        </Field>
        <Field label="วันที่สิ้นสุด">
          <input className={inputCls} type="date" value={form.end_date} min={form.start_date || undefined} onChange={set("end_date")} />
        </Field>
        <Field label="โครงการ">
          <input className={inputCls} value={form.program} onChange={set("program")} placeholder="Student Exchange" />
        </Field>
        {!record && (
          <Field label="รหัสบัญชีนักศึกษา (ถ้ามี)" hint="ผูกกับบัญชีเพื่อให้นักศึกษาเห็นข้อมูลของตน">
            <input className={inputCls} type="number" min={1} value={form.user_id} onChange={set("user_id")} />
          </Field>
        )}
      </div>
      {isStaff ? (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
          เผยแพร่ในหน้าสาธารณะ
        </label>
      ) : (
        <p className="mb-3 text-xs text-faint">ข้อมูลที่คุณบันทึกจะยังไม่เผยแพร่ จนกว่าเจ้าหน้าที่จะอนุญาต</p>
      )}
      <div className="flex justify-end gap-2">
        <button className="btn btn-outline" type="button" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" type="submit" disabled={action.busy}>
          {action.busy ? "กำลังบันทึก…" : record ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
        </button>
      </div>
    </form>
  );
}
