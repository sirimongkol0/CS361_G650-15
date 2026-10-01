"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Download, Link2, X } from "lucide-react";
import { normalizeText } from "@/lib/list-tools";

/* Shared UI pieces for the public list pages. */

/** Wraps the parts of `text` that match the search words in <mark>. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return <>{text}</>;
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "giu"));
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1
          ? <mark key={index} className="rounded-sm bg-[#F5E0A8] text-inherit">{part}</mark>
          : <Fragment key={index}>{part}</Fragment>
      )}
    </>
  );
}

export function SortHeader({ label, sortKey, sort, className = "px-4" }: {
  label: string;
  sortKey: string;
  sort: { key: string; desc: boolean; toggle: (key: string) => void };
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
  return (
    <th
      className={`sticky top-0 z-10 bg-paper text-left py-3.5 text-xs font-semibold text-faint ${className}`}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => sort.toggle(sortKey)}>
        {label}
        <Icon className={`w-3 h-3 ${active ? "text-crimson" : "opacity-50"}`} />
      </button>
    </th>
  );
}

export function PlainHeader({ label = "", className = "px-4" }: { label?: string; className?: string }) {
  return <th className={`sticky top-0 z-10 bg-paper text-left py-3.5 text-xs font-semibold text-faint ${className}`}>{label}</th>;
}

export interface FilterChip {
  label: string;
  onRemove: () => void;
}

export function FilterChips({ chips }: { chips: FilterChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded-full border border-crimson/30 bg-[#FDF2F5] px-2.5 py-0.5 text-xs text-crimson hover:bg-[#F5D6DE]"
          aria-label={`ลบตัวกรอง ${chip.label}`}
        >
          {chip.label}
          <X className="w-3 h-3" />
        </button>
      ))}
    </div>
  );
}

export function DatePresets({ presets, onPick }: {
  presets: { label: string; from: string; to: string }[];
  onPick: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
      <span className="text-faint">ช่วงเวลาด่วน:</span>
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className="rounded-full border border-line px-2.5 py-0.5 text-mute hover:border-crimson hover:text-crimson"
          onClick={() => onPick(preset.from, preset.to)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

/** Year presets ("ปีนี้", "ปีที่แล้ว") on the calendar year. */
export function yearPresets() {
  const year = new Date().getFullYear();
  return [
    { label: "ปีนี้", from: `${year}-01-01`, to: `${year}-12-31` },
    { label: "ปีที่แล้ว", from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
  ];
}

export function CopyLinkButton({ label = "คัดลอกลิงก์", className = "btn btn-outline gap-2 text-sm" }: { label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
      {copied ? "คัดลอกแล้ว" : label}
    </button>
  );
}

export function ExportCsvButton({ onExport, disabled }: { onExport: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="btn btn-outline gap-2 text-sm disabled:opacity-40" onClick={onExport} disabled={disabled}>
      <Download className="w-4 h-4" />
      ส่งออก CSV
    </button>
  );
}

/** Page numbers to show: first, last, current ±1, with "…" for the gaps. */
function pageItems(page: number, pageCount: number): (number | "gap")[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = Array.from(wanted).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  sorted.forEach((n, index) => {
    if (index > 0 && n - sorted[index - 1] > 1) items.push(n - sorted[index - 1] === 2 ? n - 1 : "gap");
    items.push(n);
  });
  return items;
}

export function Pagination({ page, pageCount, start, end, total, onPage }: {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const stepCls = "btn btn-outline p-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-soft px-5 py-3 text-sm" aria-label="เลือกหน้า">
      <span className="text-faint">แสดง {start + 1}–{end} จาก {total} รายการ</span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={stepCls} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="หน้าก่อนหน้า">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageItems(page, pageCount).map((item, index) =>
            item === "gap"
              ? <span key={`gap-${index}`} className="px-1.5 text-faint">…</span>
              : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPage(item)}
                  aria-current={item === page ? "page" : undefined}
                  className={`min-w-8 rounded-lg px-2 py-1 text-sm ${item === page ? "bg-crimson font-semibold text-white" : "text-mute hover:bg-soft"}`}
                >
                  {item}
                </button>
              )
          )}
          <button type="button" className={stepCls} disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="หน้าถัดไป">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </nav>
  );
}

/** Makes a whole table row open `href`, while inner links and buttons keep working. */
export function useRowLink() {
  const router = useRouter();
  return (href: string) => ({
    className: "cursor-pointer",
    onClick: (event: React.MouseEvent<HTMLTableRowElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("a, button, input, select") || window.getSelection()?.toString()) return;
      if (event.ctrlKey || event.metaKey) window.open(href, "_blank");
      else router.push(href);
    },
  });
}

/** Grey placeholder rows shown while a list loads. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white rounded-base shadow-card overflow-hidden" role="status" aria-live="polite" aria-label="กำลังโหลดข้อมูล">
      <div className="h-11 border-b border-line bg-paper" />
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-6 border-b border-soft px-5 py-4">
          <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-lg bg-soft" />
          {Array.from({ length: columns }, (_, column) => (
            <div
              key={column}
              className="h-3 animate-pulse rounded bg-soft"
              style={{ width: column === 0 ? "28%" : `${10 + ((row + column) % 3) * 4}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
