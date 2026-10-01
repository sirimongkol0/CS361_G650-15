"use client";

import { useEffect } from "react";
import { useUrlState } from "@/lib/url-state";

/* Shared helpers for the public list pages (stakeholders, documents, activities). */

/** Case-, width- and whitespace-insensitive form used for search matching. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").toLocaleLowerCase("th").replace(/\s+/g, " ").trim();
}

/** True when every word of the query appears in at least one field. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.map(normalizeText).join("\n");
  return words.every((word) => haystack.includes(word));
}

/** Keep the browser tab title in sync with the page. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const wanted = `${title} | CSTU PCSMS`;
    const apply = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    // Next.js writes the layout metadata title after hydration; put ours back.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}

/* ---------- Sorting (stored in the URL as ?sort=key or ?sort=-key) ---------- */

export type SortValue = string | number | null | undefined;

export function useSort(defaultSort = "") {
  const [sort, setSort] = useUrlState("sort", defaultSort);
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  const toggle = (next: string) => {
    if (key !== next) setSort(next);
    else if (!desc) setSort(`-${next}`);
    else setSort(defaultSort === next || defaultSort === `-${next}` ? next : "");
  };
  return { key, desc, toggle };
}

export function sortBy<T>(items: T[], key: string, desc: boolean, getters: Record<string, (item: T) => SortValue>): T[] {
  const get = getters[key];
  if (!get) return items;
  return [...items].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    // Missing values always go last, whatever the direction.
    if (x == null || x === "") return y == null || y === "" ? 0 : 1;
    if (y == null || y === "") return -1;
    const order = typeof x === "number" && typeof y === "number"
      ? x - y
      : String(x).localeCompare(String(y), "th");
    return desc ? -order : order;
  });
}

/* ---------- Paging (stored in the URL as ?page=N) ---------- */

export const PAGE_SIZE = 25;

/**
 * Current page of `total` rows. Goes back to page 1 when the visitor changes
 * any other URL-backed filter or sort (not when the URL is first read, so a
 * shared ?page= link still opens on that page).
 */
export function usePagination(total: number) {
  const [pageParam, setPageParam] = useUrlState("page", "1");
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pageCount);

  useEffect(() => {
    const onChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key && key !== "page") setPageParam("1");
    };
    window.addEventListener("pcsms:url-state", onChange);
    return () => window.removeEventListener("pcsms:url-state", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    page,
    pageCount,
    start: (page - 1) * PAGE_SIZE,
    end: Math.min(page * PAGE_SIZE, total),
    setPage: (next: number) => setPageParam(String(Math.min(Math.max(1, next), pageCount))),
  };
}

/* ---------- Result order for prev/next and "back to results" ---------- */

export type ResultKind = "stakeholders" | "documents" | "activities";

interface StoredResults {
  ids: number[];
  listUrl: string;
}

const resultsKey = (kind: ResultKind) => `pcsms:results:${kind}`;

export function useRememberResults(kind: ResultKind, ids: number[], enabled: boolean) {
  const joined = ids.join(",");
  useEffect(() => {
    if (!enabled) return;
    try {
      const value: StoredResults = { ids: joined ? joined.split(",").map(Number) : [], listUrl: window.location.pathname + window.location.search };
      sessionStorage.setItem(resultsKey(kind), JSON.stringify(value));
    } catch {}
  }, [kind, joined, enabled]);
}

export function readResults(kind: ResultKind): StoredResults | null {
  try {
    const raw = sessionStorage.getItem(resultsKey(kind));
    return raw ? (JSON.parse(raw) as StoredResults) : null;
  } catch {
    return null;
  }
}

/* ---------- CSV export ---------- */

export function downloadCsv(fileName: string, header: string[], rows: SortValue[][]) {
  const cell = (value: SortValue) => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  // BOM so Excel opens Thai text as UTF-8.
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Dates ---------- */

export const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** "เหลืออีก 45 วัน" / "สิ้นสุดเมื่อ 2 เดือนก่อน" for a day count relative to today. */
export function relativeDays(days: number, future: string, past: string): string {
  const abs = Math.abs(days);
  const span = abs === 0 ? "วันนี้"
    : abs < 30 ? `${abs} วัน`
    : abs < 365 ? `${Math.round(abs / 30)} เดือน`
    : `${Math.round(abs / 365)} ปี`;
  if (abs === 0) return span;
  return days > 0 ? `${future} ${span}` : `${past} ${span}ก่อน`;
}

export function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayIso().split("-").map(Number);
  return Math.round((target - Date.UTC(ty, tm - 1, td)) / 86400000);
}
