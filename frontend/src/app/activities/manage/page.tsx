"use client";

// V3-4 activity management: add, edit, publish and (staff/admin) delete.
// Coordinators manage only activities they created; the backend re-checks every action.

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronRight, Pencil, Trash2 } from "lucide-react";
import {
  apiDelete, apiGetList, apiPatch, apiPost, formatThaiDate, loadAgreementOptions, loadPublicPartners, useApiResource,
  type AgreementOption, type PartnerView,
} from "@/lib/api";
import { activityTypeLabels, scopeLevelLabels, type ScopeLevel } from "@/lib/labels";
import { canManage, useRole } from "@/lib/role-context";
import { AccessState, EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Dialog, Field, FormError, Notice, inputCls, orNull, useAction } from "@/components/form-ui";
import { useDocumentTitle } from "@/lib/list-tools";

/** GET /activities/manage row (internal view). */
interface ManagedActivity {
  id: number;
  name: string;
  date: string | null;
  endDate: string | null;
  description: string | null;
  activity_type: string | null;
  location: string | null;
  time: string | null;
  participants: number | null;
  status: string | null;
  scopeLevel: ScopeLevel | null;
  partner: { id: number; name: string } | null;
  partnerId: number | null;
  mouDocId: number | null;
  isPublished: boolean;
  ownerUserId: number | null;
}

const ACTIVITY_STATUSES = ["วางแผน", "กำลังดำเนินการ", "เสร็จสิ้น"];

export default function ManageActivitiesPage() {
  useDocumentTitle("จัดการกิจกรรม");
  const { role, user, status: session } = useRole();
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<ManagedActivity | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();

  const allowed = session === "authenticated" && canManage(role);
  const isStaff = role === "staff" || role === "admin";
  const activities = useApiResource<ManagedActivity[]>(
    () => (allowed ? apiGetList<ManagedActivity>("/activities/manage") : new Promise<never>(() => {})),
    [allowed, reload]
  );
  const partners = useApiResource<PartnerView[]>(
    () => (allowed ? loadPublicPartners() : new Promise<never>(() => {})),
    [allowed]
  );
  const agreements = useApiResource<AgreementOption[]>(
    () => (allowed ? loadAgreementOptions(role) : new Promise<never>(() => {})),
    [allowed, role]
  );
  // Keep the last list on screen while reloading after a change.
  const [rows, setRows] = useState<ManagedActivity[] | null>(null);
  useEffect(() => {
    if (activities.status === "success") setRows(activities.data);
  }, [activities.status, activities.data]);

  // /activities/manage?edit=<id> opens that activity (from the detail page's "แก้ไข");
  // ?new=1 opens the add form (from the staff dashboard's "เพิ่มกิจกรรม").
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setEditing("new");
      window.history.replaceState(null, "", "/activities/manage");
      return;
    }
    const id = Number(params.get("edit"));
    if (id && rows) {
      const row = rows.find((a) => a.id === id);
      if (row) setEditing(row);
      window.history.replaceState(null, "", "/activities/manage");
    }
  }, [rows]);

  const refresh = (message: string) => { setNotice(message); setReload((n) => n + 1); };

  if (session === "loading") return <div className="p-6"><LoadingState /></div>;
  if (session !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (!canManage(role)) return <div className="p-6"><AccessState status={403} /></div>;

  const canEdit = (a: ManagedActivity) => isStaff || a.ownerUserId === user?.id;

  return (
    <div className="mx-auto max-w-screen-xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-faint">
            <Link href="/activities" className="text-faint hover:text-crimson">กิจกรรม</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-crimson">จัดการกิจกรรม</span>
          </nav>
          <h1 className="font-display text-2xl font-bold text-ink">จัดการกิจกรรม</h1>
          <p className="mt-0.5 text-sm text-faint">
            {isStaff ? "กิจกรรมทั้งหมด รวมรายการที่ยังไม่เผยแพร่" : "เพิ่มและแก้ไขกิจกรรมของตัวเองได้ เจ้าหน้าที่เป็นผู้เผยแพร่และลบ"}
          </p>
        </div>
        <button className="btn btn-primary gap-2" type="button" onClick={() => { setNotice(null); setEditing("new"); }}>
          <CalendarPlus className="h-4 w-4" />
          เพิ่มกิจกรรม
        </button>
      </div>

      <Notice text={notice} />
      <FormError error={action.error} />

      {rows === null && activities.status === "loading" && <LoadingState />}
      {activities.status === "error" && <ErrorState error={activities.error} onRetry={activities.retry} />}
      {rows !== null && rows.length === 0 && <EmptyState title="ยังไม่มีกิจกรรม" message="กด “เพิ่มกิจกรรม” เพื่อเริ่ม" />}
      {rows !== null && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-soft text-left text-xs font-semibold text-faint">
                  <th className="px-5 py-3">กิจกรรม</th>
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">หน่วยงาน</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">เผยแพร่</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">
                      {a.name}
                      {a.ownerUserId === user?.id && <span className="badge badge-indigo ml-2">ของคุณ</span>}
                    </td>
                    <td className="px-4 py-3 text-faint">{formatThaiDate(a.date)}</td>
                    <td className="px-4 py-3 text-faint">{a.partner?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-faint">{a.status ?? "—"}</td>
                    <td className="px-4 py-3">
                      {a.isPublished ? <span className="badge badge-green">เผยแพร่แล้ว</span> : <span className="badge badge-gray">ยังไม่เผยแพร่</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {canEdit(a) && (
                        <button className="btn btn-outline gap-1.5 px-3 py-1.5 text-xs" type="button"
                          onClick={() => { setNotice(null); setEditing(a); }}>
                          <Pencil className="h-3.5 w-3.5" />
                          แก้ไข
                        </button>
                      )}
                      {isStaff && (
                        <button className="btn ml-1 gap-1.5 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50" type="button"
                          disabled={action.busy}
                          onClick={async () => {
                            if (!confirm(`ลบกิจกรรม “${a.name}” ใช่ไหม\nกิจกรรมนี้จะไม่แสดงอีก แต่ยังดูได้ในประวัติการแก้ไข`)) return;
                            if (await action.run(() => apiDelete(`/activities/${a.id}`))) refresh(`ลบ “${a.name}” แล้ว`);
                          }}>
                          <Trash2 className="h-3.5 w-3.5" />
                          ลบ
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={editing !== null} title={editing === "new" ? "เพิ่มกิจกรรม" : "แก้ไขกิจกรรม"} onClose={() => setEditing(null)} wide>
        {editing !== null && (
          <ActivityForm
            key={editing === "new" ? "new" : editing.id}
            activity={editing === "new" ? undefined : editing}
            partners={partners.status === "success" ? partners.data : []}
            agreements={agreements.status === "success" ? agreements.data : []}
            isStaff={isStaff}
            onCancel={() => setEditing(null)}
            onSaved={(saved, created) => { setEditing(null); refresh(created ? `เพิ่ม “${saved.name}” แล้ว` : `บันทึก “${saved.name}” แล้ว`); }}
          />
        )}
      </Dialog>
    </div>
  );
}

function ActivityForm({
  activity, partners, agreements, isStaff, onSaved, onCancel,
}: {
  activity?: ManagedActivity;
  partners: PartnerView[];
  agreements: AgreementOption[];
  isStaff: boolean;
  onSaved: (activity: ManagedActivity, created: boolean) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: activity?.name ?? "",
    activity_type: activity?.activity_type ?? "",
    date: activity?.date ?? "",
    end_date: activity?.endDate ?? "",
    time: activity?.time ?? "",
    location: activity?.location ?? "",
    participants: activity?.participants != null ? String(activity.participants) : "",
    status: activity?.status ?? "วางแผน",
    partner_id: activity?.partnerId ? String(activity.partnerId) : "",
    mou_document_id: activity?.mouDocId ? String(activity.mouDocId) : "",
    scope_level: activity?.scopeLevel ?? "",
    description: activity?.description ?? "",
    is_published: activity?.isPublished ?? false,
  });
  const action = useAction();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  // Agreements of the chosen partner (all when none is chosen); the current link always stays listed.
  const agreementChoices = agreements.filter((d) =>
    !form.partner_id || d.partnerId === Number(form.partner_id) || String(d.id) === form.mou_document_id);
  const pickAgreement = (e: { target: { value: string } }) => {
    const chosen = agreements.find((d) => String(d.id) === e.target.value);
    setForm({
      ...form,
      mou_document_id: e.target.value,
      // Choosing an agreement also fills in its partner when none is set yet.
      partner_id: form.partner_id || (chosen?.partnerId ? String(chosen.partnerId) : ""),
    });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      activity_type: orNull(form.activity_type),
      date: orNull(form.date),
      end_date: orNull(form.end_date),
      time: orNull(form.time),
      location: orNull(form.location),
      participants: form.participants === "" ? null : Number(form.participants),
      status: orNull(form.status),
      partner_id: form.partner_id ? Number(form.partner_id) : null,
      mou_document_id: form.mou_document_id ? Number(form.mou_document_id) : null,
      scope_level: orNull(form.scope_level),
      description: orNull(form.description),
    };
    // Only staff/admin may change publication; the backend refuses it from coordinators.
    if (isStaff) body.is_published = form.is_published;
    let saved: ManagedActivity | null = null;
    const ok = await action.run(async () => {
      saved = activity
        ? await apiPatch<ManagedActivity>(`/activities/${activity.id}`, body)
        : await apiPost<ManagedActivity>("/activities/", body);
    });
    if (ok && saved) onSaved(saved, !activity);
  }

  return (
    <form onSubmit={submit}>
      <FormError error={action.error} />
      <Field label="ชื่อกิจกรรม *">
        <input className={inputCls} value={form.name} onChange={set("name")} required maxLength={255} />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="ประเภทกิจกรรม">
          <select className={inputCls} value={form.activity_type} onChange={set("activity_type")}>
            <option value="">— ไม่ระบุ —</option>
            {Object.entries(activityTypeLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </Field>
        <Field label="สถานะ">
          <select className={inputCls} value={form.status} onChange={set("status")}>
            {ACTIVITY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="วันที่เริ่ม">
          <input className={inputCls} type="date" value={form.date} onChange={set("date")} />
        </Field>
        <Field label="วันที่สิ้นสุด">
          <input className={inputCls} type="date" value={form.end_date} min={form.date || undefined} onChange={set("end_date")} />
        </Field>
        <Field label="เวลา">
          <input className={inputCls} value={form.time} onChange={set("time")} placeholder="09:00 - 16:00" />
        </Field>
        <Field label="สถานที่">
          <input className={inputCls} value={form.location} onChange={set("location")} />
        </Field>
        <Field label="จำนวนผู้เข้าร่วม">
          <input className={inputCls} type="number" min={0} value={form.participants} onChange={set("participants")} />
        </Field>
        <Field label="หน่วยงานคู่ความร่วมมือ">
          <select className={inputCls} value={form.partner_id} onChange={set("partner_id")}>
            <option value="">— ไม่ระบุ —</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="ข้อตกลงที่เกี่ยวข้อง">
          <select className={inputCls} value={form.mou_document_id} onChange={pickAgreement}>
            <option value="">— ไม่ระบุ —</option>
            {agreementChoices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            {form.mou_document_id && !agreements.some((d) => String(d.id) === form.mou_document_id) && (
              <option value={form.mou_document_id}>ข้อตกลง #{form.mou_document_id}</option>
            )}
          </select>
        </Field>
        <Field label="ระดับความร่วมมือ">
          <select className={inputCls} value={form.scope_level} onChange={set("scope_level")}>
            <option value="">— ยังไม่ระบุ —</option>
            {Object.entries(scopeLevelLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </Field>
      </div>
      <Field label="รายละเอียด">
        <textarea className={inputCls} rows={3} value={form.description} onChange={set("description")} />
      </Field>
      {isStaff ? (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
          เผยแพร่ในหน้าสาธารณะ
        </label>
      ) : (
        <p className="mb-3 text-xs text-faint">กิจกรรมใหม่จะแสดงในหน้าสาธารณะเมื่อเจ้าหน้าที่เผยแพร่</p>
      )}
      <div className="flex justify-end gap-2">
        <button className="btn btn-outline" type="button" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" type="submit" disabled={action.busy}>
          {action.busy ? "กำลังบันทึก…" : activity ? "บันทึก" : "เพิ่ม"}
        </button>
      </div>
    </form>
  );
}
