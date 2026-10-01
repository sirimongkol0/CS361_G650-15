"use client";

// Dashboard figures computed from the published API data (no hard-coded numbers).

import {
  THAI_MONTHS_ABBR,
  loadDocuments,
  loadActivities,
  loadExchangeStudents,
  loadFeedbackEntries,
  loadPublicPartners,
  useApiData,
  type ActivityView,
  type DocumentView,
  type ExchangeStudent,
  type FeedbackEntry,
  type PartnerView,
} from "@/lib/api";

/** Agreements expiring within this many days need follow-up. */
export const EXPIRING_WITHIN_DAYS = 90;

export interface DashboardData {
  loaded: boolean;
  partners: PartnerView[];
  documents: DocumentView[];
  activities: ActivityView[];
  feedback: FeedbackEntry[];
  exchange: ExchangeStudent[];
}

const EMPTY: DashboardData = {
  loaded: false, partners: [], documents: [], activities: [], feedback: [], exchange: [],
};

const orEmpty = <T,>(promise: Promise<T[]>) => promise.catch(() => [] as T[]);

/** Load every list the dashboards use; an unavailable list is treated as empty. */
export function useDashboardData(): DashboardData {
  return useApiData<DashboardData>(async () => {
    const [partners, documents, activities, feedback, exchange] = await Promise.all([
      orEmpty(loadPublicPartners()),
      orEmpty(loadDocuments()),
      orEmpty(loadActivities()),
      loadFeedbackEntries(),
      loadExchangeStudents(),
    ]);
    return { loaded: true, partners, documents, activities, feedback, exchange };
  }, EMPTY);
}

export type AgreementState = "expired" | "expiring" | "active" | "draft";

/** Agreement state derived from its expiry date; no expiry date means open-ended. */
export function agreementState(doc: DocumentView): AgreementState {
  if (doc.status === "draft") return "draft";
  if (doc.daysLeft == null) return "active";
  if (doc.daysLeft < 0) return "expired";
  return doc.daysLeft <= EXPIRING_WITHIN_DAYS ? "expiring" : "active";
}

export const isAgreement = (doc: DocumentView) =>
  doc.documentKind === "agreement" || doc.type === "MOU" || doc.type === "MOA";

/** Agreements that expire soon, nearest first. */
export function expiringAgreements(documents: DocumentView[]) {
  return documents
    .filter((doc) => isAgreement(doc) && agreementState(doc) === "expiring")
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
}

const yearOf = (iso: string | null | undefined) => (iso ? Number(iso.slice(0, 4)) : NaN);

/** Distinct Gregorian years present in the dates, newest first. */
export function yearsIn(isoDates: (string | null | undefined)[]): number[] {
  return Array.from(new Set(isoDates.map(yearOf).filter((y) => !isNaN(y)))).sort((a, b) => b - a);
}

/** Count of dates per month of `year` (12 points, Thai month labels). */
export function countByMonth(isoDates: (string | null | undefined)[], year: number): number[] {
  const counts = Array(12).fill(0);
  for (const iso of isoDates) {
    if (iso && yearOf(iso) === year) counts[Number(iso.slice(5, 7)) - 1] += 1;
  }
  return counts;
}

export const monthLabel = (index: number) => THAI_MONTHS_ABBR[index];

/** Buddhist-era label for a Gregorian year. */
export const beYear = (year: number) => String(year + 543);

/** Most recent activities first. */
export function recentActivities(activities: ActivityView[], limit: number) {
  return [...activities]
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
    .slice(0, limit);
}

/** Activities dated today or later, soonest first. */
export function upcomingActivities(activities: ActivityView[]) {
  const today = new Date().toISOString().slice(0, 10);
  return activities
    .filter((a) => (a.endDate ?? a.startDate ?? "") >= today)
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
}

/** Partners ranked by number of published agreements and activities. */
export function partnersByEngagement(data: Pick<DashboardData, "partners" | "documents" | "activities">) {
  return data.partners
    .map((partner) => {
      const agreements = data.documents.filter((d) => d.partnerId === partner.id && isAgreement(d)).length;
      const activities = data.activities.filter((a) => a.partnerId === partner.id).length;
      return { partner, agreements, activities, total: agreements + activities };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.partner.name.localeCompare(b.partner.name));
}

export function averageRating(feedback: FeedbackEntry[]): number | null {
  const rated = feedback.filter((f) => f.rating > 0);
  return rated.length ? rated.reduce((sum, f) => sum + f.rating, 0) / rated.length : null;
}

/** Display a count, or "—" while the data is still loading. */
export const shown = (loaded: boolean, value: number | string) => (loaded ? String(value) : "—");
