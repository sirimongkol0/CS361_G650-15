"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function DocumentDownload({ id, fileName, className = "btn btn-outline gap-2" }: {
  id: number; fileName: string | null; className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    setBusy(true); setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const base = (process.env.NEXT_PUBLIC_API_BROWSER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
      const response = await fetch(`${base}/documents/${id}/download`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) {
        setError(response.status === 404 ? "ไม่พบไฟล์เอกสารที่พร้อมดาวน์โหลด" : "ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = fileName || `document-${id}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("ดาวน์โหลดไม่สำเร็จ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    } finally { clearTimeout(timer); setBusy(false); }
  }
  return <div>
    <button type="button" disabled={busy} onClick={download} className={className} aria-label={`ดาวน์โหลดเอกสาร ${id}`}>
      <Download className="w-4 h-4" />{busy ? "กำลังดาวน์โหลด" : error ? "ลองดาวน์โหลดอีกครั้ง" : "ดาวน์โหลด"}
    </button>
    {error && <p role="alert" className="text-xs text-crimson mt-2">{error}</p>}
  </div>;
}
