"use client";

// ประวัติการแก้ไข: the read-only audit log (GET /audit-logs/) for staff/admin,
// filtered by record type, user and date range, paged by X-Total-Count.

import { useState } from "react";
import Link from "next/link";
import {
  formatThaiDateTime, loadAuditLogs, loadAuditUsers, useApiData, useApiResource, type AuditLogRow,
} from "@/lib/api";
import { useDocumentTitle } from "@/lib/list-tools";
import { useRole } from "@/lib/role-context";
import { AccessState, EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Pagination } from "@/components/list-ui";
import { Breadcrumb } from "@/components/breadcrumb";
import { DateInput } from "@/components/form-ui";
import { fieldLabel, valueLabels } from "@/lib/field-labels";

const PAGE_SIZE = 25;
const MANAGER_ROLES = ["staff", "admin"];

const ENTITY_LABELS: Record<string, string> = {
  partners: "หน่วยงาน",
  documents: "ข้อตกลง",
  activities: "กิจกรรม",
  exchange_students: "นักศึกษาแลกเปลี่ยน",
  feedbacks: "ความคิดเห็น",
  outcomes: "ผลลัพธ์",
  outcome_types: "ประเภทผลลัพธ์",
  improvements: "การปรับปรุง",
  import_batches: "ชุดนำเข้าข้อมูล",
  users: "ผู้ใช้",
};

const ENTITY_PATHS: Record<string, string> = {
  partners: "/stakeholders", documents: "/documents", activities: "/activities",
};

// Every action code the backend passes to audit.record (backend/routers/*.py).
const ACTION_LABELS: Record<string, string> = {
  create: "สร้าง", update: "แก้ไข", delete: "ลบ",
  approved: "อนุมัติ", transition: "เปลี่ยนสถานะ", cstu_review: "ตรวจความเกี่ยวข้องกับ CSTU",
  publish: "เผยแพร่", unpublish: "หยุดเผยแพร่", upload: "อัปโหลดไฟล์", replace_file: "เปลี่ยนไฟล์",
  renewal_decision: "พิจารณาต่ออายุ", commit_import: "ยืนยันนำเข้า", rollback_import: "ย้อนการนำเข้า",
  change_password: "เปลี่ยนรหัสผ่าน",
};

const inputClass =
  "rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-hidden focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

const isEmpty = (value: unknown) => value === null || value === undefined || value === "";

/** A before/after value: "—" when empty, ใช่/ไม่ใช่ for flags, Thai names for stored codes
 *  (the code stays in the tooltip), long JSON folded away. */
function Value({ value, labels }: { value: unknown; labels?: Record<string, string> }) {
  if (isEmpty(value)) return <>—</>;
  if (typeof value === "boolean") return <>{value ? "ใช่" : "ไม่ใช่"}</>;
  if (typeof value === "string" && labels?.[value]) return <span title={value}>{labels[value]}</span>;
  if (typeof value !== "object") return <>{String(value)}</>;
  const text = JSON.stringify(value);
  if (text.length <= 80) return <>{text}</>;
  return (
    <details>
      <summary className="cursor-pointer text-faint">ดูค่า ({text.length} ตัวอักษร)</summary>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap wrap-anywhere text-[11px] text-mute">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

/** Text tag for a value that appeared or was cleared, so the change is not shown by colour alone. */
const ChangeTag = ({ children }: { children: string }) => (
  <span className="mr-1 rounded-sm border border-current px-1 text-[10px] font-semibold">{children}</span>
);

/** Fields whose value differs between before and after (all fields for a create or delete). */
function changedFields(row: AuditLogRow) {
  const before = row.before ?? {};
  const after = row.after ?? {};
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}

function Changes({ row }: { row: AuditLogRow }) {
  const fields = changedFields(row).map((field) => ({ ...field, labels: valueLabels(row.entity, field.key) }));
  if (fields.length === 0) return <span className="text-xs text-faint">ไม่มีค่าที่เปลี่ยน</span>;
  return (
    <details>
      <summary className="cursor-pointer text-xs font-semibold text-crimson">{fields.length} ฟิลด์</summary>
      {/* Fixed column widths: with auto layout a short value column shrinks until even
          "approved" breaks mid-word under overflow-wrap:anywhere. */}
      <table className="mt-2 w-full table-fixed text-xs">
        <colgroup><col className="w-[28%]" /><col className="w-[36%]" /><col className="w-[36%]" /></colgroup>
        <thead><tr className="text-left text-faint"><th scope="col" className="pr-3 font-medium">ฟิลด์</th><th scope="col" className="pr-3 font-medium">ก่อน</th><th scope="col" className="font-medium">หลัง</th></tr></thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.key} className="border-t border-line align-top">
              <th scope="row" className="py-1 pr-3 text-left font-medium text-mute" title={field.key}>{fieldLabel(field.key)}</th>
              <td className="py-1 pr-3 wrap-anywhere text-[#b91c1c]">
                {!isEmpty(field.before) && isEmpty(field.after) && <ChangeTag>ลบ</ChangeTag>}
                <Value value={field.before} labels={field.labels} />
              </td>
              <td className="py-1 wrap-anywhere text-[#15803d]">
                {isEmpty(field.before) && !isEmpty(field.after) && <ChangeTag>เพิ่ม</ChangeTag>}
                <Value value={field.after} labels={field.labels} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function RecordLink({ row }: { row: AuditLogRow }) {
  const name = ENTITY_LABELS[row.entity] ?? row.entity;
  const base = ENTITY_PATHS[row.entity];
  if (row.entity_id == null) return <>{name}</>;
  return base && row.action !== "delete"
    ? <Link href={`${base}/${row.entity_id}`} className="text-crimson hover:underline">{name} #{row.entity_id}</Link>
    : <>{name} #{row.entity_id}</>;
}

export default function AuditLogPage() {
  useDocumentTitle("ประวัติการแก้ไข");
  const { role, status: session } = useRole();
  const allowed = session === "authenticated" && MANAGER_ROLES.includes(role);
  const [entity, setEntity] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const filterKey = [entity, userId, dateFrom, dateTo];
  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const logs = useApiResource(
    () => (allowed && !invalidRange
      ? loadAuditLogs({ entity, userId: userId ? Number(userId) : null, dateFrom, dateTo,
        limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      : new Promise<never>(() => {})),
    [allowed, page, ...filterKey],
  );
  const users = useApiData(() => (allowed ? loadAuditUsers().catch(() => []) : Promise.resolve([])), [], [allowed]);

  if (session === "loading") return <div className="p-6"><LoadingState /></div>;
  if (session !== "authenticated") return <div className="p-6"><AccessState status={401} /></div>;
  if (!allowed) return <div className="p-6"><AccessState status={403} /></div>;

  const setFilter = (set: (value: string) => void) => (value: string) => { set(value); setPage(1); };
  return (
    <div className="p-6 max-w-(--breakpoint-xl) mx-auto">
      <Breadcrumb items={[{ label: "หน้าหลัก", href: "/" }, { label: "ประวัติการแก้ไข" }]} />
      <h1 className="text-2xl font-bold text-ink font-display">ประวัติการแก้ไข</h1>
      <p className="text-sm mt-0.5 mb-5 text-faint">บันทึกการเปลี่ยนแปลงข้อมูลทั้งหมด (อ่านอย่างเดียว)</p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-xs text-faint">รายการ
          <select className={`${inputClass} mt-1 block`} value={entity} onChange={(e) => setFilter(setEntity)(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {Object.entries(ENTITY_LABELS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs text-faint">ผู้ใช้
          <select className={`${inputClass} mt-1 block`} value={userId} onChange={(e) => setFilter(setUserId)(e.target.value)}>
            <option value="">ทุกคน</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
          </select>
        </label>
        <label className="text-xs text-faint">ตั้งแต่วันที่
          <DateInput aria-label="ตั้งแต่วันที่" value={dateFrom} onChange={(e) => setFilter(setDateFrom)(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-faint">ถึงวันที่
          <DateInput aria-label="ถึงวันที่" value={dateTo} onChange={(e) => setFilter(setDateTo)(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
      </div>
      {invalidRange && <p role="alert" className="mb-4 text-sm text-crimson">วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด</p>}

      <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
        {logs.status === "loading" && !invalidRange && <LoadingState />}
        {logs.status === "error" && <ErrorState error={logs.error} onRetry={logs.retry} />}
        {logs.status === "success" && logs.data.total === 0 && (
          <EmptyState title="ไม่พบประวัติการแก้ไข" message="ลองเปลี่ยนตัวกรอง" />
        )}
        {logs.status === "success" && logs.data.total > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-left text-xs text-faint">
                    <th className="px-4 py-3 font-semibold">เวลา</th>
                    <th className="px-4 py-3 font-semibold">ผู้ใช้</th>
                    <th className="px-4 py-3 font-semibold">การกระทำ</th>
                    <th className="px-4 py-3 font-semibold">รายการ</th>
                    <th className="px-4 py-3 font-semibold">ค่าก่อน → หลัง</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data.rows.map((row) => (
                    <tr key={row.id} className="border-t border-line align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-mute">{formatThaiDateTime(row.created_at)}</td>
                      <td className="px-4 py-3 text-mute">{row.user_email ?? "ระบบ"}</td>
                      <td className="px-4 py-3"><span className="badge badge-gray">{ACTION_LABELS[row.action] ?? row.action}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap"><RecordLink row={row} /></td>
                      <td className="px-4 py-3 min-w-[260px]"><Changes row={row} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(logs.data.total / PAGE_SIZE))}
              start={(page - 1) * PAGE_SIZE}
              end={(page - 1) * PAGE_SIZE + logs.data.rows.length}
              total={logs.data.total}
              onPage={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
