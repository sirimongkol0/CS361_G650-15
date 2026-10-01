"use client";

// Ported from legacy/figma-mock/src/pages/Documents.tsx (Next.js App Router + TU theme tokens).

import { useMemo, useRef } from "react";
import { useUrlState } from "@/lib/url-state";
import { SearchInput } from "@/components/search-input";
import { documentStatusLabels, documentTypeLabels, label, scopeLevelLabels, type ScopeLevel } from "@/lib/labels";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
} from "lucide-react";
import { EmptyState, ErrorState } from "@/components/data-states";
import { ScopeLevelBadge, ScopeLevelOptions } from "@/components/scope-level-badge";
import { ExpiryBadge } from "@/components/expiry-badge";
import { formatThaiDate, loadDocuments, useApiResource } from "@/lib/api";
import {
  downloadCsv, matchesQuery, sortBy, todayIso, useDocumentTitle, useRememberResults, usePagination, useSort,
} from "@/lib/list-tools";
import {
  CopyLinkButton, DatePresets, ExportCsvButton, FilterChips, Highlight, PlainHeader, Pagination, SortHeader, TableSkeleton,
  useRowLink, yearPresets, type FilterChip,
} from "@/components/list-ui";


const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";


export default function DocumentsPage() {
  useDocumentTitle("เอกสารข้อตกลง");
  const [search, setSearch] = useUrlState("q", "");
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [statusFilter, setStatusFilter] = useUrlState("status", "all");
  const [scopeFilter, setScopeFilter] = useUrlState("scope", "all");
  const [dateFrom, setDateFrom] = useUrlState("from", "");
  const [dateTo, setDateTo] = useUrlState("to", "");
  const sort = useSort();
  const rowLink = useRowLink();
  const documents = useApiResource(loadDocuments);
  const data = useMemo(() => (documents.status === "success" ? documents.data : []), [documents]);

  const filtered = useMemo(() => {
    const rows = data.filter((d) => {
      const matchSearch = matchesQuery(search, d.title, d.org);
      const matchType = typeFilter === "all" || d.type === typeFilter;
      const matchFrom = !dateFrom || Boolean(d.expiryDate && d.expiryDate >= dateFrom);
      const matchTo = !dateTo || Boolean(d.effectiveDate && d.effectiveDate <= dateTo);
      const matchStatus = statusFilter === "all" || (d.status ?? "unknown") === statusFilter;
      const matchScope = scopeFilter === "all" || d.scopeLevel === scopeFilter;
      return matchSearch && matchType && matchStatus && matchScope && matchFrom && matchTo
        && (!dateFrom || !dateTo || dateFrom <= dateTo);
    });
    return sortBy(rows, sort.key, sort.desc, {
      title: (d) => d.title,
      org: (d) => d.org,
      type: (d) => d.type,
      scope: (d) => d.scopeLevel,
      status: (d) => (d.status ? label(documentStatusLabels, d.status) : null),
      start: (d) => d.effectiveDate,
      expire: (d) => d.expiryDate,
      responsible: (d) => d.responsible,
    });
  }, [data, search, typeFilter, statusFilter, scopeFilter, dateFrom, dateTo, sort.key, sort.desc]);

  const types = Array.from(new Set(data.map((doc) => doc.type).filter((value): value is string => Boolean(value))));

  const showExpiry = data.some((doc) => doc.expire);
  const showResponsible = data.some((doc) => doc.responsible);

  const page = usePagination(filtered.length);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableTop = () => {
    tableRef.current?.scrollTo({ top: 0 });
    tableRef.current?.parentElement?.scrollIntoView({ block: "nearest" });
  };
  useRememberResults("documents", filtered.map((doc) => doc.id), documents.status === "success");

  const today = todayIso();
  const presets = [...yearPresets(), { label: "ที่ยังมีผลวันนี้", from: today, to: today }];
  const chips: FilterChip[] = [
    search && { label: `ค้นหา: ${search}`, onRemove: () => setSearch("") },
    typeFilter !== "all" && { label: `ประเภท: ${label(documentTypeLabels, typeFilter)}`, onRemove: () => setTypeFilter("all") },
    statusFilter !== "all" && { label: `สถานะ: ${statusFilter === "unknown" ? "ไม่ระบุ" : label(documentStatusLabels, statusFilter)}`, onRemove: () => setStatusFilter("all") },
    scopeFilter !== "all" && { label: `ระดับ: ${scopeLevelLabels[scopeFilter as ScopeLevel] ?? scopeFilter}`, onRemove: () => setScopeFilter("all") },
    dateFrom && { label: `ตั้งแต่ ${formatThaiDate(dateFrom)}`, onRemove: () => setDateFrom("") },
    dateTo && { label: `ถึง ${formatThaiDate(dateTo)}`, onRemove: () => setDateTo("") },
  ].filter((chip): chip is FilterChip => Boolean(chip));

  const exportCsv = () => downloadCsv(
    "cstu-documents.csv",
    ["ID", "ชื่อข้อตกลง", "หน่วยงาน", "ประเภท", "ระดับ", "สถานะ", "วันที่เริ่มต้น", "วันหมดอายุ", "ผู้รับผิดชอบ"],
    filtered.map((doc) => [
      doc.id, doc.title, doc.org, doc.type ? label(documentTypeLabels, doc.type) : "",
      doc.scopeLevel ? scopeLevelLabels[doc.scopeLevel] : "",
      doc.status ? label(documentStatusLabels, doc.status) : "ไม่ระบุ",
      doc.effectiveDate, doc.expiryDate, doc.responsible,
    ])
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="text-faint hover:text-crimson">
              หน้าหลัก
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">เอกสารข้อตกลง</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">
            เอกสารข้อตกลง
          </h1>
          <p className="text-sm mt-0.5 text-faint">
            ค้นหาและดู MoU, MoA และเอกสารความร่วมมือที่เผยแพร่
          </p>
        </div>
      </div>

      {documents.status === "loading" && <TableSkeleton columns={5} />}
      {documents.status === "error" && <ErrorState error={documents.error} onRetry={documents.retry} />}
      {documents.status === "success" && data.length === 0 && <EmptyState title="ยังไม่มีเอกสารที่เผยแพร่" />}

      {documents.status === "success" && data.length > 0 && <>

      {/* Filters */}
      <div className="bg-white rounded-base shadow-card p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <SearchInput
            className={inputCls}
            placeholder="ค้นหาชื่อข้อตกลง, หน่วยงาน..."
            value={search}
            onChange={setSearch}
          />
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 140 }}
            value={typeFilter}
            aria-label="ประเภทเอกสาร"
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">ประเภท: ทั้งหมด</option>
            {types.map((type) => <option key={type} value={type}>{label(documentTypeLabels, type)}</option>)}
          </select>
          <select className={`${inputCls} cursor-pointer !w-auto`} aria-label="สถานะเอกสาร" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">สถานะ: ทั้งหมด</option>
            {Object.entries(documentStatusLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            <option value="unknown">ไม่ระบุ</option>
          </select>
          <select className={`${inputCls} cursor-pointer !w-auto`} aria-label="ระดับความร่วมมือ" value={scopeFilter} onChange={event => setScopeFilter(event.target.value)}>
            <ScopeLevelOptions />
          </select>
          <input type="date" aria-label="ช่วงเวลาที่มีผลจาก" className={`${inputCls} !w-auto`} value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} />
          <input type="date" aria-label="ช่วงเวลาที่มีผลถึง" className={`${inputCls} !w-auto`} value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} />
          <button type="button" className="btn btn-outline disabled:opacity-40 disabled:cursor-not-allowed" disabled={chips.length === 0} onClick={() => {
            setSearch(""); setTypeFilter("all"); setStatusFilter("all"); setScopeFilter("all"); setDateFrom(""); setDateTo("");
          }}>ล้างตัวกรอง</button>
        </div>
        <DatePresets presets={presets} onPick={(from, to) => { setDateFrom(from); setDateTo(to); }} />
        <p className="text-xs text-faint mt-3">แสดงข้อตกลงที่ช่วงเวลามีผลทับซ้อนกับช่วงที่เลือก รวมวันเริ่มและวันสิ้นสุด หากไม่ทราบวันที่ที่ใช้เทียบจะไม่แสดงในผลกรอง</p>
        {dateFrom && dateTo && dateFrom > dateTo && <p role="alert" className="text-sm text-crimson mt-2">วันเริ่มต้องไม่เกินวันสิ้นสุด</p>}
        <FilterChips chips={chips} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-faint">แสดง {filtered.length} จาก {data.length} รายการ</p>
        <div className="flex gap-2">
          <CopyLinkButton label="คัดลอกลิงก์ผลลัพธ์" />
          <ExportCsvButton onExport={exportCsv} disabled={filtered.length === 0} />
        </div>
      </div>
      {filtered.length === 0 && <EmptyState title="ไม่พบเอกสารที่ค้นหา" message="ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" />}

      {/* Table */}
      {filtered.length > 0 && <div className="bg-white rounded-base shadow-card overflow-hidden">
        <div ref={tableRef} className="overflow-auto max-h-[75vh]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <SortHeader label="ชื่อข้อตกลง" sortKey="title" sort={sort} className="px-5" />
                <SortHeader label="หน่วยงาน" sortKey="org" sort={sort} />
                <SortHeader label="ประเภท" sortKey="type" sort={sort} />
                <SortHeader label="ระดับ" sortKey="scope" sort={sort} />
                <SortHeader label="สถานะ" sortKey="status" sort={sort} />
                <SortHeader label="วันที่เริ่มต้น" sortKey="start" sort={sort} />
                {showExpiry && <SortHeader label="วันหมดอายุ" sortKey="expire" sort={sort} />}
                {showResponsible && <SortHeader label="ผู้รับผิดชอบ" sortKey="responsible" sort={sort} />}
                <PlainHeader />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(page.start, page.end).map((doc) => {
                const row = rowLink(`/documents/${doc.id}`);
                return (
                <tr
                  key={doc.id}
                  onClick={row.onClick}
                  className={`${row.className} border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "#EDE9FE",
                        }}
                      >
                        <FileText
                          className="w-4 h-4"
                          style={{
                            color: "#7C3AED",
                          }}
                        />
                      </div>
                      <div>
                        <Link
                          href={`/documents/${doc.id}`}
                          className="text-sm font-semibold hover:underline text-ink"
                        >
                          <Highlight text={doc.title} query={search} />
                        </Link>
                        {doc.sources.length > 0 && <a href={doc.sources[0].url} target="_blank" rel="noreferrer" className="ml-2 inline-block text-[11px] text-crimson hover:underline">แหล่งยืนยัน {doc.sources.length}</a>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-faint">{doc.org && <Highlight text={doc.org} query={search} />}</td>
                  <td className="px-4 py-4">{doc.type && <span className="badge badge-blue">{label(documentTypeLabels, doc.type)}</span>}</td>
                  <td className="px-4 py-4"><ScopeLevelBadge level={doc.scopeLevel} /></td>
                  <td className="px-4 py-4 text-sm text-faint">{doc.status ? label(documentStatusLabels, doc.status) : "ไม่ระบุ"}</td>
                  <td className="px-4 py-4 text-sm text-faint">{doc.start}</td>
                  {showExpiry && <td className="px-4 py-4">
                    <div className="text-sm">{doc.expire}</div>
                    <ExpiryBadge expiryDate={doc.expiryDate} />
                  </td>}
                  {showResponsible && <td className="px-4 py-4 text-sm text-faint">
                    {doc.responsible}
                  </td>}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="btn p-1.5 text-xs text-faint hover:bg-soft hover:text-ink"
                      >
                        ดู
                      </Link>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...page} total={filtered.length} onPage={(next) => { page.setPage(next); tableTop(); }} />
      </div>}
      </>}
    </div>
  );
}
