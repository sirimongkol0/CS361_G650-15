"use client";

// Ported from legacy/figma-mock/src/pages/Documents.tsx (Next.js App Router + TU theme tokens).

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronRight,
  FileText,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { loadDocuments, useApiResource } from "@/lib/api";

import { DocumentDownload } from "@/components/document-download";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

const documentStatusLabels: Record<string, string> = {
  active: "ใช้งาน", expiring: "ใกล้หมดอายุ", expired: "หมดอายุ", draft: "อยู่ระหว่างจัดทำ",
};

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const documents = useApiResource(loadDocuments);
  const data = documents.status === "success" ? documents.data : [];

  const filtered = data.filter((d) => {
    const matchSearch =
      d.title.toLocaleLowerCase("th").includes(search.trim().toLocaleLowerCase("th"));
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchType = typeFilter === "all" || d.type === typeFilter;
    const matchFrom = !dateFrom || Boolean(d.expiryDate && d.expiryDate >= dateFrom);
    const matchTo = !dateTo || Boolean(d.effectiveDate && d.effectiveDate <= dateTo);
    return matchSearch && matchStatus && matchType && matchFrom && matchTo
      && (!dateFrom || !dateTo || dateFrom <= dateTo);
  });

  const statuses = Array.from(new Set(data.map((doc) => doc.status).filter((value): value is string => Boolean(value))));
  const types = Array.from(new Set(data.map((doc) => doc.type).filter((value): value is string => Boolean(value))));

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
            บริหารจัดการ MoU, MoA และเอกสารความร่วมมือ
          </p>
        </div>
      </div>

      {documents.status === "loading" && <LoadingState title="กำลังโหลดเอกสาร" />}
      {documents.status === "error" && <ErrorState error={documents.error} onRetry={documents.retry} />}
      {documents.status === "success" && data.length === 0 && <EmptyState title="ยังไม่มีเอกสารที่เผยแพร่" />}

      {documents.status === "success" && data.length > 0 && <>

      {/* Filters */}
      <div className="bg-white border border-line rounded-lg shadow-card p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="ค้นหาชื่อข้อตกลง, หน่วยงาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 140 }}
            value={typeFilter}
            aria-label="ประเภทเอกสาร"
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">ประเภท: ทั้งหมด</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 160 }}
            value={statusFilter}
            aria-label="สถานะเอกสาร"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">สถานะ: ทั้งหมด</option>
            {statuses.map((status) => <option key={status} value={status}>{documentStatusLabels[status] ?? status}</option>)}
          </select>
          <input type="date" aria-label="ช่วงเวลาที่มีผลจาก" className={`${inputCls} !w-auto`} value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} />
          <input type="date" aria-label="ช่วงเวลาที่มีผลถึง" className={`${inputCls} !w-auto`} value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} />
          <button type="button" className="btn btn-outline" onClick={() => {
            setSearch(""); setStatusFilter("all"); setTypeFilter("all"); setDateFrom(""); setDateTo("");
          }}>ล้างตัวกรอง</button>
        </div>
        <p className="text-xs text-faint mt-3">แสดงข้อตกลงที่ช่วงเวลามีผลทับซ้อนกับช่วงที่เลือก รวมวันเริ่มและวันสิ้นสุด หากไม่ทราบวันที่ที่ใช้เทียบจะไม่แสดงในผลกรอง</p>
        {dateFrom && dateTo && dateFrom > dateTo && <p role="alert" className="text-sm text-crimson mt-2">วันเริ่มต้องไม่เกินวันสิ้นสุด</p>}
      </div>

      <p className="mb-4 text-sm text-faint">แสดง {filtered.length} จาก {data.length} รายการ</p>
      {filtered.length === 0 && <EmptyState title="ไม่พบเอกสารที่ค้นหา" message="ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" />}

      {/* Table */}
      <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-[#F8FAFC]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-faint">
                  ชื่อข้อตกลง
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  หน่วยงาน
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  ประเภท
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  วันที่เริ่มต้น
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  วันหมดอายุ
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  ผู้รับผิดชอบ
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-faint">
                  สถานะ
                </th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background:
                            doc.status === "expired"
                              ? "#FEE2E2"
                              : doc.status === "expiring"
                                ? "#FEF3C7"
                                : "#EDE9FE",
                        }}
                      >
                        <FileText
                          className="w-4 h-4"
                          style={{
                            color:
                              doc.status === "expired"
                                ? "#DC2626"
                                : doc.status === "expiring"
                                  ? "#D97706"
                                  : "#7C3AED",
                          }}
                        />
                      </div>
                      <div>
                        <Link
                          href={`/documents/${doc.id}`}
                          className="text-sm font-semibold hover:underline text-ink"
                        >
                          {doc.title}
                        </Link>
                        {doc.sources.length > 0 && <a href={doc.sources[0].url} target="_blank" rel="noreferrer" className="text-[11px] text-crimson hover:underline">แหล่งยืนยัน {doc.sources.length}</a>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-faint">{doc.org}</td>
                  <td className="px-4 py-4">{doc.type && <span className="badge badge-blue">{doc.type}</span>}</td>
                  <td className="px-4 py-4 text-sm text-faint">{doc.start}</td>
                  <td className="px-4 py-4">
                    {doc.expire}
                  </td>
                  <td className="px-4 py-4 text-sm text-faint">
                    {doc.responsible}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${doc.downloadable ? "badge-green" : "badge-gray"}`}>
                      {doc.fileAvailabilityLabel}
                    </span>
                    {doc.status && <span className="badge badge-blue ml-1">{documentStatusLabels[doc.status] ?? doc.status}</span>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="btn p-1.5 text-xs text-faint hover:bg-soft hover:text-ink"
                      >
                        ดู
                      </Link>
                      {doc.downloadable && <DocumentDownload id={doc.id} fileName={doc.fileName} className="btn p-1.5 text-xs text-faint hover:bg-soft hover:text-ink" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  );
}
