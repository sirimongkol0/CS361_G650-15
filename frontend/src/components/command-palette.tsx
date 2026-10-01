"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, FileText, LoaderCircle, Search } from "lucide-react";
import { loadActivities, loadDocuments, loadPublicPartners } from "@/lib/api";
import { matchesQuery } from "@/lib/list-tools";
import { Highlight } from "@/components/list-ui";

interface Entry {
  kind: "stakeholders" | "documents" | "activities";
  id: number;
  title: string;
  subtitle: string;
}

const KIND_META = {
  stakeholders: { label: "หน่วยงาน", Icon: Building2 },
  documents: { label: "เอกสาร", Icon: FileText },
  activities: { label: "กิจกรรม", Icon: CalendarDays },
} as const;

const MAX_RESULTS = 12;

/* Ctrl+K / ⌘K search across published partners, documents and activities. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    if (entries && !failed) return;
    // Loaders share the session cache, so this is usually instant.
    Promise.allSettled([loadPublicPartners(), loadDocuments(), loadActivities()]).then(([partners, documents, activities]) => {
      setFailed([partners, documents, activities].every((result) => result.status === "rejected"));
      setEntries([
        ...(partners.status === "fulfilled" ? partners.value.map((item): Entry => ({ kind: "stakeholders", id: item.id, title: item.name, subtitle: item.country ?? "" })) : []),
        ...(documents.status === "fulfilled" ? documents.value.map((item): Entry => ({ kind: "documents", id: item.id, title: item.title, subtitle: item.org ?? "" })) : []),
        ...(activities.status === "fulfilled" ? activities.value.map((item): Entry => ({ kind: "activities", id: item.id, title: item.name, subtitle: `${item.org} • ${item.date}` })) : []),
      ]);
    });
    // Only (re)load when the palette opens; a failed load retries on the next open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const results = useMemo(
    () => (entries && query.trim() ? entries.filter((entry) => matchesQuery(query, entry.title, entry.subtitle)).slice(0, MAX_RESULTS) : []),
    [entries, query]
  );

  if (!open) return null;

  const go = (entry: Entry) => {
    onClose();
    router.push(`/${entry.kind}/${entry.id}`);
  };

  return (
    <div className="fixed inset-0 z-[70] animate-fade-in flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ค้นหาทั้งระบบ"
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="w-4 h-4 text-faint" />
          <input
            ref={inputRef}
            className="flex-1 py-3.5 text-sm text-ink outline-none placeholder:text-[#CBD5E1]"
            placeholder="ค้นหาหน่วยงาน เอกสาร หรือกิจกรรม..."
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              else if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
              else if (event.key === "Enter" && results[active]) go(results[active]);
            }}
            aria-activedescendant={results[active] ? `palette-${active}` : undefined}
          />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-faint">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {!entries && <div className="flex items-center gap-2 px-3 py-6 text-sm text-faint"><LoaderCircle className="w-4 h-4 animate-spin" />กำลังโหลดข้อมูล</div>}
          {entries && failed && <p className="px-3 py-6 text-sm text-faint">ไม่สามารถโหลดข้อมูลได้ โปรดลองอีกครั้ง</p>}
          {entries && !failed && !query.trim() && <p className="px-3 py-6 text-sm text-faint">พิมพ์เพื่อค้นหาจาก {entries.length} รายการ</p>}
          {entries && query.trim() && results.length === 0 && <p className="px-3 py-6 text-sm text-faint">ไม่พบผลลัพธ์</p>}
          {results.map((entry, index) => {
            const { label, Icon } = KIND_META[entry.kind];
            return (
              <button
                key={`${entry.kind}-${entry.id}`}
                id={`palette-${index}`}
                type="button"
                role="option"
                aria-selected={index === active}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${index === active ? "bg-[#FDF2F5]" : "hover:bg-soft"}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(entry)}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-crimson" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink"><Highlight text={entry.title} query={query} /></span>
                  {entry.subtitle && <span className="block truncate text-xs text-faint">{entry.subtitle}</span>}
                </span>
                <span className="badge badge-gray">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Ctrl + K", "ค้นหาทั้งระบบ"],
  ["/", "ไปที่ช่องค้นหาของหน้ารายการ"],
  ["Esc", "ล้างคำค้นหา / ปิดหน้าต่าง"],
  ["← / →", "รายการก่อนหน้า / ถัดไป (หน้ารายละเอียด)"],
  ["?", "แสดงคีย์ลัดทั้งหมด"],
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] animate-fade-in flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="คีย์ลัด" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="mb-4 font-bold text-ink">คีย์ลัด</h2>
        <dl className="space-y-2.5 text-sm">
          {SHORTCUTS.map(([keys, text]) => (
            <div key={keys} className="flex items-center justify-between gap-4">
              <dt className="text-mute">{text}</dt>
              <dd><kbd className="rounded border border-line bg-paper px-2 py-0.5 text-xs text-ink whitespace-nowrap">{keys}</kbd></dd>
            </div>
          ))}
        </dl>
        <button type="button" className="btn btn-outline mt-5 w-full" onClick={onClose}>ปิด</button>
      </div>
    </div>
  );
}
