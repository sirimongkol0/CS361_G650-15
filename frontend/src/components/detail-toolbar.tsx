"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { CopyLinkButton } from "@/components/list-ui";
import { readResults, type ResultKind } from "@/lib/list-tools";

const LIST_LABELS: Record<ResultKind, string> = {
  stakeholders: "หน่วยงาน",
  documents: "เอกสาร",
  activities: "กิจกรรม",
};

/*
 * Toolbar for detail pages: back to the filtered list the visitor came from,
 * previous/next within those results (also ← / → keys), copy link, share.
 */
export function DetailToolbar({ kind, id, title }: { kind: ResultKind; id: number; title: string }) {
  const router = useRouter();
  const [nav, setNav] = useState<{ listUrl: string; prev: number | null; next: number | null; position: number; total: number } | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    const results = readResults(kind);
    const index = results ? results.ids.indexOf(id) : -1;
    setNav(results && index >= 0
      ? {
          listUrl: results.listUrl,
          prev: index > 0 ? results.ids[index - 1] : null,
          next: index < results.ids.length - 1 ? results.ids[index + 1] : null,
          position: index + 1,
          total: results.ids.length,
        }
      : results ? { listUrl: results.listUrl, prev: null, next: null, position: 0, total: 0 } : null);
  }, [kind, id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.key === "ArrowLeft" && nav?.prev) router.push(`/${kind}/${nav.prev}`);
      if (event.key === "ArrowRight" && nav?.next) router.push(`/${kind}/${nav.next}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, kind, router]);

  const stepCls = "btn btn-outline p-2 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <Link href={nav?.listUrl ?? `/${kind}`} className="btn btn-outline gap-2 text-sm">
        <ArrowLeft className="w-4 h-4" />
        {nav ? "กลับไปยังผลลัพธ์" : `รายการ${LIST_LABELS[kind]}ทั้งหมด`}
      </Link>
      {nav && nav.total > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={stepCls} disabled={!nav.prev} onClick={() => nav.prev && router.push(`/${kind}/${nav.prev}`)} aria-label="รายการก่อนหน้า" title="รายการก่อนหน้า (←)">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-1 text-xs text-faint">{nav.position} / {nav.total}</span>
          <button type="button" className={stepCls} disabled={!nav.next} onClick={() => nav.next && router.push(`/${kind}/${nav.next}`)} aria-label="รายการถัดไป" title="รายการถัดไป (→)">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex-1" />
      <CopyLinkButton />
      {canShare && (
        <button type="button" className="btn btn-outline gap-2 text-sm" onClick={() => navigator.share({ title, url: window.location.href }).catch(() => {})}>
          <Share2 className="w-4 h-4" />แชร์
        </button>
      )}
    </div>
  );
}
