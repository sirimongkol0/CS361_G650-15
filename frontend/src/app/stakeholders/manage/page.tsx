"use client";

// V3-2 stakeholder management: organisations, people and coordinators.
// GET /partners/ already answers per role (coordinator: published + own drafts,
// staff/admin: all); writes are re-checked by the backend.

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Pencil, Trash2, UserPlus } from "lucide-react";
import { apiDelete, apiGetList, apiPost, apiPut, useApiResource } from "@/lib/api";
import { label, partnerTypeLabels, scopeLevelLabels, type ScopeLevel } from "@/lib/labels";
import { canManage, useRole } from "@/lib/role-context";
import { AccessState, EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Dialog, Field, FormError, Notice, inputCls, orNull, useAction } from "@/components/form-ui";
import { useDocumentTitle } from "@/lib/list-tools";

/** GET /partners/ row as seen by a signed-in manager. */
interface ManagedPartner {
  id: number;
  name: string;
  description: string | null;
  type: string | null;
  country: string | null;
  countryCode: string | null;
  websiteUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactIsPublic: boolean;
  scopeLevel: ScopeLevel | null;
  organizationId: number | null;
  isPublished: boolean;
  ownerUserId: number | null;
}

const TYPE_OPTIONS: Record<string, string> = { ...partnerTypeLabels, coordinator: "ผู้ประสานงาน (บุคคล)" };

export default function ManageStakeholdersPage() {
  useDocumentTitle("จัดการหน่วยงาน");
  const { role, user, status: session } = useRole();
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<ManagedPartner | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();

  const allowed = session === "authenticated" && canManage(role);
  const isStaff = role === "staff" || role === "admin";
  const partners = useApiResource<ManagedPartner[]>(
    () => (allowed ? apiGetList<ManagedPartner>("/partners/") : new Promise<never>(() => {})),
    [allowed, reload]
  );
  const [rows, setRows] = useState<ManagedPartner[] | null>(null);
  useEffect(() => {
    if (partners.status === "success") setRows(partners.data);
  }, [partners.status, partners.data]);

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("edit"));
    if (id && rows) {
      const row = rows.find((p) => p.id === id);
      if (row) setEditing(row);
      window.history.replaceState(null, "", "/stakeholders/manage");
    }
  }, [rows]);

  const refresh = (message: string) => { setNotice(message); setReload((n) => n + 1); };

  if (session === "loading") return <div className="p-6"><LoadingState /></div>;
  if (session !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (!canManage(role)) return <div className="p-6"><AccessState status={403} /></div>;

  const canEdit = (p: ManagedPartner) => isStaff || p.ownerUserId === user?.id;
  const organisations = (rows ?? []).filter((p) => p.type !== "coordinator");
  const orgName = (id: number | null) => rows?.find((p) => p.id === id)?.name;

  return (
    <div className="mx-auto max-w-screen-xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-faint">
            <Link href="/stakeholders" className="text-faint hover:text-crimson">หน่วยงานคู่ความร่วมมือ</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-crimson">จัดการหน่วยงาน</span>
          </nav>
          <h1 className="font-display text-2xl font-bold text-ink">จัดการหน่วยงานและผู้ประสานงาน</h1>
          <p className="mt-0.5 text-sm text-faint">
            {isStaff ? "ทุกรายการ รวมฉบับร่าง" : "รายการที่เผยแพร่และฉบับร่างของคุณ แก้ไขได้เฉพาะรายการของคุณ"}
          </p>
        </div>
        <button className="btn btn-primary gap-2" type="button" onClick={() => { setNotice(null); setEditing("new"); }}>
          <UserPlus className="h-4 w-4" />
          เพิ่มหน่วยงาน / บุคคล
        </button>
      </div>

      <Notice text={notice} />
      <FormError error={action.error} />

      {rows === null && partners.status === "loading" && <LoadingState />}
      {partners.status === "error" && <ErrorState error={partners.error} onRetry={partners.retry} />}
      {rows !== null && rows.length === 0 && <EmptyState title="ยังไม่มีหน่วยงาน" message="กด “เพิ่มหน่วยงาน / บุคคล” เพื่อเริ่ม" />}
      {rows !== null && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-soft text-left text-xs font-semibold text-faint">
                  <th className="px-5 py-3">ชื่อ</th>
                  <th className="px-4 py-3">ประเภท</th>
                  <th className="px-4 py-3">สังกัด / ประเทศ</th>
                  <th className="px-4 py-3">เผยแพร่</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">
                      {p.name}
                      {p.ownerUserId === user?.id && <span className="badge badge-indigo ml-2">ของคุณ</span>}
                    </td>
                    <td className="px-4 py-3 text-faint">{label(TYPE_OPTIONS, p.type)}</td>
                    <td className="px-4 py-3 text-faint">{orgName(p.organizationId) ?? p.country ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.isPublished ? <span className="badge badge-green">เผยแพร่</span> : <span className="badge badge-gray">ฉบับร่าง</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {canEdit(p) && (
                        <button className="btn btn-outline gap-1.5 px-3 py-1.5 text-xs" type="button"
                          onClick={() => { setNotice(null); setEditing(p); }}>
                          <Pencil className="h-3.5 w-3.5" />
                          แก้ไข
                        </button>
                      )}
                      {isStaff && (
                        <button className="btn ml-1 gap-1.5 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50" type="button"
                          disabled={action.busy}
                          onClick={async () => {
                            if (!confirm(`ลบ “${p.name}”? รายการจะถูกซ่อนและเก็บประวัติไว้ใน audit log`)) return;
                            if (await action.run(() => apiDelete(`/partners/${p.id}`))) refresh(`ลบ “${p.name}” แล้ว`);
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

      <Dialog open={editing !== null} title={editing === "new" ? "เพิ่มหน่วยงาน / บุคคล" : "แก้ไขข้อมูล"} onClose={() => setEditing(null)} wide>
        {editing !== null && (
          <PartnerForm
            key={editing === "new" ? "new" : editing.id}
            partner={editing === "new" ? undefined : editing}
            organisations={organisations.filter((o) => editing === "new" || o.id !== editing.id)}
            isStaff={isStaff}
            onCancel={() => setEditing(null)}
            onSaved={(saved, created) => { setEditing(null); refresh(created ? `เพิ่ม “${saved.name}” แล้ว` : `บันทึก “${saved.name}” แล้ว`); }}
          />
        )}
      </Dialog>
    </div>
  );
}

function PartnerForm({
  partner, organisations, isStaff, onSaved, onCancel,
}: {
  partner?: ManagedPartner;
  organisations: ManagedPartner[];
  isStaff: boolean;
  onSaved: (partner: ManagedPartner, created: boolean) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: partner?.name ?? "",
    type: partner?.type ?? "university",
    organization_id: partner?.organizationId ? String(partner.organizationId) : "",
    country: partner?.country ?? "",
    country_code: partner?.countryCode ?? "",
    website_url: partner?.websiteUrl ?? "",
    scope_level: partner?.scopeLevel ?? "",
    description: partner?.description ?? "",
    contact_name: partner?.contactName ?? "",
    contact_email: partner?.contactEmail ?? "",
    contact_is_public: partner?.contactIsPublic ?? false,
    is_published: partner?.isPublished ?? false,
    source_url: "",
  });
  const action = useAction();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const isPerson = form.type === "coordinator" || form.type === "alumni" || form.type === "expert";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      type: form.type,
      organization_id: form.organization_id ? Number(form.organization_id) : null,
      country: orNull(form.country),
      country_code: orNull(form.country_code.toUpperCase()),
      website_url: orNull(form.website_url),
      scope_level: orNull(form.scope_level),
      description: orNull(form.description),
      contact_name: orNull(form.contact_name),
      contact_email: orNull(form.contact_email),
      contact_is_public: form.contact_is_public,
    };
    if (isStaff) {
      body.is_published = form.is_published;
      if (form.source_url.trim()) body.source_url = form.source_url.trim();
    }
    let saved: ManagedPartner | null = null;
    const ok = await action.run(async () => {
      saved = partner
        ? await apiPut<ManagedPartner>(`/partners/${partner.id}`, body)
        : await apiPost<ManagedPartner>("/partners/", body);
    });
    if (ok && saved) onSaved(saved, !partner);
  }

  return (
    <form onSubmit={submit}>
      <FormError error={action.error} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="ชื่อ *">
          <input className={inputCls} value={form.name} onChange={set("name")} required maxLength={255} />
        </Field>
        <Field label="ประเภท">
          <select className={inputCls} value={form.type} onChange={set("type")}>
            {Object.entries(TYPE_OPTIONS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </Field>
        {isPerson && (
          <Field label="สังกัดหน่วยงาน" hint="ผูกผู้ประสานงานกับหน่วยงานคู่ความร่วมมือ">
            <select className={inputCls} value={form.organization_id} onChange={set("organization_id")}>
              <option value="">— ไม่ระบุ —</option>
              {organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="ประเทศ">
          <input className={inputCls} value={form.country} onChange={set("country")} placeholder="Thailand" />
        </Field>
        <Field label="รหัสประเทศ" hint="2 ตัวอักษร เช่น TH">
          <input className={inputCls} value={form.country_code} onChange={set("country_code")} maxLength={2} pattern="[A-Za-z]{2}" />
        </Field>
        <Field label="เว็บไซต์">
          <input className={inputCls} type="url" value={form.website_url} onChange={set("website_url")} placeholder="https://" />
        </Field>
        <Field label="ระดับความร่วมมือ">
          <select className={inputCls} value={form.scope_level} onChange={set("scope_level")}>
            <option value="">— ยังไม่ระบุ —</option>
            {Object.entries(scopeLevelLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </Field>
        <Field label="ชื่อผู้ติดต่อ">
          <input className={inputCls} value={form.contact_name} onChange={set("contact_name")} />
        </Field>
        <Field label="อีเมลผู้ติดต่อ">
          <input className={inputCls} type="email" value={form.contact_email} onChange={set("contact_email")} />
        </Field>
      </div>
      <Field label="รายละเอียด">
        <textarea className={inputCls} rows={3} value={form.description} onChange={set("description")} />
      </Field>
      <label className="mb-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.contact_is_public} onChange={(e) => setForm({ ...form, contact_is_public: e.target.checked })} />
        แสดงข้อมูลผู้ติดต่อในหน้าสาธารณะ (ข้อมูลส่วนบุคคล ต้องได้รับความยินยอม)
      </label>
      {isStaff ? (
        <>
          <Field label="ลิงก์แหล่งที่มาที่ตรวจแล้ว (https://)" hint="เจ้าหน้าที่ยืนยันแหล่งที่มา จำเป็นก่อนแสดงในหน้าสาธารณะ">
            <input className={inputCls} type="url" pattern="https://.*" value={form.source_url}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://" />
          </Field>
          <label className="mb-1 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
            เผยแพร่ในหน้าสาธารณะ
          </label>
          <p className="mb-3 text-xs text-faint">
            หน้าสาธารณะแสดงเมื่อมีครบ: ประเภท, รายละเอียด, เว็บไซต์, รหัสประเทศ และแหล่งที่มาที่ตรวจแล้ว
          </p>
        </>
      ) : (
        <p className="mb-3 text-xs text-faint">รายการที่คุณเพิ่มจะเป็นฉบับร่าง จนกว่าเจ้าหน้าที่จะเผยแพร่</p>
      )}
      <div className="flex justify-end gap-2">
        <button className="btn btn-outline" type="button" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" type="submit" disabled={action.busy}>
          {action.busy ? "กำลังบันทึก…" : partner ? "บันทึกการแก้ไข" : "เพิ่ม"}
        </button>
      </div>
    </form>
  );
}
