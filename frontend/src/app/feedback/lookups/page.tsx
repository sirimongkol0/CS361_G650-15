"use client";

import { useState, type FormEvent } from "react";
import { Save, Search } from "lucide-react";
import { apiErrorMessage, apiGetFresh, apiPatch, apiPost, useApiResource } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { AccessState, EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Field, FormError, Notice, inputCls, useAction } from "@/components/form-ui";
import { useDocumentTitle } from "@/lib/list-tools";
import { Breadcrumb } from "@/components/breadcrumb";

type LookupKind = "respondent-types" | "sources";
type FeedbackLookup = { id: number; code: string; name_th: string; is_active: boolean; sort_order: number };
type LookupData = { respondentTypes: FeedbackLookup[]; feedbackSources: FeedbackLookup[] };

function LookupSection({ title, kind, rows, onChanged }: {
  title: string; kind: LookupKind; rows: FeedbackLookup[]; onChanged: (message: string) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [edits, setEdits] = useState<Record<number, Partial<FeedbackLookup>>>({});
  const [search, setSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const action = useAction();

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (await action.run(() => apiPost(`/feedback/lookups/${kind}`, {
      code: code.trim(), name_th: name.trim(), sort_order: Number(sortOrder),
    }))) {
      setCode(""); setName(""); setSortOrder("0");
      onChanged("เพิ่มรายการแล้ว");
    }
  };

  const save = async (row: FeedbackLookup) => {
    const changes = edits[row.id] ?? {};
    if (await action.run(() => apiPatch(`/feedback/lookups/${kind}/${row.id}`, changes))) {
      setEdits((current) => { const next = { ...current }; delete next[row.id]; return next; });
      onChanged("บันทึกรายการแล้ว");
    }
  };

  const edit = (row: FeedbackLookup, field: keyof FeedbackLookup, value: string | number | boolean) => {
    setEdits((current) => ({ ...current, [row.id]: { ...current[row.id], [field]: value } }));
  };

  const query = search.trim().toLowerCase();
  const filtered = rows.filter((row) =>
    !query || row.code.toLowerCase().includes(query) || row.name_th.toLowerCase().includes(query));
  const dirtyCount = Object.keys(edits).length;
  const saveAll = async () => {
    if (!dirtyCount) return;
    setBulkBusy(true);
    setBulkError(null);
    const failed: string[] = [];
    for (const [rawId, changes] of Object.entries(edits)) {
      try {
        await apiPatch(`/feedback/lookups/${kind}/${rawId}`, changes);
      } catch (error) {
        failed.push(`${rawId}: ${apiErrorMessage(error)}`);
      }
    }
    setBulkBusy(false);
    if (failed.length) {
      setBulkError(`บันทึกไม่สำเร็จ ${failed.length} รายการ: ${failed.join(" · ")}`);
      return;
    }
    setEdits({});
    onChanged(`บันทึก ${dirtyCount} รายการแล้ว`);
  };

  return (
    <section className="rounded-lg bg-white shadow-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-lg text-ink">{title}</h2>
          <p className="mt-0.5 text-xs text-faint">แสดง {filtered.length} จาก {rows.length} รายการ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              className={`${inputCls} pl-8`}
              placeholder="ค้นหารหัสหรือชื่อ"
              aria-label={`ค้นหา${title}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary gap-1.5" disabled={bulkBusy || action.busy || !dirtyCount}
            onClick={() => void saveAll()}>
            <Save className="h-3.5 w-3.5" />
            {bulkBusy ? "กำลังบันทึก…" : `บันทึกทั้งหมด${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </button>
        </div>
      </div>

      {bulkError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{bulkError}</div>
      )}

      <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_2fr_100px_auto] items-end">
        <Field label="รหัส (code)"><input className={inputCls} required pattern="[a-z][a-z0-9_]*" maxLength={80} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="ชื่อที่แสดง"><input className={inputCls} required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="ลำดับ"><input className={inputCls} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
        <button className="btn btn-primary mb-1" disabled={action.busy}>เพิ่ม</button>
      </form>
      <FormError error={action.error} />
      {filtered.length === 0 ? (
        <EmptyState title={rows.length === 0 ? "ยังไม่มีรายการ" : "ไม่พบรายการที่ค้นหา"} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-line text-left text-faint"><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">ชื่อที่แสดง</th><th className="py-2 pr-3">ลำดับ</th><th className="py-2 pr-3">ใช้งาน</th><th /></tr></thead>
            <tbody>{filtered.map((row) => {
              const value = { ...row, ...(edits[row.id] ?? {}) };
              return <tr key={row.id} className="border-b border-paper">
                <td className="py-2 pr-3 font-mono text-xs">{row.code}</td>
                <td className="py-2 pr-3"><input className={inputCls} value={value.name_th} onChange={(e) => edit(row, "name_th", e.target.value)} /></td>
                <td className="py-2 pr-3"><input className={inputCls} type="number" value={value.sort_order} onChange={(e) => edit(row, "sort_order", Number(e.target.value))} /></td>
                <td className="py-2 pr-3"><input type="checkbox" checked={value.is_active} onChange={(e) => edit(row, "is_active", e.target.checked)} aria-label={`เปิดใช้ ${row.code}`} /></td>
                <td className="py-2 text-right"><button type="button" className="btn btn-outline gap-1" disabled={action.busy || bulkBusy || !edits[row.id]} onClick={() => save(row)}><Save className="w-3.5 h-3.5" />บันทึก</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function FeedbackLookupsPage() {
  useDocumentTitle("ตั้งค่าประเภทความคิดเห็น");
  const { role, status } = useRole();
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const allowed = status === "authenticated" && role === "admin";
  const resource = useApiResource<LookupData>(
    () => allowed ? apiGetFresh<LookupData>("/feedback/lookups") : new Promise<never>(() => {}),
    [allowed, reload]
  );

  if (status === "loading") return <div className="p-6"><LoadingState /></div>;
  if (status !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (role !== "admin") return <div className="p-6"><AccessState status={403} /></div>;
  if (resource.status === "loading") return <div className="p-6"><LoadingState /></div>;
  if (resource.status === "error") return <div className="p-6"><ErrorState error={resource.error} onRetry={resource.retry} /></div>;

  const changed = (message: string) => { setNotice(message); setReload((n) => n + 1); };
  return <div className="p-6 max-w-(--breakpoint-xl) mx-auto space-y-5">
    <div>
      <Breadcrumb items={[{ label: "หน้าหลัก", href: "/" }, { label: "ความคิดเห็น", href: "/feedback" }, { label: "ตั้งค่าประเภทความคิดเห็น" }]} />
      <h1 className="text-2xl font-bold text-ink font-display">จัดการประเภทและแหล่งที่มาของความคิดเห็น</h1>
      <p className="text-sm text-faint mt-1">ปิดใช้งานรายการที่ไม่ต้องการใช้ได้ โดยความคิดเห็นเดิมยังคงอยู่</p>
    </div>
    <Notice text={notice} />
    <LookupSection title="ประเภทผู้ส่ง" kind="respondent-types" rows={resource.data.respondentTypes} onChanged={changed} />
    <LookupSection title="แหล่งที่มา" kind="sources" rows={resource.data.feedbackSources} onChanged={changed} />
  </div>;
}
