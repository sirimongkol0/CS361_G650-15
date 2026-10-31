"use client";

// Dashboard helpers. Staff/admin/coordinator/student figures come from GET /insights/*
// (aggregated in SQL); the list helpers serve the public dashboard and list pages.

import {
  THAI_MONTHS_ABBR,
  loadInsightsSummary,
  loadMyInsights,
  useApiData,
  type InsightsSummary,
  type MyInsights,
  type ActivityView,
  type DocumentView,
  type FeedbackEntry,
} from "@/lib/api";

/** Agreements expiring within this many days need follow-up. */
export const EXPIRING_WITHIN_DAYS = 90;

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

export function averageRating(feedback: FeedbackEntry[]): number | null {
  const rated = feedback.filter((f) => f.rating > 0);
  return rated.length ? rated.reduce((sum, f) => sum + f.rating, 0) / rated.length : null;
}

/** Display a count, or "—" while the data is still loading. */
export const shown = (loaded: boolean, value: number | string) => (loaded ? String(value) : "—");

// ---- V4-5: figures from the backend (GET /insights/*) ----

export const THIS_YEAR = new Date().getFullYear();
/** Years offered by the dashboard and report year selectors, newest first. */
export const RECENT_YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

export const sumCounts = (rows: { count: number }[] = []) => rows.reduce((total, row) => total + row.count, 0);
export const countFor = (rows: { key: unknown; count: number }[] = [], key: unknown) =>
  rows.find((row) => row.key === key)?.count ?? 0;

/** Whole days from today until an ISO date (negative once it has passed). */
export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

/** Activities per month of one year, all 12 months present. */
export function monthlyFromSummary(summary: InsightsSummary | null, year: number) {
  const counts = new Map((summary?.activitiesByMonth ?? []).map((row) => [row.month, row.count]));
  return Array.from({ length: 12 }, (_, i) => ({
    month: monthLabel(i),
    กิจกรรม: counts.get(`${year}-${String(i + 1).padStart(2, "0")}`) ?? 0,
  }));
}

/** Staff/admin summary for one year; null until it loads (or if it fails). */
export function useYearSummary(year: number | null): InsightsSummary | null {
  return useApiData<InsightsSummary | null>(
    () => loadInsightsSummary({ year }).catch(() => null), null, [year]);
}

/** Coordinator/student figures for their own records; null until loaded. */
export function useMyInsights(): MyInsights | null {
  return useApiData<MyInsights | null>(() => loadMyInsights().catch(() => null), null, []);
}
