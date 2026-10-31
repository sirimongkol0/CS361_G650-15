"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { downloadFile } from "@/lib/download-file";

const card =
  "rounded-lg border border-line bg-white p-5 shadow-card";

const control =
  "rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/10";

const initialFilters = {
  date_from: "",
  date_to: "",
  source_id: "",
  respondent_type_id: "",
  partner_id: "",
  activity_id: "",
  document_id: "",
  exchange_id: "",
  status: "",
  outcome_type_id: "",
};

type ExportFilters = typeof initialFilters;

const numericFilterLabels: Partial<Record<keyof ExportFilters, string>> = {
  source_id: "แหล่งข้อมูล ID",
  respondent_type_id: "ประเภทผู้ตอบ ID",
  partner_id: "Partner ID",
  activity_id: "Activity ID",
  document_id: "Document ID",
  exchange_id: "Exchange ID",
  outcome_type_id: "ประเภทผลลัพธ์ ID",
};

const contextFilterKeys = [
  "partner_id",
  "activity_id",
  "document_id",
  "exchange_id",
] as const;

const feedbackFilterKeys = [
  "source_id",
  "respondent_type_id",
  ...contextFilterKeys,
] as const;

const outcomeFilterKeys = [
  "outcome_type_id",
  ...contextFilterKeys,
] as const;

export default function ExportSection() {
  const [filters, setFilters] = useState<ExportFilters>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setFilter = (key: keyof ExportFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const numericFiltersValid = (keys: readonly (keyof ExportFilters)[]) =>
    keys.every((key) => {
      if (!filters[key]) return true;
      const number = Number(filters[key]);
      return Number.isInteger(number) && number > 0;
    });
  const feedbackFiltersValid = numericFiltersValid(feedbackFilterKeys);
  const outcomeFiltersValid = numericFiltersValid(outcomeFilterKeys);
  const datesValid =
    !filters.date_from ||
    !filters.date_to ||
    filters.date_from <= filters.date_to;

  const exportCsv = async (type: "feedback" | "outcomes") => {
    setError(null);
    setBusy(true);

    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);

      for (const key of contextFilterKeys) {
        if (filters[key]) params.set(key, filters[key]);
      }

      if (type === "feedback") {
        if (filters.source_id) params.set("source_id", filters.source_id);
        if (filters.respondent_type_id) {
          params.set("respondent_type_id", filters.respondent_type_id);
        }
        if (filters.status) params.set("status", filters.status);
      } else if (filters.outcome_type_id) {
        params.set("outcome_type_id", filters.outcome_type_id);
      }

      const query = params.toString();
      const suffix = query ? `?${query}` : "";
      await downloadFile(`/imports/export/${type}.csv${suffix}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ส่งออกข้อมูลไม่สำเร็จ"
      );
    } finally {
      setBusy(false);
    }
  };

  const renderIdFilter = (key: keyof ExportFilters) => (
    <label key={key} className="grid gap-1 text-xs text-faint">
      {numericFilterLabels[key]}
      <input
        className={control}
        type="number"
        min="1"
        step="1"
        value={filters[key]}
        onChange={(event) => setFilter(key, event.target.value)}
      />
    </label>
  );

  return (
    <section className={`${card} mb-5`}>
      <div className="mb-3">
        <h2 className="font-semibold text-ink">
          ส่งออกข้อมูลเป็น CSV
        </h2>
        <p className="text-xs text-faint">
          เลือกตัวกรองที่ต้องการ ระบบจะใช้เฉพาะตัวกรองที่กรอกไว้
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs text-faint">
          ตั้งแต่วันที่
          <input
            className={control}
            type="date"
            value={filters.date_from}
            onChange={(event) => setFilter("date_from", event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-faint">
          ถึงวันที่
          <input
            className={control}
            type="date"
            value={filters.date_to}
            onChange={(event) => setFilter("date_to", event.target.value)}
          />
        </label>
        {contextFilterKeys.map(renderIdFilter)}
        {renderIdFilter("source_id")}
        {renderIdFilter("respondent_type_id")}
        {renderIdFilter("outcome_type_id")}
        <label className="grid gap-1 text-xs text-faint">
          สถานะ Feedback
          <select
            className={control}
            value={filters.status}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="">ทั้งหมด</option>
            <option value="pending">รอตรวจสอบ</option>
            <option value="reviewed">ตรวจสอบแล้ว</option>
          </select>
        </label>
      </div>

      {(!datesValid || !feedbackFiltersValid || !outcomeFiltersValid) && (
        <p className="mt-2 text-xs text-red-600">
          {!datesValid
            ? "วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด"
            : "รหัสตัวกรองต้องเป็นจำนวนเต็มบวก"}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || !datesValid || !feedbackFiltersValid}
          onClick={() => void exportCsv("feedback")}
        >
          <Download className="mr-1 inline h-4 w-4" />
          Feedback CSV
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || !datesValid || !outcomeFiltersValid}
          onClick={() => void exportCsv("outcomes")}
        >
          <Download className="mr-1 inline h-4 w-4" />
          Outcomes CSV
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => {
            setFilters(initialFilters);
            setError(null);
          }}
        >
          ล้างตัวกรอง
        </button>
      </div>
    </section>
  );
}
