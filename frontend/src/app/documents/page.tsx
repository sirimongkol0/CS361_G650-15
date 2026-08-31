"use client";

// Ported from legacy/figma-mock/src/pages/Documents.tsx (Next.js App Router + TU theme tokens).

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronRight,
  FileText,
  AlertTriangle,
  MoreHorizontal,
  Download,
} from "lucide-react";
import { documents as mockDocuments, documentStatusMap } from "@/lib/mock";
import { loadDocuments, useApiData } from "@/lib/api";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10";

const tabs = ["MoU / MoA", "ข้อตกลงอื่น ๆ", "เอกสารทั้งหมด"];

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState(tabs[0]);

  // API-first with mock.ts as fallback (initial render uses mock until API resolves).
  const documents = useApiData(loadDocuments, mockDocuments);

  const filtered = documents.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.org.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchType = typeFilter === "all" || d.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const expiringCount = documents.filter((d) => d.status === "expiring").length;

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
        <button className="btn btn-primary gap-2">
          <Plus className="w-4 h-4" />
          เพิ่มข้อตกลง
        </button>
      </div>

      {/* Warning banner */}
      {expiringCount > 0 && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-5"
          style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-[#D97706]" />
          <div className="flex-1">
            <span className="font-semibold text-sm text-[#92400E]">
              มี {expiringCount} ฉบับที่ใกล้หมดอายุ
            </span>
            <span className="text-sm ml-2 text-[#B45309]">
              กรุณาตรวจสอบและดำเนินการต่ออายุ
            </span>
          </div>
          <button
            className="btn text-xs"
            style={{ background: "#D97706", color: "#fff" }}
          >
            ดูรายการ
          </button>
        </div>
      )}

      {/* Tabs (mock — เนื้อหา tab อื่นยังไม่แยก รอ V2) */}
      <div className="flex border-b mb-5 border-line">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? "text-crimson border-crimson font-semibold"
                : "text-faint border-transparent hover:text-ink hover:bg-soft rounded-t-md"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

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
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">ประเภท: ทั้งหมด</option>
            <option value="MoU">MoU</option>
            <option value="MoA">MoA</option>
          </select>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="active">ใช้งาน</option>
            <option value="expiring">ใกล้หมดอายุ</option>
            <option value="expired">หมดอายุ</option>
            <option value="draft">อยู่ระหว่างจัดทำ</option>
          </select>
          <select
            className={`${inputCls} cursor-pointer`}
            style={{ width: "auto", minWidth: 180 }}
          >
            <option>วันหมดอายุ: ทั้งหมด</option>
            <option>ใน 30 วัน</option>
            <option>ใน 90 วัน</option>
            <option>ใน 1 ปี</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {Object.entries(documentStatusMap).map(([key, { label, cls }]) => (
          <span key={key} className={`${cls} badge text-xs px-3 py-1`}>
            {label}: {documents.filter((d) => d.status === key).length}
          </span>
        ))}
      </div>

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
                        {doc.status === "expiring" && (
                          <div className="flex items-center gap-1 text-xs mt-0.5 text-[#D97706]">
                            <AlertTriangle className="w-3 h-3" />
                            เหลืออีก {doc.daysLeft} วัน
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-faint">{doc.org}</td>
                  <td className="px-4 py-4">
                    <span className="badge badge-blue">{doc.type}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-faint">{doc.start}</td>
                  <td className="px-4 py-4">
                    <span
                      className="text-sm"
                      style={{
                        color:
                          doc.status === "expired"
                            ? "#DC2626"
                            : doc.status === "expiring"
                              ? "#D97706"
                              : "#374151",
                        fontWeight: doc.status === "expiring" ? 600 : 400,
                      }}
                    >
                      {doc.expire}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-faint">
                    {doc.responsible}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`badge ${documentStatusMap[doc.status].cls}`}>
                      {documentStatusMap[doc.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="btn p-1.5 text-xs text-faint hover:bg-soft hover:text-ink"
                      >
                        ดู
                      </Link>
                      {/* MOCK: ยังไม่ต่อ S3/download — ปุ่ม no-op รอ V2 */}
                      <button
                        title="ดาวน์โหลด (mock)"
                        className="btn p-1.5 text-faint hover:bg-soft hover:text-ink"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button className="btn p-1.5 text-faint hover:bg-soft hover:text-ink">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination (mock) */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-line">
          <span className="text-sm text-faint">
            แสดง 1–{filtered.length} จาก {documents.length} รายการ
          </span>
          <div className="flex gap-1">
            {[1, 2].map((p) => (
              <button
                key={p}
                className="btn text-xs px-3 py-1.5"
                style={{
                  background: p === 1 ? "var(--primary)" : "var(--muted)",
                  color: p === 1 ? "#fff" : "#64748b",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
