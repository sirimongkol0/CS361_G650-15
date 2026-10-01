"use client";

// API client for the backend REST API (base URL from env, path prefix /api/v1).
// NEXT_PUBLIC_API_URL       — server-side (SSR) base URL
// NEXT_PUBLIC_API_BROWSER_URL — browser-side base URL (falls back to the above)
//
// Public loaders are strict: failures and empty results are surfaced to the UI.
// Internal-page loaders return an empty result when the API is unavailable.

import { type DependencyList, useEffect, useState } from "react";
import { activityDateLabel, activityStatusLabel, latestActivities } from "@/lib/activity-display";
import { parseScopeLevel, type ScopeLevel } from "@/lib/labels";

// ---------- Base URL ----------

const SERVER_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const BROWSER_BASE = process.env.NEXT_PUBLIC_API_BROWSER_URL || SERVER_BASE;

function apiBase(): string {
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

/*
 * Session cache: identical GETs within CACHE_TTL_MS share one request, so moving
 * between pages does not refetch every list. Failed requests are not cached.
 * A network failure (not an HTTP error) is retried once automatically.
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
  const cached = responseCache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise as Promise<T>;
  const promise = apiGetWithRetry<T>(path);
  responseCache.set(path, { at: Date.now(), promise });
  promise.then(
    () => { lastFetchedAt = new Date(); },
    () => { if (responseCache.get(path)?.promise === promise) responseCache.delete(path); }
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
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
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

/** GET a JSON list from the API; throws on any failure (caller decides fallback). */
async function apiGetList<T>(path: string): Promise<T[]> {
  const data = await apiGet<unknown>(path);
  if (!Array.isArray(data)) throw new ApiError(`API ${path} -> unexpected payload`);
  return data as T[];
}

/**
 * Try the API and map the result; on any failure (including an empty list)
 * return `fallback` (an empty value, never sample data). `build` runs inside
 * the try so malformed rows also trigger the fallback.
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
  toOrganization?: string | null;
  startDate?: string | null; // ISO
  endDate?: string | null; // ISO
  program?: string | null;
  status?: string | null;
  partnerId?: number | null;
  activityId?: number | null;
}

interface RawUser {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
}

// ---------- View types for internal pages ----------

export interface FeedbackEntry {
  id: number;
  title: string;
  source: string;
  org: string;
  activity: string;
  rating: number;
  date: string;
  /** ISO date, for aggregation. */
  dateIso: string | null;
  status: string;
  comment: string;
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
}

export interface AdminProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
}

export const EMPTY_ADMIN_PROFILE: AdminProfile = {
  firstName: "", lastName: "", email: "", phone: "", position: "", department: "",
};

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

function mapPartner(raw: RawPartner, index: number): PartnerView {
  const palette = PARTNER_PALETTE[index % PARTNER_PALETTE.length];
  const countryCode = raw.countryCode?.toUpperCase() ?? null;
  const country = (countryCode && COUNTRY_CODE_LABELS[countryCode])
    ?? (raw.country && COUNTRY_LABELS[raw.country.toLowerCase()])
    ?? raw.country ?? countryCode ?? null;
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
    source: raw.source ?? "—",
    org: (raw.partnerId != null && partnerNames.get(raw.partnerId)) || "—",
    activity: (raw.activityId != null && activityNames.get(raw.activityId)) || "—",
    rating: raw.rating ?? 0,
    date: formatThaiDate(raw.date),
    dateIso: raw.date ?? null,
    status: raw.status ?? "—",
    comment: raw.comment ?? "",
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

/** GET a list of {id, name} rows as a lookup map; an unavailable join yields an empty map. */
async function loadNames(path: string): Promise<Map<number, string>> {
  try {
    const rows = await apiGetList<{ id: number; name: string }>(path);
    return new Map(rows.map((row) => [row.id, row.name]));
  } catch {
    return new Map();
  }
}

/** GET /feedback/ (+ /activities/ and /partners/ joins for names) -> feedback entries. */
export function loadFeedbackEntries(): Promise<FeedbackEntry[]> {
  return safeLoad<FeedbackEntry[]>(
    "/feedback/",
    async (raw) => {
      const [activityNames, partnerNames] = await Promise.all([loadNames("/activities/"), loadNames("/partners/")]);
      return (raw as RawFeedback[]).map((f) => mapFeedback(f, activityNames, partnerNames));
    },
    []
  );
}

/** GET /exchange/ -> exchange students. */
export function loadExchangeStudents(): Promise<ExchangeStudent[]> {
  return safeLoad<ExchangeStudent[]>("/exchange/", (raw) => (raw as RawExchange[]).map(mapExchange), []);
}

/** GET /users/ -> the first admin/staff profile. */
export function loadAdminProfile(): Promise<AdminProfile> {
  return safeLoad<AdminProfile>("/users/", (raw) => mapAdminProfile((raw as RawUser[])[0]), EMPTY_ADMIN_PROFILE);
}

// ---------- Hook for pages ----------

/**
 * Load data via the API for internal pages: `fallback` (an empty value) is used
 * for the initial render and stays if the loader fails.
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
