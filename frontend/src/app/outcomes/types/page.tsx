"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight, Save } from "lucide-react";
import { apiGetFresh, apiPatch, apiPost, useApiResource, type OutcomeType } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { AccessState, EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Field, FormError, Notice, inputCls, useAction } from "@/components/form-ui";
import { useDocumentTitle } from "@/lib/list-tools";

export default function OutcomeTypesPage() {
  useDocumentTitle("ตั้งค่าประเภทผลลัพธ์");
  const { role, status } = useRole();
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [edits, setEdits] = useState<Record<number, Partial<OutcomeType>>>({});
  const action = useAction();
  const allowed = status === "authenticated" && role === "admin";
  const resource = useApiResource<OutcomeType[]>(
    () => allowed ? apiGetFresh<OutcomeType[]>("/outcomes/lookups") : new Promise<never>(() => {}),
    [allowed, reload]
  );

  if (status === "loading") return <div className="p-6"><LoadingState /></div>;
  if (status !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (role !== "admin") return <div className="p-6"><AccessState status={403} /></div>;
  if (resource.status === "loading") return <div className="p-6"><LoadingState /></div>;
  if (resource.status === "error") return <div className="p-6"><ErrorState error={resource.error} onRetry={resource.retry} /></div>;

  const changed = (message: string) => { setNotice(message); setReload((n) => n + 1); };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (await action.run(() => apiPost("/outcomes/lookups", {
      code: code.trim(), name_th: name.trim(), unit: unit.trim() || null, sort_order: Number(sortOrder),
    }))) {
      setCode(""); setName(""); setUnit(""); setSortOrder("0");
      changed("เพิ่มประเภทผลลัพธ์แล้ว");
    }
  };

  const save = async (row: OutcomeType) => {
    const changes = { ...edits[row.id] };
    if (typeof changes.unit === "string") changes.unit = changes.unit.trim() || null;
    if (await action.run(() => apiPatch(`/outcomes/lookups/${row.id}`, changes))) {
      setEdits((current) => { const next = { ...current }; delete next[row.id]; return next; });
      changed("บันทึกประเภทผลลัพธ์แล้ว");
    }
  };

  const edit = (row: OutcomeType, field: keyof OutcomeType, value: string | number | boolean) => {
    setEdits((current) => ({ ...current, [row.id]: { ...current[row.id], [field]: value } }));
  };

  const rows = resource.data;
  return <div className="p-6 max-w-screen-xl mx-auto space-y-5">
    <div>
      <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint"><Link href="/" className="hover:text-crimson">หน้าหลัก</Link><ChevronRight className="w-3 h-3" /><span className="text-crimson">ตั้งค่าประเภทผลลัพธ์</span></nav>
      <h1 className="text-2xl font-bold text-ink font-display">จัดการประเภทผลลัพธ์</h1>
      <p className="text-sm text-faint mt-1">ประเภทที่เพิ่มจะใช้ในฟอร์มผลลัพธ์ได้ทันที ปิดใช้งานได้โดยผลลัพธ์เดิมยังคงอยู่</p>
    </div>
    <Notice text={notice} />
    <section className="rounded-lg bg-white shadow-card p-5 space-y-4">
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_100px_auto] items-end">
        <Field label="รหัส (code)"><input className={inputCls} required pattern="[a-z][a-z0-9_]*" maxLength={80} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="ชื่อที่แสดง"><input className={inputCls} required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="หน่วย"><input className={inputCls} maxLength={50} placeholder="เช่น คน, บาท" value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
        <Field label="ลำดับ"><input className={inputCls} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
        <button className="btn btn-primary mb-1" disabled={action.busy}>เพิ่ม</button>
      </form>
      <FormError error={action.error} />
      {rows.length === 0 ? <EmptyState title="ยังไม่มีประเภทผลลัพธ์" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="border-b border-line text-left text-faint"><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">ชื่อที่แสดง</th><th className="py-2 pr-3">หน่วย</th><th className="py-2 pr-3">ลำดับ</th><th className="py-2 pr-3">ใช้งาน</th><th /></tr></thead>
            <tbody>{rows.map((row) => {
              const value = { ...row, ...(edits[row.id] ?? {}) };
              return <tr key={row.id} className="border-b border-paper">
                <td className="py-2 pr-3 font-mono text-xs">{row.code}</td>
                <td className="py-2 pr-3"><input className={inputCls} value={value.name_th} onChange={(e) => edit(row, "name_th", e.target.value)} /></td>
                <td className="py-2 pr-3"><input className={inputCls} value={value.unit ?? ""} onChange={(e) => edit(row, "unit", e.target.value)} /></td>
                <td className="py-2 pr-3"><input className={inputCls} type="number" value={value.sort_order} onChange={(e) => edit(row, "sort_order", Number(e.target.value))} /></td>
                <td className="py-2 pr-3"><input type="checkbox" checked={value.is_active} onChange={(e) => edit(row, "is_active", e.target.checked)} aria-label={`เปิดใช้ ${row.code}`} /></td>
                <td className="py-2 text-right"><button type="button" className="btn btn-outline gap-1" disabled={action.busy || !edits[row.id]} onClick={() => save(row)}><Save className="w-3.5 h-3.5" />บันทึก</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  </div>;
}
