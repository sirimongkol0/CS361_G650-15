"use client";

import { partnerTypeLabels, label, scopeLevelLabels, type ScopeLevel } from "@/lib/labels";
import { useMemo, useRef } from "react";
import Link from "next/link";
import { PartnerAvatar } from "@/components/partner-avatar";
import { useUrlState } from "@/lib/url-state";
import { SearchInput } from "@/components/search-input";
import { ChevronRight } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/data-states";
import { ScopeLevelBadge, ScopeLevelOptions } from "@/components/scope-level-badge";
import { loadPublicPartners, useApiResource } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import {
  downloadCsv, matchesQuery, sortBy, useDocumentTitle, useRememberResults, usePagination, useSort,
} from "@/lib/list-tools";
import {
  CopyLinkButton, ExportCsvButton, FilterChips, Highlight, PlainHeader, Pagination, SortHeader, TableSkeleton, useRowLink,
  type FilterChip,
} from "@/components/list-ui";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

export default function StakeholdersPage() {
  useDocumentTitle("หน่วยงานคู่ความร่วมมือ");
  const { role } = useRole();
  const [search, setSearch] = useUrlState("q", "");
  const [typeFilter, setTypeFilter] = useUrlState("type", "all");
  const [countryFilter, setCountryFilter] = useUrlState("country", "all");
  const [scopeFilter, setScopeFilter] = useUrlState("scope", "all");
  const sort = useSort();
  const rowLink = useRowLink();
  const partners = useApiResource(loadPublicPartners);

  const data = useMemo(() => (partners.status === "success" ? partners.data : []), [partners]);
  // Hide contact columns while no published partner has public contact details.
  const showContact = data.some((item) => item.contactName);
  const showEmail = data.some((item) => item.contactEmail);
  const types = useMemo(
    () => Array.from(new Set(data.map((item) => item.type).filter((value): value is string => Boolean(value)))),
    [data]
  );
  const countries = useMemo(
    () => Array.from(new Set(data.map((item) => item.country).filter((value): value is string => Boolean(value)))),
    [data]
  );
  const filtered = useMemo(() => {
    const rows = data.filter((item) =>
      matchesQuery(search, item.name, item.contactName) &&
      (typeFilter === "all" || item.type === typeFilter) &&
      (countryFilter === "all" || item.country === countryFilter) &&
      (scopeFilter === "all" || item.scopeLevel === scopeFilter)
    );
    return sortBy(rows, sort.key, sort.desc, {
      name: (item) => item.name,
      type: (item) => (item.type ? label(partnerTypeLabels, item.type) : null),
      country: (item) => item.country,
      scope: (item) => item.scopeLevel,
    });
  }, [countryFilter, data, scopeFilter, search, typeFilter, sort.key, sort.desc]);

  const page = usePagination(filtered.length);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableTop = () => {
    tableRef.current?.scrollTo({ top: 0 });
    tableRef.current?.parentElement?.scrollIntoView({ block: "nearest" });
  };
  useRememberResults("stakeholders", filtered.map((item) => item.id), partners.status === "success");

  const chips: FilterChip[] = [
    search && { label: `ค้นหา: ${search}`, onRemove: () => setSearch("") },
    typeFilter !== "all" && { label: `ประเภท: ${label(partnerTypeLabels, typeFilter)}`, onRemove: () => setTypeFilter("all") },
    countryFilter !== "all" && { label: `ประเทศ: ${countryFilter}`, onRemove: () => setCountryFilter("all") },
    scopeFilter !== "all" && { label: `ระดับ: ${scopeLevelLabels[scopeFilter as ScopeLevel] ?? scopeFilter}`, onRemove: () => setScopeFilter("all") },
  ].filter((chip): chip is FilterChip => Boolean(chip));

  const exportCsv = () => downloadCsv(
    "cstu-stakeholders.csv",
    ["ID", "หน่วยงาน", "ประเภท", "ประเทศ", "ระดับ", ...(showContact ? ["ผู้ติดต่อ"] : []), ...(showEmail ? ["อีเมล"] : [])],
    filtered.map((item) => [
      item.id, item.name, item.type ? label(partnerTypeLabels, item.type) : "", item.country,
      item.scopeLevel ? scopeLevelLabels[item.scopeLevel] : "",
      ...(showContact ? [item.contactName] : []), ...(showEmail ? [item.contactEmail] : []),
    ])
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
            <Link href="/" className="hover:text-crimson">หน้าหลัก</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-crimson">หน่วยงานคู่ความร่วมมือ</span>
          </nav>
          <h1 className="text-2xl font-bold text-ink font-display">หน่วยงานคู่ความร่วมมือ</h1>
          <p className="text-sm mt-0.5 text-faint">
            {role === "public"
              ? "ข้อมูลหน่วยงานและบุคคลคู่ความร่วมมือที่ได้รับอนุญาตให้เผยแพร่"
              : "ข้อมูลหน่วยงานและบุคคลคู่ความร่วมมือที่เกี่ยวข้อง"}
          </p>
        </div>
      </div>

      {partners.status === "loading" && <TableSkeleton columns={4} />}
      {partners.status === "error" && <ErrorState error={partners.error} onRetry={partners.retry} />}
      {partners.status === "success" && partners.data.length === 0 && <EmptyState />}

      {partners.status === "success" && partners.data.length > 0 && (
        <>
          <div className="bg-white rounded-base shadow-card p-4 mb-5">
            <div className="flex flex-wrap gap-3 items-center">
              <SearchInput
                className={inputCls}
                placeholder={showContact ? "ค้นหาหน่วยงานหรือผู้ติดต่อ..." : "ค้นหาหน่วยงาน..."}
                value={search}
                onChange={setSearch}
              />
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} aria-label="ประเภทหน่วยงาน" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">ประเภท: ทั้งหมด</option>
                {types.map((type) => <option key={type} value={type}>{label(partnerTypeLabels, type)}</option>)}
              </select>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} aria-label="ประเทศ" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
                <option value="all">ประเทศ: ทั้งหมด</option>
                {countries.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
              <select className={`${inputCls} cursor-pointer !w-auto min-w-40`} aria-label="ระดับความร่วมมือ" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
                <ScopeLevelOptions />
              </select>
              <button type="button" className="btn btn-outline disabled:opacity-40 disabled:cursor-not-allowed" disabled={chips.length === 0} onClick={() => {
                setSearch(""); setTypeFilter("all"); setCountryFilter("all"); setScopeFilter("all");
              }}>ล้างตัวกรอง</button>
            </div>
            <FilterChips chips={chips} />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-faint">แสดง {filtered.length} จาก {data.length} รายการ</p>
            <div className="flex gap-2">
              <CopyLinkButton label="คัดลอกลิงก์ผลลัพธ์" />
              <ExportCsvButton onExport={exportCsv} disabled={filtered.length === 0} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="ไม่พบหน่วยงานที่ค้นหา" message="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
          ) : (
            <div className="bg-white rounded-base shadow-card overflow-hidden">
              <div ref={tableRef} className="overflow-auto max-h-[75vh]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line">
                      <SortHeader label="หน่วยงาน / บุคคล" sortKey="name" sort={sort} className="px-5" />
                      <SortHeader label="ประเภท" sortKey="type" sort={sort} />
                      <SortHeader label="ประเทศ" sortKey="country" sort={sort} />
                      <SortHeader label="ระดับ" sortKey="scope" sort={sort} />
                      {showContact && <PlainHeader label="ผู้ติดต่อ" />}
                      {showEmail && <PlainHeader label="อีเมล" />}
                      <PlainHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(page.start, page.end).map((item) => {
                      const row = rowLink(`/stakeholders/${item.id}`);
                      return (
                        <tr key={item.id} onClick={row.onClick} className={`${row.className} border-b border-soft hover:bg-[#FAFAFA] transition-colors`}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <PartnerAvatar partner={item} size={38} />
                              <div>
                                <Link href={`/stakeholders/${item.id}`} className="text-sm font-semibold hover:underline text-ink">
                                  <Highlight text={item.name} query={search} />
                                </Link>
                                {item.sources.length > 0 && <a href={item.sources[0].url} target="_blank" rel="noreferrer" className="block text-[11px] text-crimson hover:underline">แหล่งยืนยัน {item.sources.length}</a>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">{item.type && <span className="badge badge-indigo">{label(partnerTypeLabels, item.type)}</span>}</td>
                          <td className="px-4 py-4 text-sm text-faint">{item.country}</td>
                          <td className="px-4 py-4"><ScopeLevelBadge level={item.scopeLevel} /></td>
                          {showContact && <td className="px-4 py-4 text-sm text-faint">{item.contactName && <Highlight text={item.contactName} query={search} />}</td>}
                          {showEmail && <td className="px-4 py-4 text-sm text-faint">{item.contactEmail}</td>}
                          <td className="px-4 py-4">
                            <Link href={`/stakeholders/${item.id}`} className="btn p-1.5 text-xs text-faint hover:bg-soft hover:text-ink">ดูข้อมูล</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
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
