"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/* In-page PDF preview, fetched from the same public download endpoint on demand. */
export function DocumentPreview({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || url) return;
    let alive = true;
    let created: string | null = null;
    const base = (process.env.NEXT_PUBLIC_API_BROWSER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
    fetch(`${base}/documents/${id}/download`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        created = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        if (alive) setUrl(created);
      })
      .catch(() => alive && setError("ไม่สามารถแสดงตัวอย่างเอกสารได้"));
    return () => {
      alive = false;
    };
  }, [open, url, id]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <section className="bg-white rounded-base shadow-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-ink">ตัวอย่างเอกสาร</h2>
        <button type="button" className="btn btn-outline gap-2 text-sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {open ? "ซ่อนตัวอย่าง" : "แสดงตัวอย่าง"}
        </button>
      </div>
      {open && (
        <div className="mt-4">
          {error ? <p role="alert" className="text-sm text-crimson">{error}</p>
            : url ? <iframe src={url} title="ตัวอย่างเอกสาร PDF" className="h-[70vh] w-full rounded-lg border border-line" />
            : <div className="h-[70vh] w-full animate-pulse rounded-lg bg-soft" role="status" aria-label="กำลังโหลดตัวอย่าง" />}
        </div>
      )}
    </section>
  );
}
