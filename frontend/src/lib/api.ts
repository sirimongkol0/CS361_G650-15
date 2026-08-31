"use client";

// API client for the backend REST API (base URL from env, path prefix /api/v1).
// NEXT_PUBLIC_API_URL       — server-side (SSR) base URL
// NEXT_PUBLIC_API_BROWSER_URL — browser-side base URL (falls back to the above)
//
// Every loader here maps the raw API payload into the view shapes the pages
// already consume (previously sourced from lib/mock.ts). On any failure —
// network error, 404 (some endpoints are still rolling out), non-OK status,
// empty/malformed payload — the loader falls back to the mock data so pages
// always render (same behaviour as before the API integration).

import { useEffect, useState } from "react";
import {
  publicActivities,
  publicPartners,
  activities as mockActivities,
  documents as mockDocuments,
  feedbackEntries as mockFeedback,
  exchangeStudents as mockExchange,
  adminProfile as mockAdminProfile,
  type PublicActivity,
  type PublicPartner,
  type MockActivity,
  type MockDocument,
  type FeedbackEntry,
  type ExchangeStudent,
  type AdminProfile,
} from "@/lib/mock";

// ---------- Base URL ----------

const SERVER_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const BROWSER_BASE = process.env.NEXT_PUBLIC_API_BROWSER_URL || SERVER_BASE;

function apiBase(): string {
  return typeof window === "undefined" ? SERVER_BASE : BROWSER_BASE;
}

// ---------- Fetch wrapper ----------

const API_TIMEOUT_MS = 5000;

/** GET a JSON list from the API; throws on any failure (caller decides fallback). */
async function apiGetList<T>(path: string): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API ${path} -> HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(`API ${path} -> unexpected payload`);
    return data as T[];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try the API and map the result; on any failure (including an empty list)
 * return the mock fallback instead. `build` runs inside the try so malformed
 * rows also trigger the fallback.
 */
async function safeLoad<T>(
  path: string,
  build: (raw: unknown[]) => T | Promise<T>,
  fallback: T
): Promise<T> {
  try {
    const raw = await apiGetList<unknown>(path);
    if (raw.length === 0) return fallback;
    return build(raw);
  } catch {
    return fallback;
  }
}

// ---------- Thai date formatting (e.g. ISO 2025-08-20 -> "20 ส.ค. 2568") ----------

const THAI_MONTHS_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** ISO date string -> "20 ส.ค. 2568" (Gregorian year + 543). Returns "—" if missing/invalid. */
export function formatThaiDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${THAI_MONTHS_ABBR[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** Period "ก.พ.–พ.ค. 2568"; same month collapses to "20–25 ส.ค. 2568". */
export function formatThaiPeriod(startIso?: string | null, endIso?: string | null): string {
  if (!startIso && !endIso) return "—";
  if (!endIso) return formatThaiDate(startIso);
  if (!startIso) return formatThaiDate(endIso);
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${startIso} – ${endIso}`;
  const sy = s.getFullYear() + 543;
  const ey = e.getFullYear() + 543;
  if (sy === ey && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${THAI_MONTHS_ABBR[s.getMonth()]} ${sy}`;
  }
  if (sy === ey) {
    return `${THAI_MONTHS_ABBR[s.getMonth()]}–${e.getDate()} ${THAI_MONTHS_ABBR[e.getMonth()]} ${ey}`;
  }
  return `${formatThaiDate(startIso)}–${formatThaiDate(endIso)}`;
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

// ---------- Raw API payload types (per backend contract) ----------

interface RawPartner {
  id: number;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  type?: string | null;
  country?: string | null;
  websiteUrl?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
}

interface RawActivity {
  id: number;
  name: string;
  date: string; // ISO
  description?: string | null;
  activity_type?: string | null;
  partner?: { id: number; name: string } | null;
}

interface RawDocument {
  id: number;
  name: string;
  docType?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  effectiveDate?: string | null; // ISO
  expiryDate?: string | null; // ISO
  partnerId?: number | null;
}

interface RawFeedback {
  id: number;
  title: string;
  source?: string | null;
  org?: string | null;
  partnerId?: number | null;
  activityId?: number | null;
  rating?: number | null;
  date?: string | null; // ISO
  status?: string | null;
  comment?: string | null;
}

interface RawExchange {
  id: number;
  name: string;
  type?: string | null; // "outbound" | "inbound"
  fromProgram?: string | null;
  fromPartnerId?: number | null;
  toProgram?: string | null;
  toPartnerId?: number | null;
  periodStart?: string | null; // ISO
  periodEnd?: string | null; // ISO
  program?: string | null;
  status?: string | null;
}

interface RawUser {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  role?: string | null;
}

// ---------- Mappers ----------

// Partner display palette (cycles by index) for avatar initials / colors.
const PARTNER_PALETTE = [
  { bg: "#F5D6DE", color: "#8B1538" },
  { bg: "#DBEAFE", color: "#1D4ED8" },
  { bg: "#DCFCE7", color: "#15803D" },
  { bg: "#FEF3C7", color: "#B45309" },
  { bg: "#EDE9FE", color: "#7C3AED" },
  { bg: "#FFE4E6", color: "#E11D48" },
];

const COUNTRY_LABELS: Record<string, string> = {
  thailand: "🇹🇭 ไทย",
  "ไทย": "🇹🇭 ไทย",
  taiwan: "🇹🇼 ไต้หวัน",
  "ไต้หวัน": "🇹🇼 ไต้หวัน",
  malaysia: "🇲🇾 มาเลเซีย",
  "มาเลเซีย": "🇲🇾 มาเลเซีย",
  japan: "🇯🇵 ญี่ปุ่น",
  "ญี่ปุ่น": "🇯🇵 ญี่ปุ่น",
};

function partnerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /^[\x00-\x7F]/.test(name)) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2);
}

function mapPartner(raw: RawPartner, index: number): PublicPartner {
  const palette = PARTNER_PALETTE[index % PARTNER_PALETTE.length];
  const country = raw.country ? COUNTRY_LABELS[raw.country] ?? raw.country : "—";
  return {
    name: raw.name,
    type: raw.type ?? "—",
    country,
    initials: partnerInitials(raw.name),
    bg: palette.bg,
    color: palette.color,
  };
}

/** Derive a display status for an activity from its date (API has no status field). */
function deriveActivityStatus(dateIso?: string | null): { status: string; statusColor: string } {
  const t = dateIso ? new Date(dateIso).getTime() : NaN;
  if (isNaN(t)) return { status: "กำลังดำเนินการ", statusColor: "badge-blue" };
  const diff = t - Date.now();
  if (diff < 0) return { status: "เสร็จสิ้น", statusColor: "badge-green" };
  if (diff < 14 * 86400000) return { status: "กำลังดำเนินการ", statusColor: "badge-blue" };
  return { status: "วางแผน", statusColor: "badge-purple" };
}

function mapActivity(raw: RawActivity): MockActivity {
  const { status, statusColor } = deriveActivityStatus(raw.date);
  return {
    id: raw.id,
    name: raw.name,
    org: raw.partner?.name ?? "—",
    type: raw.activity_type || "กิจกรรมวิชาการ",
    date: formatThaiDate(raw.date),
    // API contract has no participant count — display 0 until the field exists.
    participants: 0,
    mou: "",
    status,
    statusColor,
  };
}

function mapDocument(raw: RawDocument, partnerName?: string | null): MockDocument {
  const left = daysUntil(raw.expiryDate);
  const daysLeft = left ?? 0;
  const status: MockDocument["status"] =
    left === null ? "active" : left < 0 ? "expired" : left <= 30 ? "expiring" : "active";
  const docType = (raw.docType ?? "").toUpperCase();
  return {
    id: raw.id,
    title: raw.name,
    org: partnerName ?? "—",
    type: docType.includes("MOA") ? "MoA" : "MoU",
    start: formatThaiDate(raw.effectiveDate),
    expire: formatThaiDate(raw.expiryDate),
    responsible: "—",
    status,
    daysLeft,
  };
}

function mapFeedback(raw: RawFeedback, activityNames: Map<number, string>): FeedbackEntry {
  return {
    id: raw.id,
    title: raw.title,
    source: raw.source ?? "—",
    org: raw.org ?? "—",
    activity: (raw.activityId != null && activityNames.get(raw.activityId)) || "—",
    rating: raw.rating ?? 0,
    date: formatThaiDate(raw.date),
    status: raw.status ?? "—",
    comment: raw.comment ?? "",
  };
}

function mapExchange(raw: RawExchange, partnerNames: Map<number, string>): ExchangeStudent {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type === "inbound" ? "inbound" : "outbound",
    from: raw.fromProgram ?? "—",
    to: raw.toProgram ?? (raw.toPartnerId != null ? partnerNames.get(raw.toPartnerId) ?? "—" : "—"),
    period: formatThaiPeriod(raw.periodStart, raw.periodEnd),
    program: raw.program ?? "—",
    status: raw.status ?? "—",
  };
}

function mapAdminProfile(raw: RawUser): AdminProfile {
  return {
    firstName: raw.firstName ?? "",
    lastName: raw.lastName ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    position: raw.position ?? "",
    department: raw.department ?? "",
  };
}

// ---------- Loaders (API first, mock.ts as fallback) ----------

/** GET /partners/ -> public partner list (published partners only, per API). */
export function loadPublicPartners(): Promise<PublicPartner[]> {
  return safeLoad<PublicPartner[]>(
    "/partners/",
    (raw) => (raw as RawPartner[]).map(mapPartner),
    publicPartners
  );
}

/** GET /activities/ -> activities list mapped to the MockActivity view shape. */
export function loadActivities(): Promise<MockActivity[]> {
  return safeLoad<MockActivity[]>(
    "/activities/",
    (raw) => (raw as RawActivity[]).map(mapActivity),
    mockActivities
  );
}

/** GET /activities/ -> public activity cards for the public dashboard. */
export function loadPublicActivities(): Promise<PublicActivity[]> {
  return safeLoad<PublicActivity[]>(
    "/activities/",
    (raw) =>
      (raw as RawActivity[]).map((a) => {
        const t = new Date(a.date).getTime();
        return {
          name: a.name,
          org: a.partner?.name ?? "—",
          date: formatThaiDate(a.date),
          open: !isNaN(t) && t >= Date.now(),
        };
      }),
    publicActivities
  );
}

/** GET /documents/ (+ /partners/ join for org names) -> documents list. */
export function loadDocuments(): Promise<MockDocument[]> {
  return safeLoad<MockDocument[]>(
    "/documents/",
    async (raw) => {
      let partnerNames = new Map<number, string>();
      try {
        const partners = await apiGetList<RawPartner>("/partners/");
        partnerNames = new Map(partners.map((p) => [p.id, p.name]));
      } catch {
        // Partner join is optional — org shows "—" without it.
      }
      return (raw as RawDocument[]).map((d) =>
        mapDocument(d, d.partnerId != null ? partnerNames.get(d.partnerId) : undefined)
      );
    },
    mockDocuments
  );
}

/** GET /feedback/ (+ /activities/ join for activity names) -> feedback entries. */
export function loadFeedbackEntries(): Promise<FeedbackEntry[]> {
  return safeLoad<FeedbackEntry[]>(
    "/feedback/",
    async (raw) => {
      let activityNames = new Map<number, string>();
      try {
        const acts = await apiGetList<RawActivity>("/activities/");
        activityNames = new Map(acts.map((a) => [a.id, a.name]));
      } catch {
        // Activity join is optional — activity shows "—" without it.
      }
      return (raw as RawFeedback[]).map((f) => mapFeedback(f, activityNames));
    },
    mockFeedback
  );
}

/** GET /exchange/ (+ /partners/ join for destination names) -> exchange students. */
export function loadExchangeStudents(): Promise<ExchangeStudent[]> {
  return safeLoad<ExchangeStudent[]>(
    "/exchange/",
    async (raw) => {
      let partnerNames = new Map<number, string>();
      try {
        const partners = await apiGetList<RawPartner>("/partners/");
        partnerNames = new Map(partners.map((p) => [p.id, p.name]));
      } catch {
        // Partner join is optional.
      }
      return (raw as RawExchange[]).map((e) => mapExchange(e, partnerNames));
    },
    mockExchange
  );
}

/** GET /users/ -> admin profile (prefers role=admin, else the first user). */
export function loadAdminProfile(): Promise<AdminProfile> {
  return safeLoad<AdminProfile>(
    "/users/",
    (raw) => {
      const users = raw as RawUser[];
      const admin = users.find((u) => (u.role ?? "").toLowerCase() === "admin") ?? users[0];
      return mapAdminProfile(admin);
    },
    mockAdminProfile
  );
}

// ---------- Hook for pages ----------

/**
 * Load data via the API with the mock fallback: `fallback` is used for the
 * initial render (so an offline API renders exactly like before) and stays if
 * the loader falls back.
 */
export function useApiData<T>(loader: () => Promise<T>, fallback: T): T {
  const [data, setData] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    loader()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        // Loader already falls back internally; this is a safety net.
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}
