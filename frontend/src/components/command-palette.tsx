"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, FileText, LoaderCircle, Search } from "lucide-react";
import { loadActivities, loadDocuments, loadPublicPartners } from "@/lib/api";
import { matchesQuery } from "@/lib/list-tools";
import { Highlight } from "@/components/list-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Entry {
  kind: "stakeholders" | "documents" | "activities";
  id: number;
  title: string;
  subtitle: string;
}

const KIND_META = {
  stakeholders: { label: "หน่วยงาน", Icon: Building2 },
  documents: { label: "ข้อตกลง", Icon: FileText },
  activities: { label: "กิจกรรม", Icon: CalendarDays },
} as const;

const MAX_RESULTS = 12;

/* Ctrl+K / ⌘K search across published partners, documents and activities.
   The Radix dialog traps focus, closes on Esc and returns focus to the opener; the input
   is an APG combobox (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) whose arrow keys
   move aria-activedescendant through the result listbox, so focus stays in the input. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
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

  const go = (entry: Entry) => {
    onClose();
    router.push(`/${entry.kind}/${entry.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent showCloseButton={false} className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>ค้นหาทั้งระบบ</DialogTitle>
          <DialogDescription>ค้นหาหน่วยงาน ข้อตกลง หรือกิจกรรมที่เผยแพร่แล้ว ใช้ลูกศรขึ้นลงเพื่อเลือก แล้วกด Enter</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="w-4 h-4 text-faint" />
          <input
            className="flex-1 py-3.5 text-sm text-ink outline-hidden placeholder:text-faint"
            placeholder="ค้นหาหน่วยงาน ข้อตกลง หรือกิจกรรม"
            aria-label="ค้นหาทั้งระบบ"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="palette-results"
            aria-expanded={results.length > 0}
            aria-activedescendant={results[active] ? `palette-${active}` : undefined}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
              else if (event.key === "Enter" && results[active]) go(results[active]);
            }}
          />
          <kbd className="rounded-sm border border-line px-1.5 text-[11px] text-faint">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!entries && <div className="flex items-center gap-2 px-3 py-6 text-sm text-faint"><LoaderCircle className="w-4 h-4 animate-spin" />กำลังโหลด…</div>}
          {entries && failed && <p className="px-3 py-6 text-sm text-faint">โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
          {entries && !failed && !query.trim() && <p className="px-3 py-6 text-sm text-faint">พิมพ์เพื่อค้นหาจาก {entries.length} รายการ</p>}
          {entries && query.trim() && results.length === 0 && <p className="px-3 py-6 text-sm text-faint" role="status">ไม่พบผลลัพธ์</p>}
          <div id="palette-results" role="listbox" aria-label="ผลการค้นหา">
            {results.map((entry, index) => {
              const { label, Icon } = KIND_META[entry.kind];
              return (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  id={`palette-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left ${index === active ? "bg-crimson-light" : "hover:bg-soft"}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(entry)}
                >
                  <Icon className="w-4 h-4 shrink-0 text-crimson" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink"><Highlight text={entry.title} query={query} /></span>
                    {entry.subtitle && <span className="block truncate text-xs text-faint">{entry.subtitle}</span>}
                  </span>
                  <Badge variant="gray">{label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Ctrl + K", "ค้นหาทั้งระบบ"],
  ["Ctrl + B", "แสดงหรือซ่อนเมนูด้านข้าง"],
  ["/", "ไปที่ช่องค้นหาของหน้ารายการ"],
  ["Esc", "ล้างคำค้นหาหรือปิดหน้าต่าง"],
  ["← / →", "ไปรายการก่อนหน้าหรือถัดไป ในหน้ารายละเอียด"],
  ["?", "แสดงคีย์ลัดทั้งหมด"],
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-bold text-ink">คีย์ลัด</DialogTitle>
          <DialogDescription className="sr-only">คีย์ลัดที่ใช้ได้ในทุกหน้า</DialogDescription>
        </DialogHeader>
        <dl className="space-y-2.5 text-sm">
          {SHORTCUTS.map(([keys, text]) => (
            <div key={keys} className="flex items-center justify-between gap-4">
              <dt className="text-mute">{text}</dt>
              <dd><kbd className="rounded-sm border border-line bg-paper px-2 py-0.5 text-xs text-ink whitespace-nowrap">{keys}</kbd></dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={onClose}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
