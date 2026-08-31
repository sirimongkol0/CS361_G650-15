"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronRight,
  Star,
  X,
  MessageSquare,
  Send,
  CheckCircle2,
} from "lucide-react";
import { feedbackEntries as mockFeedbackEntries } from "@/lib/mock";
import { loadFeedbackEntries, useApiData } from "@/lib/api";

type FeedbackEntry = (typeof mockFeedbackEntries)[number];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="w-3.5 h-3.5"
          fill={i <= rating ? "#C8961E" : "none"}
          color={i <= rating ? "#C8961E" : "#E5E7EB"}
        />
      ))}
    </div>
  );
}

const sourceColors: Record<string, string> = {
  "ผู้เข้าร่วมกิจกรรม": "badge-blue",
  "ศิษย์เก่า": "badge-purple",
  "คู่ความร่วมมือ": "badge-crimson",
  "ระบบสหกิจศึกษา": "badge-gold",
  "นักศึกษา": "badge-green",
};

const statusColors: Record<string, string> = {
  "ตรวจสอบแล้ว": "badge-green",
  "รอดำเนินการ": "badge-gold",
  "รับทราบ": "badge-blue",
};

export default function FeedbackPage() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(mockFeedbackEntries[0]?.id ?? null);
  const [replyText, setReplyText] = useState("");

  // API-first with mock.ts as fallback (initial render uses mock until API resolves).
  const feedbackEntries = useApiData(loadFeedbackEntries, mockFeedbackEntries);

  const filtered = feedbackEntries.filter((f: FeedbackEntry) => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === "all" || f.source === sourceFilter;
    const matchRating =
      ratingFilter === "all" || f.rating === parseInt(ratingFilter);
    return matchSearch && matchSource && matchRating;
  });

  const selected = feedbackEntries.find((f: FeedbackEntry) => f.id === selectedId);

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
          <Link href="/" className="text-faint hover:text-crimson">
            หน้าหลัก
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-crimson">Feedback</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink font-display">Feedback</h1>
        <p className="text-sm mt-0.5 text-faint">จัดการ Feedback จากทุกแหล่ง</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        {[
          { label: "ทั้งหมด", value: feedbackEntries.length, color: "text-crimson" },
          {
            label: "คะแนนเฉลี่ย",
            value:
              (
                feedbackEntries.reduce(
                  (sum: number, f: FeedbackEntry) => sum + f.rating,
                  0
                ) / (feedbackEntries.length || 1)
              ).toFixed(1) + "★",
            color: "text-gold-dark",
          },
          {
            label: "ตรวจสอบแล้ว",
            value: feedbackEntries.filter((f: FeedbackEntry) => f.status === "ตรวจสอบแล้ว").length,
            color: "text-green-600",
          },
          {
            label: "รอดำเนินการ",
            value: feedbackEntries.filter((f: FeedbackEntry) => f.status === "รอดำเนินการ").length,
            color: "text-gold-dark",
          },
          {
            label: "แหล่ง Feedback",
            value: new Set(feedbackEntries.map((f: FeedbackEntry) => f.source)).size,
            color: "text-purple-600",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-white shadow-card p-4">
            <div className={`text-xl font-bold mb-0.5 ${s.color} font-display`}>
              {s.value}
            </div>
            <div className="text-xs text-faint">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        {/* List */}
        <div>
          <div className="rounded-lg bg-white shadow-card p-4 mb-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                <input
                  className="w-full rounded-md border border-line bg-white px-3 py-2 pl-9 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
                  placeholder="ค้นหา Feedback..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
                style={{ width: "auto", minWidth: 180 }}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">แหล่ง: ทั้งหมด</option>
                {Object.keys(sourceColors).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
                style={{ width: "auto", minWidth: 140 }}
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
              >
                <option value="all">คะแนน: ทั้งหมด</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r} ดาว
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map((f: FeedbackEntry) => (
              <div
                key={f.id}
                className="rounded-lg bg-white shadow-card p-4 cursor-pointer transition-all hover:shadow-card-hover"
                style={{
                  borderColor: selectedId === f.id ? "#8B1538" : "#E5E7EB",
                  borderWidth: selectedId === f.id ? 2 : 1,
                }}
                onClick={() => setSelectedId(f.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold leading-snug flex-1 text-ink">
                    {f.title}
                  </p>
                  <span
                    className={`badge ${statusColors[f.status] ?? "badge-gray"} flex-shrink-0`}
                  >
                    {f.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`badge ${sourceColors[f.source] ?? "badge-gray"} text-xs`}
                  >
                    {f.source}
                  </span>
                  <StarRow rating={f.rating} />
                  <span className="text-xs text-faint">{f.date}</span>
                </div>
                {f.org !== "—" && (
                  <div className="text-xs mt-1.5 text-faint">
                    🏢 {f.org}
                    {f.activity !== "—" && <> • 📅 {f.activity}</>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="space-y-4 lg:sticky lg:top-6 self-start">
            <div className="rounded-lg bg-white shadow-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-base mb-1 text-ink">
                    {selected.title}
                  </h2>
                  <span
                    className={`badge ${statusColors[selected.status] ?? "badge-gray"}`}
                  >
                    {selected.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="btn btn-outline p-1"
                  aria-label="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-line">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gold-light">
                  <Star className="w-5 h-5 text-gold" fill="#C8961E" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <StarRow rating={selected.rating} />
                    <span className="font-bold text-lg text-ink">
                      {selected.rating} / 5
                    </span>
                  </div>
                  <div className="text-xs text-faint">{selected.date}</div>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                {[
                  { label: "แหล่ง", value: selected.source },
                  { label: "หน่วยงาน", value: selected.org },
                  { label: "กิจกรรม", value: selected.activity },
                ]
                  .filter((r) => r.value !== "—")
                  .map((row) => (
                    <div key={row.label} className="flex gap-3">
                      <span
                        className="text-xs font-semibold mt-0.5 text-faint"
                        style={{ width: 64 }}
                      >
                        {row.label}
                      </span>
                      <span className="text-sm text-mute">{row.value}</span>
                    </div>
                  ))}
              </div>

              <div className="p-4 rounded-lg mb-5 bg-soft border border-paper">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-faint" />
                  <span className="text-sm font-semibold text-ink">
                    ความคิดเห็น
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-mute">
                  {selected.comment}
                </p>
              </div>

              {/* Reply */}
              <div>
                <div className="text-sm font-semibold mb-2 text-ink">
                  ตอบกลับ / บันทึกการดำเนินการ
                </div>
                <textarea
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:ring-1 focus:ring-crimson"
                  rows={3}
                  placeholder="พิมพ์คำตอบหรือการดำเนินการ..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    className="btn btn-primary gap-2 flex-1 py-2"
                    onClick={() => setReplyText("")}
                  >
                    <Send className="w-3.5 h-3.5" />
                    ส่งคำตอบ
                  </button>
                  <button
                    className="btn btn-outline gap-2 py-2 px-3"
                    onClick={() => setSelectedId(null)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
