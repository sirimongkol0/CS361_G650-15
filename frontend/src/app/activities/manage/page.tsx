"use client";

// V3-4 activity management: add, edit, publish and (staff/admin) delete.
// Coordinators manage only activities they created; the backend re-checks every action.

import { useEffect, useState, type FormEvent } from "react";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import {
  apiDelete, apiGetList, apiPatch, apiPost, formatThaiDate, loadAgreementOptions, loadManagePartners, useApiResource,
  type AgreementOption, type PartnerView,
} from "@/lib/api";
import { activityDateKindLabels, activityTypeLabels, datePrecisionLabels, partnerTypeLabels, scopeLevelLabels, type ScopeLevel } from "@/lib/labels";
import { canManage, useRole } from "@/lib/role-context";
import { AccessState, EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Dialog, Field, FormError, Notice, inputCls, orNull, useAction, DateInput } from "@/components/form-ui";
import { FormActions, FormSection } from "@/components/form-layout";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useDocumentTitle } from "@/lib/list-tools";
import { useConfirm } from "@/components/confirm-dialog";
import { Breadcrumb } from "@/components/breadcrumb";

/** GET /activities/manage row (internal view). */
interface ManagedActivity {
  id: number;
  name: string;
  date: string | null;
  endDate: string | null;
  description: string | null;
  activity_type: string | null;
  dateKind: string | null;
  datePrecision: string | null;
  location: string | null;
  time: string | null;
  participants: number | null;
  status: string | null;
  isOpen: boolean | null;
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
  const confirm = useConfirm();

  const allowed = session === "authenticated" && canManage(role);
  const isStaff = role === "staff" || role === "admin";
  const activities = useApiResource<ManagedActivity[]>(
    () => (allowed ? apiGetList<ManagedActivity>("/activities/manage") : new Promise<never>(() => {})),
    [allowed, reload]
  );
  const partners = useApiResource<PartnerView[]>(
    () => (allowed ? loadManagePartners() : new Promise<never>(() => {})),
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
    <div className="mx-auto max-w-(--breakpoint-xl) p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumb items={[{ label: "กิจกรรม", href: "/activities" }, { label: "จัดการกิจกรรม" }]} />
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
                            if (!(await confirm({
                              title: `ลบกิจกรรม “${a.name}” ใช่ไหม`,
                              description: "กิจกรรมนี้จะไม่แสดงอีก แต่ยังดูได้ในประวัติการแก้ไข",
                              action: "ลบกิจกรรม",
                              destructive: true,
                            }))) return;
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
    date_kind: activity?.dateKind ?? "",
    date_precision: activity?.datePrecision ?? "",
    end_date: activity?.endDate ?? "",
    time: activity?.time ?? "",
    location: activity?.location ?? "",
    participants: activity?.participants != null ? String(activity.participants) : "",
    status: activity?.status ?? "วางแผน",
    is_open: activity?.isOpen == null ? "" : activity.isOpen ? "true" : "false",
    partner_id: activity?.partnerId ? String(activity.partnerId) : "",
    mou_document_id: activity?.mouDocId ? String(activity.mouDocId) : "",
    scope_level: activity?.scopeLevel ?? "",
    description: activity?.description ?? "",
    is_published: activity?.isPublished ?? false,
  });
  const action = useAction();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  // The backend forbids date_kind/date_precision when there is no date.
  const setDate = (e: { target: { value: string } }) => setForm({
    ...form,
    date: e.target.value,
    ...(e.target.value ? {} : { date_kind: "", date_precision: "" }),
  });
  // Agreements of the chosen partner (all when none is chosen); the current link always stays listed.
  const agreementChoices = agreements.filter((d) =>
    !form.partner_id || d.partnerId === Number(form.partner_id) || String(d.id) === form.mou_document_id);
  const partnerOptions: ComboboxOption[] = partners.map((partner) => ({
    value: String(partner.id),
    label: partner.name,
    description: [partner.country, partner.type ? partnerTypeLabels[partner.type] : null].filter(Boolean).join(' · ') || undefined,
    group: partner.type ? partnerTypeLabels[partner.type] ?? 'อื่น ๆ' : 'อื่น ๆ',
  }));
  const agreementOptions: ComboboxOption[] = agreementChoices.map((agreement) => ({
    value: String(agreement.id),
    label: agreement.name,
    description: partners.find((partner) => partner.id === agreement.partnerId)?.name,
  }));
  if (form.mou_document_id && !agreementOptions.some((option) => option.value === form.mou_document_id)) {
    agreementOptions.push({
      value: form.mou_document_id,
      label: `ข้อตกลง #${form.mou_document_id}`,
    });
  }
  const pickPartner = (next: string) => {
    const current = agreements.find((agreement) => String(agreement.id) === form.mou_document_id);
    const keepAgreement = !next || !current || current.partnerId == null || current.partnerId === Number(next);
    setForm({
      ...form,
      partner_id: next,
      mou_document_id: keepAgreement ? form.mou_document_id : '',
    });
  };
  const pickAgreement = (next: string) => {
    const chosen = agreements.find((d) => String(d.id) === next);
    setForm({
      ...form,
      mou_document_id: next,
      // Choosing an agreement also fills in its partner when none is set yet.
      partner_id: form.partner_id || (chosen?.partnerId ? String(chosen.partnerId) : ""),
    });
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      activity_type: orNull(form.activity_type),
      date: orNull(form.date),
      date_kind: form.date ? orNull(form.date_kind) : null,
      date_precision: form.date ? orNull(form.date_precision) : null,
      end_date: orNull(form.end_date),
      time: orNull(form.time),
      location: orNull(form.location),
      participants: form.participants === "" ? null : Number(form.participants),
      status: orNull(form.status),
      is_open: form.is_open === "" ? null : form.is_open === "true",
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

      <FormSection title="ข้อมูลกิจกรรม" description="ข้อมูลหลักที่ใช้แสดงในหน้าสาธารณะ">
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
          <Field label="เปิดรับสมัคร" hint="ใช้กับกิจกรรมที่ยังเปิดให้ลงทะเบียน">
            <select className={inputCls} value={form.is_open} onChange={set("is_open")}>
              <option value="">— ไม่ระบุ —</option>
              <option value="true">เปิด</option>
              <option value="false">ปิด</option>
            </select>
          </Field>
          <Field label="วันที่เริ่ม">
            <DateInput className={inputCls} value={form.date} onChange={setDate} />
          </Field>
          <Field label="วันที่สิ้นสุด">
            <DateInput className={inputCls} value={form.end_date} min={form.date || undefined} onChange={set("end_date")} />
          </Field>
          <Field label="ลักษณะวันที่" hint="ระบุว่าวันที่นี้คือวันจัดกิจกรรม ประกาศ หรือช่วงรับสมัคร">
            <select className={inputCls} value={form.date_kind} onChange={set("date_kind")} disabled={!form.date}>
              <option value="">— ไม่ระบุ —</option>
              {Object.entries(activityDateKindLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </Field>
          <Field label="ความละเอียดวันที่" hint="ใช้เมื่อไม่ทราบวันจริง เช่น ระบุเฉพาะเดือนหรือปี">
            <select className={inputCls} value={form.date_precision} onChange={set("date_precision")} disabled={!form.date}>
              <option value="">— ไม่ระบุ —</option>
              {Object.entries(datePrecisionLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
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
        </div>
      </FormSection>

      <FormSection title="ความสัมพันธ์" description="เชื่อมกิจกรรมกับหน่วยงานและข้อตกลงที่เกี่ยวข้อง">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="หน่วยงานความร่วมมือ">
            <Combobox
              options={partnerOptions}
              value={form.partner_id}
              onChange={pickPartner}
              placeholder="เลือกหน่วยงาน"
              emptyMessage="ไม่พบหน่วยงาน"
              aria-label="หน่วยงานความร่วมมือ"
            />
          </Field>
          <Field label="ข้อตกลงที่เกี่ยวข้อง">
            <Combobox
              options={agreementOptions}
              value={form.mou_document_id}
              onChange={pickAgreement}
              placeholder="เลือกข้อตกลง"
              emptyMessage="ไม่พบข้อตกลง"
              aria-label="ข้อตกลงที่เกี่ยวข้อง"
            />
          </Field>
          <Field label="ขอบเขตความร่วมมือ">
            <select className={inputCls} value={form.scope_level} onChange={set("scope_level")}>
              <option value="">— ยังไม่ระบุ —</option>
              {Object.entries(scopeLevelLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </Field>
        </div>
        {form.partner_id && agreementOptions.length === 0 && (
          <p className="text-xs text-faint">หน่วยงานนี้ยังไม่มีข้อตกลงที่เชื่อมได้</p>
        )}
      </FormSection>

      <FormSection title="รายละเอียดและการเผยแพร่">
        <Field label="รายละเอียด">
          <textarea className={inputCls} rows={3} value={form.description} onChange={set("description")} />
        </Field>
        {isStaff ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
            เผยแพร่ในหน้าสาธารณะ
          </label>
        ) : (
          <p className="text-xs text-faint">กิจกรรมใหม่จะแสดงในหน้าสาธารณะเมื่อเจ้าหน้าที่เผยแพร่</p>
        )}
      </FormSection>

      <FormActions
        onCancel={onCancel}
        onSave={() => { void submit(); }}
        saveLabel={activity ? "บันทึก" : "เพิ่ม"}
        busy={action.busy}
      />
    </form>
  );
}
