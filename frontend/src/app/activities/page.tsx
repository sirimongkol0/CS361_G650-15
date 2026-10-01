"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useUrlState } from "@/lib/url-state";
import { SearchInput } from "@/components/search-input";
import { CalendarDays, ChevronRight, MoreHorizontal, Plus, Users } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/data-states";
import { ScopeLevelBadge, ScopeLevelOptions } from "@/components/scope-level-badge";
import { loadActivities, useApiResource } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { activityTypeColors, activityTypeLabels, label, scopeLevelLabels, type ScopeLevel } from "@/lib/labels";
import { formatThaiDate } from "@/lib/api";
import {
  downloadCsv, matchesQuery, sortBy, useDocumentTitle, useRememberResults, usePagination, useSort,
} from "@/lib/list-tools";
import {
  CopyLinkButton, DatePresets, ExportCsvButton, FilterChips, Highlight, PlainHeader, Pagination, SortHeader, TableSkeleton,
  useRowLink, yearPresets, type FilterChip,
} from "@/components/list-ui";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

export default function ActivitiesPage() {
  useDocumentTitle("กิจกรรม");
  const { role } = useRole();
  const sort = useSort();
  const rowLink = useRowLink();
  const [search, setSearch] = useUrlState("q", "");
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [orgFilter, setOrgFilter] = useUrlState("org", "all");
  const [statusFilter, setStatusFilter] = useUrlState("status", "all");
  const [scopeFilter, setScopeFilter] = useUrlState("scope", "all");
  const [dateFrom, setDateFrom] = useUrlState("from", "");
  const [dateTo, setDateTo] = useUrlState("to", "");
  const activities = useApiResource(loadActivities);

  const data = useMemo(() => (activities.status === "success" ? activities.data : []), [activities]);
  // Hide the participants column until the data actually records participant counts.
  const showParticipants = data.some((item) => item.participants > 0);
  const types = useMemo(() => Array.from(new Set(data.map((item) => item.type))), [data]);
  const organizations = useMemo(() => Array.from(new Set(data.map((item) => item.org).filter((org) => org !== "—"))), [data]);
  const filtered = useMemo(() => {
    const rangeStart = dateFrom ? new Date(dateFrom).getTime() : null;
    const rangeEnd = dateTo ? new Date(dateTo).getTime() : null;

    const rows = data.filter((item) => {
      const activityStart = item.startDate
        ? new Date(item.startDate).getTime()
        : NaN;

      const activityEnd = item.endDate
        ? new Date(item.endDate).getTime()
        : activityStart;

      const matchesSearch = matchesQuery(search, item.name, item.org);

      const matchesType =
        typeFilter === "all" || item.type === typeFilter;

      const matchesOrganization =
        orgFilter === "all" || item.org === orgFilter;

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const matchesScope =
        scopeFilter === "all" || item.scopeLevel === scopeFilter;

      const matchesDateFrom =
        rangeStart === null ||
        (!Number.isNaN(activityEnd) && activityEnd >= rangeStart);

      const matchesDateTo =
        rangeEnd === null ||
        (!Number.isNaN(activityStart) && activityStart <= rangeEnd);

      return (
        matchesSearch &&
        matchesType &&
        matchesOrganization &&
        matchesStatus &&
        matchesScope &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
    return sortBy(rows, sort.key, sort.desc, {
      name: (item) => item.name,
      org: (item) => (item.org === "—" ? null : item.org),
      type: (item) => label(activityTypeLabels, item.type),
      scope: (item) => item.scopeLevel,
      date: (item) => item.startDate,
      participants: (item) => (item.participants > 0 ? item.participants : null),
      status: (item) => item.status,
    });
  }, [
    sort.key,
    sort.desc,
    data,
    search,
    typeFilter,
    orgFilter,
    statusFilter,
    scopeFilter,
    dateFrom,
    dateTo,
  ]);

  const page = usePagination(filtered.length);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableTop = () => {
    tableRef.current?.scrollTo({ top: 0 });
    tableRef.current?.parentElement?.scrollIntoView({ block: "nearest" });
  };
  useRememberResults("activities", filtered.map((item) => item.id), activities.status === "success");

  const chips: FilterChip[] = [
    search && { label: `ค้นหา: ${search}`, onRemove: () => setSearch("") },
    typeFilter !== "all" && { label: `ประเภท: ${label(activityTypeLabels, typeFilter)}`, onRemove: () => setTypeFilter("all") },
    orgFilter !== "all" && { label: `หน่วยงาน: ${orgFilter}`, onRemove: () => setOrgFilter("all") },
    statusFilter !== "all" && { label: `สถานะ: ${statusFilter}`, onRemove: () => setStatusFilter("all") },
    scopeFilter !== "all" && { label: `ระดับ: ${scopeLevelLabels[scopeFilter as ScopeLevel] ?? scopeFilter}`, onRemove: () => setScopeFilter("all") },
    dateFrom && { label: `ตั้งแต่ ${formatThaiDate(dateFrom)}`, onRemove: () => setDateFrom("") },
    dateTo && { label: `ถึง ${formatThaiDate(dateTo)}`, onRemove: () => setDateTo("") },
  ].filter((chip): chip is FilterChip => Boolean(chip));

  const exportCsv = () => downloadCsv(
    "cstu-activities.csv",
    ["ID", "ชื่อกิจกรรม", "หน่วยงาน", "ประเภท", "ระดับ", "วันที่", "วันที่ (ISO)", "ผู้เข้าร่วม", "สถานะ"],
    filtered.map((item) => [
      item.id, item.name, item.org, label(activityTypeLabels, item.type),
      item.scopeLevel ? scopeLevelLabels[item.scopeLevel] : "", item.date, item.startDate,
      item.participants > 0 ? item.participants : "", item.status,
    ])
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="hover:text-crimson">หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">กิจกรรม</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">กิจกรรม</h1>
          <p className="text-sm mt-0.5 text-faint">
            {role === "public" ? "กิจกรรมความร่วมมือที่ได้รับอนุญาตให้เผยแพร่" : "กิจกรรมและโครงการความร่วมมือ"}
          </p>
        </div>
        {role !== "public" && (
          <button className="btn btn-primary gap-2" type="button"><Plus className="w-4 h-4" />เพิ่มกิจกรรม</button>
        )}
      </div>

      {activities.status === "loading" && <TableSkeleton columns={5} />}
      {activities.status === "error" && <ErrorState error={activities.error} onRetry={activities.retry} />}
      {activities.status === "success" && activities.data.length === 0 && <EmptyState title="ยังไม่มีกิจกรรมที่เผยแพร่" />}

      {activities.status === "success" && activities.data.length > 0 && (
        <>
          <div className="bg-white rounded-base shadow-card p-4 mb-5">
            <div className="flex flex-wrap gap-3">
              <SearchInput className={inputCls} placeholder="ค้นหากิจกรรมหรือหน่วยงาน..." value={search} onChange={setSearch} />
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} aria-label="ประเภทกิจกรรม" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">ประเภท: ทั้งหมด</option>
                {types.map((type) => <option key={type} value={type}>{label(activityTypeLabels, type)}</option>)}
              </select>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} aria-label="หน่วยงาน" value={orgFilter} onChange={(event) => setOrgFilter(event.target.value)}>
                <option value="all">หน่วยงาน: ทั้งหมด</option>
                {organizations.map((org) => <option key={org} value={org}>{org}</option>)}
              </select>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} aria-label="สถานะกิจกรรม" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">สถานะ: ทั้งหมด</option>
                <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                <option value="วางแผน">วางแผน</option>
                <option value="ไม่ระบุ">ไม่ระบุ</option>
              </select>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} aria-label="ระดับความร่วมมือ" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
                <ScopeLevelOptions />
              </select>
              <input
                type="date"
                className={`${inputCls} !w-auto`}
                aria-label="วันที่เริ่มต้น"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
              />

              <input
                type="date"
                className={`${inputCls} !w-auto`}
                aria-label="วันที่สิ้นสุด"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
              />

              <button
                type="button"
                className="btn btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={chips.length === 0}
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setOrgFilter("all");
                  setStatusFilter("all");
                  setScopeFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                ล้างตัวกรอง
              </button>
            </div>
            <DatePresets presets={yearPresets()} onPick={(from, to) => { setDateFrom(from); setDateTo(to); }} />
            <FilterChips chips={chips} />
          </div>

          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <span className="text-sm text-faint">แสดง {filtered.length} จาก {data.length} กิจกรรม</span>
            <span className="badge badge-green">เสร็จสิ้น: {data.filter((item) => item.status === "เสร็จสิ้น").length}</span>
            <span className="badge badge-blue">กำลังดำเนินการ: {data.filter((item) => item.status === "กำลังดำเนินการ").length}</span>
            <span className="badge badge-purple">วางแผน: {data.filter((item) => item.status === "วางแผน").length}</span>
            <div className="flex-1" />
            <CopyLinkButton label="คัดลอกลิงก์ผลลัพธ์" />
            <ExportCsvButton onExport={exportCsv} disabled={filtered.length === 0} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="ไม่พบกิจกรรมที่ค้นหา" message="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
          ) : (
            <div className="bg-white rounded-base shadow-card overflow-hidden">
              <div ref={tableRef} className="overflow-auto max-h-[75vh]">
                <table className="w-full">
                  <thead><tr className="border-b border-line">
                    <SortHeader label="ชื่อกิจกรรม" sortKey="name" sort={sort} className="px-5" />
                    <SortHeader label="หน่วยงาน" sortKey="org" sort={sort} />
                    <SortHeader label="ประเภท" sortKey="type" sort={sort} />
                    <SortHeader label="ระดับ" sortKey="scope" sort={sort} />
                    <SortHeader label="วันที่" sortKey="date" sort={sort} />
                    {showParticipants && <SortHeader label="ผู้เข้าร่วม" sortKey="participants" sort={sort} />}
                    <SortHeader label="สถานะ" sortKey="status" sort={sort} />
                    <PlainHeader />
                  </tr></thead>
                  <tbody>{filtered.slice(page.start, page.end).map((item) => {
                    const row = rowLink(`/activities/${item.id}`);
                    return (
                    <tr key={item.id} onClick={row.onClick} className={`${row.className} border-b border-soft hover:bg-[#FAFAFA] transition-colors`}>
                      <td className="px-5 py-4"><div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#DBEAFE]"><CalendarDays className="w-4 h-4 text-[#1D4ED8]" /></div>
                        <Link href={`/activities/${item.id}`} className="text-sm font-semibold hover:underline text-ink"><Highlight text={item.name} query={search} /></Link>
                      </div></td>
                      <td className="px-4 py-4 text-sm text-faint"><Highlight text={item.org} query={search} /></td>
                      <td className="px-4 py-4"><span className={`badge ${activityTypeColors[item.type] ?? "badge-gray"}`}>{label(activityTypeLabels, item.type)}</span></td>
                      <td className="px-4 py-4"><ScopeLevelBadge level={item.scopeLevel} /></td>
                      <td className="px-4 py-4 text-sm text-faint">{item.date}</td>
                      {showParticipants && <td className="px-4 py-4"><span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Users className="w-3.5 h-3.5 text-faint" />{item.participants > 0 ? item.participants : "–"}</span></td>}
                      <td className="px-4 py-4"><span className={`badge ${item.statusColor}`}>{item.status}</span></td>
                      <td className="px-4 py-4"><div className="flex gap-1">
                        <Link href={`/activities/${item.id}`} className="btn p-1.5 text-xs text-faint hover:bg-soft hover:text-ink">ดูข้อมูล</Link>
                        {role !== "public" && <button className="btn p-1.5 text-faint hover:bg-soft hover:text-ink" type="button" aria-label={`จัดการ ${item.name}`}><MoreHorizontal className="w-4 h-4" /></button>}
                      </div></td>
                    </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              <Pagination {...page} total={filtered.length} onPage={(next) => { page.setPage(next); tableTop(); }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
