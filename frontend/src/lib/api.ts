"use client";

// API client for the backend REST API (base URL from env, path prefix /api/v1).
// NEXT_PUBLIC_API_URL       — server-side (SSR) base URL
// NEXT_PUBLIC_API_BROWSER_URL — browser-side base URL (falls back to the above)
//
// Public loaders are strict: failures and empty results are surfaced to the UI.
// Internal-page loaders return an empty result when the API is unavailable,
// but never hide 401/403: the page must say "log in" / "no permission".
//
// Every request carries the signed-in user's token (V3); the backend decides
// what each role may see or change.

import { type DependencyList, useEffect, useState } from "react";
import { activityDateLabel, activityStatusLabel, latestActivities } from "@/lib/activity-display";
import { feedbackSourceLabels, label, parseScopeLevel, type ScopeLevel } from "@/lib/labels";
import { notifyUnauthorized, readToken } from "@/lib/session";

// ---------- Base URL ----------

const SERVER_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const BROWSER_BASE = process.env.NEXT_PUBLIC_API_BROWSER_URL || SERVER_BASE;

export function apiBase(): string {
  return typeof window === "undefined" ? SERVER_BASE : BROWSER_BASE;
}

// ---------- Fetch wrapper ----------

const API_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thai message for an API error, for forms and notices. */
export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง";
  switch (error.status) {
    case 401: return "กรุณาเข้าสู่ระบบอีกครั้ง";
    case 403: return "ไม่มีสิทธิ์ทำรายการนี้";
    case 404: return "ไม่พบรายการนี้";
    case 409: return "ทำรายการนี้ไม่ได้ในสถานะปัจจุบันของรายการ";
    case 413: return "ไฟล์ใหญ่เกินกำหนด";
    case 415: return "เลือกได้เฉพาะไฟล์ PDF";
    case 400:
    case 422: return `ข้อมูลไม่ถูกต้อง: ${error.message}`;
    case undefined: return "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง";
    default: return "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง";
  }
}

function authHeaders(): Record<string, string> {
  const token = typeof window === "undefined" ? null : readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** A 401 while signed in means the token expired or was revoked. */
function checkUnauthorized(status: number) {
  if (status === 401 && typeof window !== "undefined" && readToken()) notifyUnauthorized();
}

/** FastAPI error body -> readable text (`detail` is a string or a list of field errors). */
async function errorDetail(res: Response): Promise<string> {
  try {
    const detail = (await res.json()).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => [d?.loc?.slice(1).join("."), d?.msg].filter(Boolean).join(": ")).join("; ");
    }
  } catch {}
  return `HTTP ${res.status}`;
}

/*
 * Session cache: identical GETs within CACHE_TTL_MS share one request, so moving
 * between pages does not refetch every list. Failed requests are not cached.
 * A network failure (not an HTTP error) is retried once automatically.
 * Entries are kept per token, and the cache is cleared on login, logout and
 * after every write, so one user never sees another's (or stale) data.
 */
const CACHE_TTL_MS = 60_000;
const responseCache = new Map<string, { at: number; promise: Promise<unknown> }>();
let lastFetchedAt: Date | null = null;

/** Time of the latest successful API response in this session. */
export const getLastFetchedAt = () => lastFetchedAt;

/** Drop cached responses, e.g. before a user-triggered retry. */
export function clearApiCache() {
  responseCache.clear();
}

function apiGet<T>(path: string): Promise<T> {
  if (typeof window === "undefined") return apiGetWithRetry<T>(path);
  const key = `${readToken() ?? ""} ${path}`;
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise as Promise<T>;
  const promise = apiGetWithRetry<T>(path);
  responseCache.set(key, { at: Date.now(), promise });
  promise.then(
    () => { lastFetchedAt = new Date(); },
    () => { if (responseCache.get(key)?.promise === promise) responseCache.delete(key); }
  );
  return promise;
}

async function apiGetWithRetry<T>(path: string): Promise<T> {
  try {
    return await apiGetOnce<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status !== undefined) throw error;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return apiGetOnce<T>(path);
  }
}

async function apiGetOnce<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", ...authHeaders() },
      cache: "no-store",
    });
    if (!res.ok) {
      checkUnauthorized(res.status);
      throw new ApiError(`API ${path} -> HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("API request timed out");
    }
    throw new ApiError("Unable to connect to the API");
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Writes (V3) ----------

const WRITE_TIMEOUT_MS = 30_000; // uploads can take a while

async function apiSend<T>(method: string, path: string, body?: BodyInit, contentType?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      body,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...authHeaders(),
      },
    });
    if (!res.ok) {
      checkUnauthorized(res.status);
      throw new ApiError(await errorDetail(res), res.status);
    }
    clearApiCache(); // lists must show the change on the next read
    return (res.status === 204 ? undefined : await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("API request timed out");
    }
    throw new ApiError("Unable to connect to the API");
  } finally {
    clearTimeout(timer);
  }
}

const json = (body: unknown) => JSON.stringify(body ?? {});

export const apiPost = <T>(path: string, body?: unknown) => apiSend<T>("POST", path, json(body), "application/json");
export const apiPut = <T>(path: string, body?: unknown) => apiSend<T>("PUT", path, json(body), "application/json");
export const apiPatch = <T>(path: string, body?: unknown) => apiSend<T>("PATCH", path, json(body), "application/json");
export const apiDelete = (path: string) => apiSend<void>("DELETE", path);

/** GET that never uses the cache, e.g. a short-lived download link. */
export const apiGetFresh = <T>(path: string) => apiGetWithRetry<T>(path);

/** Upload one file as multipart form data (the browser sets the boundary header). */
export function apiUpload<T>(path: string, file: File, field = "file", method = "PUT"): Promise<T> {
  const form = new FormData();
  form.append(field, file);
  return apiSend<T>(method, path, form);
}
/** GET a JSON list from the API; throws on any failure (caller decides fallback). */
export async function apiGetList<T>(path: string): Promise<T[]> {
  const data = await apiGet<unknown>(path);
  if (!Array.isArray(data)) throw new ApiError(`API ${path} -> unexpected payload`);
  return data as T[];
}

const isAuthError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

/**
 * Try the API and map the result; on any failure (including an empty list)
 * return `fallback` (an empty value, never sample data). `build` runs inside
 * the try so malformed rows also trigger the fallback. 401/403 are rethrown so
 * the page can say "log in" / "no permission" instead of showing nothing.
 */
async function safeLoad<T>(
  path: string,
  build: (raw: unknown[]) => T | Promise<T>,
  fallback: T
): Promise<T> {
  try {
    const raw = await apiGetList<unknown>(path);
    if (raw.length === 0) return fallback;
    return await build(raw);
  } catch (error) {
    if (isAuthError(error)) throw error;
    return fallback;
  }
}

// ---------- Thai date formatting (e.g. ISO 2025-08-20 -> "20 ส.ค. 2568") ----------

export const THAI_MONTHS_ABBR = [
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
  countryCode?: string | null;
  websiteUrl?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  scopeLevel?: string | null;
  sources?: RawSource[] | null;
}

interface RawSource {
  sourceUrl?: string;
  sourceTitle?: string | null;
  sourcePublisher?: string | null;
  sourceType?: string | null;
  sourceCheckedAt?: string | null;
  sourceLocator?: string | null;
  // Accept the earlier API draft while the backend contract rolls out.
  url?: string;
  title?: string | null;
  label?: string | null;
  publisher?: string | null;
}

interface RawActivity {
  sources?: RawSource[] | null;
  id: number;
  name: string;
  date: string | null; // ISO calendar date, when known
  dateKind?: string | null;
  datePrecision?: string | null;
  description?: string | null;
  activity_type?: string | null;
  endDate?: string | null;
  participants?: number | null;
  location?: string | null;
  time?: string | null;
  status?: string | null;
  isOpen?: boolean | null;
  mouDocId?: number | null;
  scopeLevel?: string | null;
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
  partner?: { id: number; name: string } | null;
  documentKind?: string | null;
  fileAvailability?: string | null;
  sources?: RawSource[] | null;
  responsible?: string | null;
  status?: string | null;
  signerOur?: string | null;
  signerPartner?: string | null;
  scopeLevel?: string | null;
  scopeItems?: Array<{ id?: number; text: string; position?: number | null }> | null;
  fileName?: string | null;
  uploadedAt?: string | null;
}

interface RawFeedback {
  id: number;
  title: string;
  source?: string | null;
  partnerId?: number | null;
  activityId?: number | null;
  documentId?: number | null;
  exchangeId?: number | null;
  respondentTypeId?: number | null;
  feedbackSourceId?: number | null;
  respondentTypeName?: string | null;
  rating?: number | null;
  date?: string | null; // ISO
  status?: string | null;
  comment?: string | null;
  // Signed-in view only (GET /feedback/manage).
  isPublished?: boolean;
  reply?: string | null;
  repliedAt?: string | null;
}

export interface RawExchange {
  id: number;
  name: string;
  type?: string | null; // "outbound" | "inbound"
  fromProgram?: string | null;
  toOrganization?: string | null;
  startDate?: string | null; // ISO
  endDate?: string | null; // ISO
  program?: string | null;
  status?: string | null;
  partnerId?: number | null;
  activityId?: number | null;
  // Signed-in view only (GET /exchange/mine).
  isPublished?: boolean;
  ownerUserId?: number | null;
  userId?: number | null;
}

/** GET /users/ row (admin only): an account that has signed in at least once. */
export interface UserAccount {
  id: number;
  email: string;
  role: "public" | "student" | "coordinator" | "staff" | "admin";
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

// ---------- View types for internal pages ----------

export interface FeedbackEntry {
  id: number;
  title: string;
  source: string;
  sourceCode: string;
  respondentTypeId: number | null;
  respondentTypeName: string;
  feedbackSourceId: number | null;
  org: string;
  activity: string;
  partnerId: number | null;
  activityId: number | null;
  documentId: number | null;
  exchangeId: number | null;
  rating: number;
  date: string;
  /** ISO date, for aggregation. */
  dateIso: string | null;
  status: string;
  comment: string;
  /** Signed-in view only; the public list has published entries without replies. */
  isPublished: boolean;
  reply: string | null;
  repliedAt: string | null;
}

export interface ExchangeStudent {
  id: number;
  name: string;
  type: "outbound" | "inbound";
  from: string;
  to: string;
  period: string;
  program: string;
  status: string;
  /** API fields, for the edit form and ownership checks. */
  raw: RawExchange;
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

const COUNTRY_CODE_LABELS: Record<string, string> = {
  TH: "🇹🇭 ไทย", TW: "🇹🇼 ไต้หวัน", MY: "🇲🇾 มาเลเซีย", JP: "🇯🇵 ญี่ปุ่น",
  US: "🇺🇸 สหรัฐอเมริกา", GB: "🇬🇧 สหราชอาณาจักร", KR: "🇰🇷 เกาหลีใต้",
  VN: "🇻🇳 เวียดนาม", IN: "🇮🇳 อินเดีย", AU: "🇦🇺 ออสเตรเลีย", OM: "🇴🇲 โอมาน",
  CN: "🇨🇳 จีน", ID: "🇮🇩 อินโดนีเซีย", IS: "🇮🇸 ไอซ์แลนด์",
  SG: "🇸🇬 สิงคโปร์", CH: "🇨🇭 สวิตเซอร์แลนด์", AT: "🇦🇹 ออสเตรีย", NO: "🇳🇴 นอร์เวย์",
  NL: "🇳🇱 เนเธอร์แลนด์", ZA: "🇿🇦 แอฟริกาใต้", HK: "🇭🇰 ฮ่องกง", MX: "🇲🇽 เม็กซิโก",
  DE: "🇩🇪 เยอรมนี", FR: "🇫🇷 ฝรั่งเศส", IT: "🇮🇹 อิตาลี", ES: "🇪🇸 สเปน", SE: "🇸🇪 สวีเดน",
  FI: "🇫🇮 ฟินแลนด์", DK: "🇩🇰 เดนมาร์ก", BE: "🇧🇪 เบลเยียม", IE: "🇮🇪 ไอร์แลนด์", CA: "🇨🇦 แคนาดา",
  NZ: "🇳🇿 นิวซีแลนด์", PH: "🇵🇭 ฟิลิปปินส์", LA: "🇱🇦 ลาว", KH: "🇰🇭 กัมพูชา", MM: "🇲🇲 เมียนมา",
  BN: "🇧🇳 บรูไน", TR: "🇹🇷 ตุรกี", AE: "🇦🇪 สหรัฐอาหรับเอมิเรตส์", BR: "🇧🇷 บราซิล",
};

// Generic Thai organisation prefixes; initials skip them so "มหาวิทยาลัย…" names don't all read "มห".
const THAI_ORG_PREFIXES = ["คุณ", "ดร.", "มหาวิทยาลัย", "วิทยาลัย", "สถาบัน", "ธนาคาร", "บริษัท", "การ", "กลุ่ม", "เมือง", "โครงการ", "กรม"];

function partnerInitials(name: string): string {
  const abbreviation = name.match(/\(([A-Z]{2,4})\)/);
  if (abbreviation) return abbreviation[1];
  if (/[\u0E00-\u0E7F]/.test(name)) {
    // Demo names embed "ตัวอย่าง" (sample); skip it so initials still tell partners apart.
    let rest = name.replace(/ตัวอย่าง/g, "").trim();
    const prefix = THAI_ORG_PREFIXES.find((p) => rest.startsWith(p) && rest.length > p.length);
    if (prefix) rest = rest.slice(prefix.length).trim();
    if (/^[A-Za-z]/.test(rest)) return rest.split(/\s+/)[0].slice(0, 3).toUpperCase();
    // First Thai consonant (skip leading vowels such as เ แ โ ใ ไ).
    return rest.match(/[\u0E01-\u0E2E]/)?.[0] ?? rest.slice(0, 1);
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /^[\x00-\x7F]/.test(name)) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2);
}

export interface SourceView {
  url: string;
  title: string;
  publisher: string | null;
  sourceType: string | null;
  checkedAt: string | null;
  locator: string | null;
}

export interface PartnerView {
  id: number;
  name: string;
  type: string | null;
  country: string | null;
  countryCode: string | null;
  initials: string;
  logoUrl: string | null;
  bg: string;
  color: string;
  description: string;
  websiteUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  scopeLevel: ScopeLevel | null;
  sources: SourceView[];
}

export interface ActivityView {
  sources: SourceView[];
  id: number;
  name: string;
  org: string;
  type: string;
  date: string;
  /** 0 when the record has no participant count. */
  participants: number;
  /** Label of the linked agreement, or "—". */
  mou: string;
  mouDocId?: number;
  status: string;
  statusColor: string;
  description: string;
  location: string | null;
  time: string | null;
  startDate: string | null;
  endDate: string | null;
  dateKind?: string | null;
  datePrecision?: string | null;
  partnerId: number | null;
  isOpen: boolean | null;
  scopeLevel: ScopeLevel | null;
}

/** Thai country name with flag, from the ISO code or the stored English/Thai name. */
export function countryLabel(countryCode?: string | null, country?: string | null): string | null {
  const code = countryCode?.toUpperCase() ?? null;
  return (code && COUNTRY_CODE_LABELS[code])
    ?? (country && COUNTRY_LABELS[country.toLowerCase()])
    ?? country ?? code ?? null;
}

function mapPartner(raw: RawPartner, index: number): PartnerView {
  const palette = PARTNER_PALETTE[index % PARTNER_PALETTE.length];
  const countryCode = raw.countryCode?.toUpperCase() ?? null;
  const country = countryLabel(countryCode, raw.country);
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type ?? null,
    country,
    countryCode,
    initials: partnerInitials(raw.name),
    logoUrl: raw.logoUrl ?? null,
    bg: palette.bg,
    color: palette.color,
    description: raw.description ?? "",
    websiteUrl: raw.websiteUrl ?? null,
    contactName: raw.contactName ?? null,
    contactEmail: raw.contactEmail ?? null,
    scopeLevel: parseScopeLevel(raw.scopeLevel),
    sources: mapSources(raw.sources),
  };
}

function mapSources(sources?: RawSource[] | null): SourceView[] {
  return (sources ?? [])
    .flatMap((source) => {
      const url = source.sourceUrl ?? source.url;
      if (!url || !/^https?:\/\//i.test(url)) return [];
      return [{
        url,
        title: source.sourceTitle ?? source.title ?? source.label ?? source.sourcePublisher ?? source.publisher ?? url,
        publisher: source.sourcePublisher ?? source.publisher ?? null,
        sourceType: source.sourceType ?? null,
        checkedAt: source.sourceCheckedAt ?? null,
        locator: source.sourceLocator ?? null,
      }];
    });
}

function mapActivity(raw: RawActivity): ActivityView {
  const { status, statusColor } = activityStatusLabel(raw.status);
  return {
    sources: mapSources(raw.sources),
    id: raw.id,
    name: raw.name,
    org: raw.partner?.name ?? "—",
    type: raw.activity_type || "กิจกรรมวิชาการ",
    date: activityDateLabel(raw.date, raw.dateKind, raw.datePrecision),
    participants: raw.participants ?? 0,
    mou: raw.mouDocId != null ? `เอกสาร #${raw.mouDocId}` : "—",
    mouDocId: raw.mouDocId ?? undefined,
    status,
    statusColor,
    description: raw.description ?? "",
    location: raw.location ?? null,
    time: raw.time ?? null,
    startDate: raw.date ?? null,
    endDate: raw.endDate ?? null,
    dateKind: raw.dateKind ?? null,
    datePrecision: raw.datePrecision ?? null,
    partnerId: raw.partner?.id ?? null,
    isOpen: raw.isOpen ?? null,
    scopeLevel: parseScopeLevel(raw.scopeLevel),
  };
}

export interface DocumentView {
  id: number;
  title: string;
  org: string | null;
  type: string | null;
  documentKind: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  start: string | null;
  expire: string | null;
  responsible: string | null;
  status: string | null;
  daysLeft: number | null;
  fileAvailability: string;
  fileAvailabilityLabel: string;
  downloadable: boolean;
  sources: SourceView[];
  signerOur: string | null;
  signerPartner: string | null;
  scopeItems: string[];
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  partnerId: number | null;
  scopeLevel: ScopeLevel | null;
}

function mapDocument(raw: RawDocument, partnerName?: string | null): DocumentView {
  const left = daysUntil(raw.expiryDate);
  const status = raw.status ?? null;
  const availability = raw.fileAvailability ?? (raw.storageKey ? "available" : "metadata_only");
  const kind = raw.documentKind ?? raw.docType ?? null;
  return {
    id: raw.id,
    title: raw.name,
    org: raw.partner?.name ?? partnerName ?? null,
    effectiveDate: raw.effectiveDate ?? null,
    expiryDate: raw.expiryDate ?? null,
    type: (raw.docType ?? kind)?.toUpperCase() ?? null,
    documentKind: kind,
    start: raw.effectiveDate ? formatThaiDate(raw.effectiveDate) : null,
    expire: raw.expiryDate ? formatThaiDate(raw.expiryDate) : null,
    responsible: raw.responsible ?? null,
    status,
    daysLeft: left,
    fileAvailability: availability,
    fileAvailabilityLabel:
      availability === "available" && Boolean(raw.storageKey)
        ? "มีไฟล์เอกสาร"
        : availability === "unavailable"
          ? "ไฟล์ไม่พร้อมใช้งาน"
          : "ไม่มีไฟล์เอกสาร",
    downloadable: Boolean(raw.storageKey) && availability === "available",
    sources: mapSources(raw.sources),
    signerOur: raw.signerOur ?? null,
    signerPartner: raw.signerPartner ?? null,
    scopeItems: raw.scopeItems?.map((item) => item.text) ?? [],
    fileName: raw.fileName ?? null,
    mimeType: raw.mimeType ?? null,
    sizeBytes: raw.sizeBytes ?? null,
    partnerId: raw.partnerId ?? null,
    scopeLevel: parseScopeLevel(raw.scopeLevel),
  };
}

function mapFeedback(
  raw: RawFeedback,
  activityNames: Map<number, string>,
  partnerNames: Map<number, string>
): FeedbackEntry {
  return {
    id: raw.id,
    title: raw.title,
    source: label(feedbackSourceLabels, raw.source),
    sourceCode: raw.source ?? "",
    respondentTypeId: raw.respondentTypeId ?? null,
    respondentTypeName: raw.respondentTypeName ?? "",
    feedbackSourceId: raw.feedbackSourceId ?? null,
    org: (raw.partnerId != null && partnerNames.get(raw.partnerId)) || "—",
    activity: (raw.activityId != null && activityNames.get(raw.activityId)) || "—",
    partnerId: raw.partnerId ?? null,
    activityId: raw.activityId ?? null,
    documentId: raw.documentId ?? null,
    exchangeId: raw.exchangeId ?? null,
    rating: raw.rating ?? 0,
    date: formatThaiDate(raw.date),
    dateIso: raw.date ?? null,
    status: raw.status ?? "—",
    comment: raw.comment ?? "",
    isPublished: raw.isPublished ?? true,
    reply: raw.reply ?? null,
    repliedAt: raw.repliedAt ?? null,
  };
}

function mapExchange(raw: RawExchange): ExchangeStudent {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type === "inbound" ? "inbound" : "outbound",
    from: raw.fromProgram ?? "—",
    to: raw.toOrganization ?? "—",
    period: formatThaiPeriod(raw.startDate, raw.endDate),
    program: raw.program ?? "—",
    status: raw.status ?? "—",
    raw,
  };
}

// ---------- Loaders ----------

/** GET /partners/ -> public partner list (published partners only, per API). */
export async function loadPublicPartners(): Promise<PartnerView[]> {
  const raw = await apiGetList<RawPartner>("/partners/");
  return raw.map(mapPartner);
}

/** GET /partners/{id} -> one published partner. Draft/missing records are 404. */
export async function loadPublicPartner(id: number): Promise<PartnerView> {
  const raw = await apiGet<RawPartner>(`/partners/${id}`);
  return mapPartner(raw, id);
}

/** GET /activities/ -> published activities. Failures are surfaced, never replaced. */
export async function loadActivities(): Promise<ActivityView[]> {
  const raw = await apiGetList<RawActivity>("/activities/");
  return latestActivities(raw.map(mapActivity), raw.length);
}

/** GET /activities/{id} -> one published activity. Draft/missing records are 404. */
export async function loadActivity(id: number): Promise<ActivityView> {
  const raw = await apiGet<RawActivity>(`/activities/${id}`);
  return mapActivity(raw);
}

/** GET /documents/ (+ /partners/ join for org names) -> documents list, newest effective date first. */
export async function loadDocuments(): Promise<DocumentView[]> {
  const raw = await apiGetList<RawDocument>("/documents/");
  return raw.map(document => mapDocument(document))
    .sort((a, b) => (b.effectiveDate ?? "").localeCompare(a.effectiveDate ?? "") || b.id - a.id);
}

export async function loadDocument(id: number): Promise<DocumentView> {
  return mapDocument(await apiGet<RawDocument>(`/documents/${id}`));
}

/** Internal agreement view (V3-3): drafts, review and publication fields included. */
export interface ManagedDocument {
  id: number;
  name: string;
  docType: string | null;
  documentKind: string | null;
  fileAvailability: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  partnerId: number | null;
  partner: { id: number; name: string } | null;
  responsible: string | null;
  status: string | null;
  signerOur: string | null;
  signerPartner: string | null;
  scopeLevel: ScopeLevel | null;
  isPublished: boolean;
  cstuStatus: "keep" | "review" | "out_of_scope";
  cstuEvidence: string | null;
  ownerUserId: number | null;
  sources: { id: number; sourceUrl: string }[];
}

/** GET /documents/manage: coordinators get their own, staff/admin all (needs login). */
export const loadManagedDocuments = () => apiGetList<ManagedDocument>("/documents/manage");

/** An agreement an activity may be linked to (activities.mou_document_id). */
export interface AgreementOption {
  id: number;
  name: string;
  partnerId: number | null;
}

const isAgreementRow = (d: { documentKind?: string | null; docType?: string | null }) =>
  d.documentKind === "agreement" || ["mou", "moa"].includes((d.docType ?? "").toLowerCase());

/**
 * Agreements the signed-in manager may link an activity to, by name: staff/admin
 * get every live one (GET /documents/manage); coordinators their own plus the
 * public ones (GET /documents/). The backend checks the same rule.
 */
export async function loadAgreementOptions(role: string): Promise<AgreementOption[]> {
  const [managed, published] = await Promise.all([
    loadManagedDocuments(),
    role === "coordinator" ? apiGetList<RawDocument>("/documents/").catch(() => [] as RawDocument[]) : Promise.resolve([] as RawDocument[]),
  ]);
  const byId = new Map<number, AgreementOption>();
  for (const d of [...managed, ...published]) {
    if (isAgreementRow(d) && !byId.has(d.id)) byId.set(d.id, { id: d.id, name: d.name, partnerId: d.partnerId ?? null });
  }
  return Array.from(byId.values()).sort((x, y) => x.name.localeCompare(y.name, "th"));
}

/** GET a list of {id, name} rows as a lookup map; an unavailable join yields an empty map. */
async function loadNames(path: string): Promise<Map<number, string>> {
  try {
    const rows = await apiGetList<{ id: number; name: string }>(path);
    return new Map(rows.map((row) => [row.id, row.name]));
  } catch {
    return new Map();
  }
}

/** Roles that read every feedback entry with its reply (GET /feedback/manage). */
export const FEEDBACK_MANAGER_ROLES = ["staff", "admin"];

async function buildFeedback(raw: unknown[]): Promise<FeedbackEntry[]> {
  const [activityNames, partnerNames] = await Promise.all([loadNames("/activities/"), loadNames("/partners/")]);
  return (raw as RawFeedback[]).map((f) => mapFeedback(f, activityNames, partnerNames));
}

/**
 * Feedback entries (+ /activities/ and /partners/ joins for names): coordinators,
 * staff/admin get the inbox (GET /feedback/); signed-in submitters get their own
 * entries (GET /feedback/mine); everyone else sees published entries.
 */
export function loadFeedbackEntries(role: string = "public"): Promise<FeedbackEntry[]> {
  const path = FEEDBACK_MANAGER_ROLES.includes(role) ? "/feedback/" : role === "public" ? "/feedback/" : "/feedback/mine";
  return safeLoad<FeedbackEntry[]>(path, buildFeedback, []);
}

/** Like loadFeedbackEntries, but a failed request is thrown so the page can say so. */
export async function loadFeedbackStrict(role: string = "public"): Promise<FeedbackEntry[]> {
  const path = FEEDBACK_MANAGER_ROLES.includes(role) ? "/feedback/" : role === "public" ? "/feedback/" : "/feedback/mine";
  return buildFeedback(await apiGetList<unknown>(path));
}

/**
 * Exchange students the viewer may see: signed-in students/coordinators get their
 * own records and staff/admin get all (GET /exchange/mine); everyone else gets
 * the published list (GET /exchange/).
 */
export function loadExchangeStudents(role: string = "public"): Promise<ExchangeStudent[]> {
  const path = role === "public" ? "/exchange/" : "/exchange/mine";
  return safeLoad<ExchangeStudent[]>(path, (raw) => (raw as RawExchange[]).map(mapExchange), []);
}

/** GET /users/ (admin only) -> every account that has signed in. */
export const loadUsers = () => apiGetList<UserAccount>("/users/");

/** ISO timestamp -> "20 ส.ค. 2568 14:05" in local time; "—" if missing. */
export function formatThaiDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${formatThaiDate(iso)} ${time}`;
}

// ---------- Hook for pages ----------

/**
 * Load data via the API for internal pages: `fallback` (an empty value) is used
 * for the initial render and stays if the loader fails.
 */
export function useApiData<T>(loader: () => Promise<T>, fallback: T, dependencies: DependencyList = []): T {
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
  }, dependencies);
  return data;
}

export type ApiResource<T> =
  | { status: "loading"; data: null; error: null; retry: () => void }
  | { status: "success"; data: T; error: null; retry: () => void }
  | { status: "error"; data: null; error: ApiError; retry: () => void };

/** Strict API state for public UI: loading, error and empty results are surfaced. */
export function useApiResource<T>(
  loader: () => Promise<T>,
  dependencies: DependencyList = []
): ApiResource<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | { status: "loading"; data: null; error: null }
    | { status: "success"; data: T; error: null }
    | { status: "error"; data: null; error: ApiError }
  >({ status: "loading", data: null, error: null });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", data: null, error: null });
    loader()
      .then((data) => {
        if (alive) setState({ status: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setState({
          status: "error",
          data: null,
          error: error instanceof ApiError ? error : new ApiError("Unexpected API error"),
        });
      });
    return () => {
      alive = false;
    };
    // The caller supplies dependencies explicitly; attempt is the user-triggered retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, attempt]);

  return {
    ...state,
    retry: () => {
      clearApiCache();
      setAttempt((value) => value + 1);
    },
  } as ApiResource<T>;
}

/* ---- V4-2 outcomes (camelCase; the nested type keeps the lookup API's snake_case) ---- */
export interface OutcomeType {
  id: number;
  code: string;
  name_th: string;
  unit: string | null;
  is_active: boolean;
  sort_order: number;
}

export type OutcomeContextField = "partnerId" | "activityId" | "documentId" | "exchangeId";

export interface Outcome {
  id: number;
  title: string;
  description: string | null;
  value: number | null;
  unit: string | null;
  occurredOn: string | null;
  evidenceUrl: string | null;
  partnerId: number | null;
  activityId: number | null;
  documentId: number | null;
  exchangeId: number | null;
  isPublished: boolean;
  outcomeType: OutcomeType;
  /** Whether the signed-in caller may edit this outcome (decided by the server). */
  canEdit: boolean;
}

export interface OutcomePage {
  items: Outcome[];
  total: number;
  page: number;
  pageSize: number;
}

export type OutcomeInput = Partial<Omit<Outcome, "id" | "outcomeType" | "canEdit">> & { outcomeTypeId?: number };

/* ---- V4-5 insights: figures aggregated by the backend ---- */
export interface KeyedCount<K = string> { key: K; count: number }
export interface LabelledCount extends KeyedCount { label: string }

export interface InsightsSummary {
  filters: { dateFrom: string | null; dateTo: string | null; stakeholderType: string | null };
  expiringWithinDays: number;
  partnersByType: KeyedCount<string | null>[];
  agreementsByStatus: KeyedCount<string | null>[];
  agreementsByYear: { year: number; count: number }[];
  topPartners: { id: number; name: string; agreements: number; activities: number; total: number }[];
  agreementsExpiring: { id: number; name: string; expiryDate: string; partnerId: number | null; partnerName: string | null }[];
  activitiesByMonth: { month: string; count: number }[];
  outcomesByType: (LabelledCount & { totalValue: number })[];
  feedbackBySource: LabelledCount[];
  feedbackByRespondentType: LabelledCount[];
  feedbackByRating: KeyedCount<number>[];
  feedbackByStatus: KeyedCount[];
  feedbackAverageRating: number | null;
}

export interface InsightsFilters { year?: number | null; stakeholderType?: string | null }

/** Query string shared by the summary JSON and CSV endpoints. */
export function insightsQuery(filters: InsightsFilters): string {
  const params = new URLSearchParams();
  if (filters.year) params.set("year", String(filters.year));
  if (filters.stakeholderType) params.set("stakeholder_type", filters.stakeholderType);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** GET /insights/summary (staff/admin). */
export const loadInsightsSummary = (filters: InsightsFilters = {}) =>
  apiGet<InsightsSummary>(`/insights/summary${insightsQuery(filters)}`);

export type MyInsights =
  | {
      role: "coordinator";
      counts: { partners: number; activities: number; outcomes: number; feedback: number; feedbackPending: number };
      recentActivities: { id: number; name: string; date: string | null; status: string | null; partnerId: number | null }[];
    }
  | {
      role: "student";
      counts: { feedbackSubmitted: number };
      exchange: { id: number; name: string; program: string | null; status: string | null; toOrganization: string | null; startDate: string | null; endDate: string | null }[];
    };

/** GET /insights/me (coordinator/student): figures for the viewer's own records. */
export const loadMyInsights = () => apiGet<MyInsights>("/insights/me");

/* ---- Audit log (ประวัติการแก้ไข), staff/admin ---- */
export interface AuditLogRow {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  entity: string;
  entity_id: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogFilters {
  entity?: string; userId?: number | null; dateFrom?: string; dateTo?: string; limit: number; offset: number;
}

/** GET /audit-logs/ with the matching total from X-Total-Count. */
export async function loadAuditLogs(filters: AuditLogFilters): Promise<{ rows: AuditLogRow[]; total: number }> {
  const params = new URLSearchParams({ limit: String(filters.limit), offset: String(filters.offset) });
  if (filters.entity) params.set("entity", filters.entity);
  if (filters.userId) params.set("user_id", String(filters.userId));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/audit-logs/?${params}`, {
      headers: { Accept: "application/json", ...authHeaders() }, cache: "no-store",
    });
  } catch {
    throw new ApiError("Unable to connect to the API");
  }
  if (!res.ok) {
    checkUnauthorized(res.status);
    throw new ApiError(await errorDetail(res), res.status);
  }
  const rows = (await res.json()) as AuditLogRow[];
  return { rows, total: Number(res.headers.get("X-Total-Count") ?? rows.length) };
}

/** GET /audit-logs/users: accounts that appear in the log. */
export const loadAuditUsers = () => apiGetList<{ id: number; email: string }>("/audit-logs/users");
