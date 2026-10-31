import { apiBase } from "@/lib/api";
import { readToken } from "@/lib/session";

export async function downloadFile(path: string): Promise<void> {
  const token = readToken();

  const response = await fetch(`${apiBase()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;

    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // ใช้ข้อความ HTTP หาก Response ไม่ใช่ JSON
    }

    throw new Error(detail);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";

  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];

  let filename = plainName || "download.csv";

  if (encodedName) {
    try {
      filename = decodeURIComponent(encodedName);
    } catch {
      filename = plainName || "download.csv";
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}