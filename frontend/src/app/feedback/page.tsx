"use client";

// Feedback list. Everyone sees published entries (GET /feedback/); coordinators,
// staff and admin see every entry with its reply (GET /feedback/manage) and can
// record a reply and status (PATCH /feedback/{id}). Only staff/admin publish.

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Search, ChevronRight, Star, X, MessageSquare, Save, Eye, EyeOff } from "lucide-react";
import { apiGetList, apiPatch, apiPost, formatThaiDateTime, loadFeedbackStrict, useApiResource, type FeedbackEntry } from "@/lib/api";
import { averageRating } from "@/lib/dashboard-data";
import { useRole } from "@/lib/role-context";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Field, FormError, Notice, inputCls, useAction } from "@/components/form-ui";
import { matchesQuery, useDocumentTitle } from "@/lib/list-tools";
import { feedbackStatusLabels, label } from "@/lib/labels";

const FEEDBACK_STATUSES = ["pending", "reviewed"] as const;

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={rating ? `${rating} จาก 5 ดาว` : "ไม่มีคะแนน"}>
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
  "หน่วยงานคู่ความร่วมมือ": "badge-crimson",
  "ระบบสหกิจศึกษา": "badge-gold",
  "นักศึกษา": "badge-green",
};

const statusColors: Record<string, string> = {
  reviewed: "badge-green",
  pending: "badge-gold",
};

function FeedbackSubmitForm({ onCreated }: { onCreated: () => void }) {
  const [types, setTypes] = useState<Array<{ id: number; name_th: string; code: string }>>([]);
  const [activities, setActivities] = useState<Array<{ id: number; name: string }>>([]);
  const [exchanges, setExchanges] = useState<Array<{ id: number; name: string }>>([]);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [respondentTypeId, setRespondentTypeId] = useState("");
  const [contextType, setContextType] = useState<"activity" | "exchange">("activity");
  const [contextId, setContextId] = useState("");
  const [rating, setRating] = useState("5");
  const action = useAction();

  useEffect(() => {
    void Promise.all([
      apiGetList<{ id: number; name_th: string; code: string }>("/feedback/respondent-types"),
      apiGetList<{ id: number; name: string }>("/activities/"),
      apiGetList<{ id: number; name: string }>("/exchange/"),
    ]).then(([respondents, rows, exchangeRows]) => {
      setTypes(respondents);
      setRespondentTypeId(String(respondents[0]?.id ?? ""));
      setActivities(rows);
      setExchanges(exchangeRows);
      const params = new URLSearchParams(window.location.search);
      const presetActivity = params.get("activityId");
      const presetExchange = params.get("exchangeId");
      if (presetExchange && exchangeRows.some((row) => String(row.id) === presetExchange)) {
        setContextType("exchange");
        setContextId(presetExchange);
      } else if (presetActivity && rows.some((row) => String(row.id) === presetActivity)) {
        setContextType("activity");
        setContextId(presetActivity);
      } else {
        setContextId(String(rows[0]?.id ?? exchangeRows[0]?.id ?? ""));
      }
    }).catch(() => undefined);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!respondentTypeId || !contextId) return;
    if (await action.run(() => apiPost("/feedback/", {
      title, comment, rating: Number(rating), respondent_type_id: Number(respondentTypeId),
      ...(contextType === "activity" ? { activity_id: Number(contextId) } : { exchange_id: Number(contextId) }),
    }))) {
      setTitle("");
      setComment("");
      onCreated();
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg bg-white shadow-card p-4 mb-5">
      <h2 className="font-semibold text-ink mb-3">ส่ง Feedback</h2>
      <FormError error={action.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="หัวข้อ"><input className={inputCls} required maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="ประเภทผู้ส่ง"><select className={inputCls} required value={respondentTypeId} onChange={(e) => setRespondentTypeId(e.target.value)}>
          {types.map((type) => <option key={type.id} value={type.id}>{type.name_th || type.code}</option>)}
        </select></Field>
        <Field label="ประเภทบริบท"><select className={inputCls} value={contextType} onChange={(e) => {
          const next = e.target.value as "activity" | "exchange";
          setContextType(next);
          const rows = next === "activity" ? activities : exchanges;
          setContextId(String(rows[0]?.id ?? ""));
        }}>
          <option value="activity">กิจกรรม</option><option value="exchange">การแลกเปลี่ยน</option>
        </select></Field>
        <Field label={contextType === "activity" ? "เลือกกิจกรรม" : "เลือกรายการแลกเปลี่ยน"}><select className={inputCls} required value={contextId} onChange={(e) => setContextId(e.target.value)}>
          {(contextType === "activity" ? activities : exchanges).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></Field>
        <Field label="คะแนน"><select className={inputCls} value={rating} onChange={(e) => setRating(e.target.value)}>
          {[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} / 5</option>)}
        </select></Field>
      </div>
      <Field label="ความคิดเห็น"><textarea className={`${inputCls} resize-y`} rows={3} maxLength={4000} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
      <button className="btn btn-primary" disabled={action.busy || !types.length || !(contextType === "activity" ? activities.length : exchanges.length)}>ส่งความคิดเห็น</button>
    </form>
  );
}

/** Reply, status and publication controls for one entry (managers only). */
function ReplyForm({ entry, canPublish, onSaved }: {
  entry: FeedbackEntry; canPublish: boolean; onSaved: (message: string) => void;
}) {
  const [reply, setReply] = useState(entry.reply ?? "");
  const [status, setStatus] = useState<string>(
    (FEEDBACK_STATUSES as readonly string[]).includes(entry.status) ? entry.status : "pending"
  );
  const action = useAction();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (await action.run(() => apiPatch(`/feedback/${entry.id}`, { reply, status }))) onSaved("บันทึกคำตอบแล้ว");
  };
  const setPublished = async (published: boolean) => {
    if (await action.run(() => apiPost(`/feedback/${entry.id}/${published ? "publish" : "unpublish"}`))) {
      onSaved(published ? "เผยแพร่ความคิดเห็นแล้ว" : "หยุดเผยแพร่ความคิดเห็นแล้ว");
    }
  };

  return (
    <form onSubmit={save}>
      <FormError error={action.error} />
      {entry.repliedAt && (
        <p className="mb-2 text-xs text-faint">บันทึกคำตอบล่าสุดเมื่อ {formatThaiDateTime(entry.repliedAt)}</p>
      )}
      <Field label="คำตอบหรือสิ่งที่ดำเนินการ">
        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          maxLength={2000}
          placeholder="พิมพ์คำตอบหรือสิ่งที่ดำเนินการแล้ว"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
      </Field>
      <Field label="สถานะ">
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{label(feedbackStatusLabels, s)}</option>)}
        </select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary gap-2 flex-1 py-2" disabled={action.busy}>
          <Save className="w-3.5 h-3.5" />
          บันทึกคำตอบ
        </button>
        {canPublish && (
          entry.isPublished ? (
            <button type="button" className="btn btn-outline gap-2 py-2 px-3" disabled={action.busy} onClick={() => setPublished(false)}>
              <EyeOff className="w-3.5 h-3.5" />
              หยุดเผยแพร่
            </button>
          ) : (
            <button type="button" className="btn btn-outline gap-2 py-2 px-3" disabled={action.busy} onClick={() => setPublished(true)}>
              <Eye className="w-3.5 h-3.5" />
              เผยแพร่
            </button>
          )
        )}
      </div>
    </form>
  );
}

export default function FeedbackPage() {
  useDocumentTitle("ความคิดเห็น");
  const { role, status: session } = useRole();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [respondentFilter, setRespondentFilter] = useState("all");
  const [contextFilter, setContextFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const isManager = session === "authenticated" && (role === "staff" || role === "admin");
  const canPublish = isManager && (role === "staff" || role === "admin");
  const resource = useApiResource<FeedbackEntry[]>(
    () => (session === "loading" ? new Promise<never>(() => {}) : loadFeedbackStrict(role)),
    [session, role, reload]
  );
  // Keep the last list on screen while reloading after a change.
  const [entries, setEntries] = useState<FeedbackEntry[] | null>(null);
  useEffect(() => {
    if (resource.status === "success") setEntries(resource.data);
  }, [resource.status, resource.data]);

  if (entries === null) {
    if (resource.status === "error") return <div className="p-6"><ErrorState error={resource.error} onRetry={resource.retry} /></div>;
    return <div className="p-6"><LoadingState title="กำลังโหลดความคิดเห็น…" /></div>;
  }

  const sources = Array.from(new Set(entries.map((f) => f.source).filter((s) => s !== "—"))).sort();
  const respondentTypes = Array.from(new Map(entries
    .filter((f) => f.respondentTypeId != null)
    .map((f) => [f.respondentTypeId as number, f.respondentTypeName || `ประเภท ${f.respondentTypeId}`])).entries());
  const contexts = Array.from(new Map(entries.flatMap((f) => [
    ...(f.partnerId != null ? [[`partner:${f.partnerId}`, `หน่วยงาน: ${f.org}`] as const] : []),
    ...(f.activityId != null ? [[`activity:${f.activityId}`, `กิจกรรม: ${f.activity}`] as const] : []),
    ...(f.documentId != null ? [[`document:${f.documentId}`, `เอกสาร #${f.documentId}`] as const] : []),
    ...(f.exchangeId != null ? [[`exchange:${f.exchangeId}`, `แลกเปลี่ยน #${f.exchangeId}`] as const] : []),
  ])).entries());
  const filtered = entries.filter((f) =>
    matchesQuery(search, f.title, f.comment, f.org, f.activity)
    && (sourceFilter === "all" || f.source === sourceFilter)
    && (ratingFilter === "all" || f.rating === parseInt(ratingFilter))
    && (respondentFilter === "all" || String(f.respondentTypeId) === respondentFilter)
    && (statusFilter === "all" || f.status === statusFilter)
    && (!dateFrom || (f.dateIso != null && f.dateIso >= dateFrom))
    && (!dateTo || (f.dateIso != null && f.dateIso <= dateTo))
    && (contextFilter === "all" || [
      f.partnerId != null ? `partner:${f.partnerId}` : "",
      f.activityId != null ? `activity:${f.activityId}` : "",
      f.documentId != null ? `document:${f.documentId}` : "",
      f.exchangeId != null ? `exchange:${f.exchangeId}` : "",
    ].includes(contextFilter)));

  // Until the user picks an entry, show the first one in the list.
  const selected = entries.find((f) => f.id === (selectedId ?? filtered[0]?.id));
  const avg = averageRating(entries);

  const saved = (message: string) => {
    setNotice(message);
    setReload((n) => n + 1);
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs mb-1.5 text-faint">
          <Link href="/" className="text-faint hover:text-crimson">
            หน้าหลัก
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-crimson">ความคิดเห็น</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink font-display">ความคิดเห็น</h1>
        <p className="text-sm mt-0.5 text-faint">
          {isManager ? "ความคิดเห็นจากทุกช่องทาง ทั้งที่เผยแพร่และยังไม่เผยแพร่" : "ความคิดเห็นที่เผยแพร่แล้ว"}
        </p>
      </div>

      <Notice text={notice} />

      {session === "authenticated" && role !== "public" && <FeedbackSubmitForm onCreated={() => { setNotice("ส่งความคิดเห็นแล้ว"); setReload((n) => n + 1); }} />}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        {[
          { label: "ทั้งหมด", value: entries.length, color: "text-crimson" },
          { label: "คะแนนเฉลี่ย", value: avg == null ? "—" : `${avg.toFixed(1)}★`, color: "text-gold-dark" },
          { label: "ตรวจสอบแล้ว", value: entries.filter((f) => f.status === "reviewed").length, color: "text-green-600" },
          { label: "รอตรวจสอบ", value: entries.filter((f) => f.status === "pending").length, color: "text-gold-dark" },
          { label: "ช่องทาง", value: sources.length, color: "text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-white shadow-card p-4">
            <div className={`text-xl font-bold mb-0.5 ${s.color} font-display`}>
              {s.value}
            </div>
            <div className="text-xs text-faint">{s.label}</div>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState title="ยังไม่มีความคิดเห็น" message={isManager ? "ความคิดเห็นที่ได้รับจะแสดงที่นี่" : undefined} />
      ) : (
      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        {/* List */}
        <div>
          <div className="rounded-lg bg-white shadow-card p-4 mb-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                <input
                  className="w-full rounded-md border border-line bg-white px-3 py-2 pl-9 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
                  placeholder="ค้นหาความคิดเห็น"
                  aria-label="ค้นหาความคิดเห็น"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
                style={{ width: "auto", minWidth: 180 }}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                aria-label="ช่องทาง"
              >
                <option value="all">ช่องทาง: ทั้งหมด</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {isManager && <select className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink" value={respondentFilter} onChange={(e) => setRespondentFilter(e.target.value)} aria-label="ประเภทผู้ส่ง">
                <option value="all">ทุกประเภทผู้ส่ง</option>
                {respondentTypes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>}
              <select className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink" value={contextFilter} onChange={(e) => setContextFilter(e.target.value)} aria-label="บริบท">
                <option value="all">ทุกบริบท</option>
                {contexts.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
              <select className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="สถานะ">
                <option value="all">ทุกสถานะ</option>
                {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{label(feedbackStatusLabels, s)}</option>)}
              </select>
              <label className="text-xs text-faint flex items-center gap-2">ตั้งแต่ <input type="date" className="rounded-md border border-line bg-white px-2 py-2 text-sm text-ink" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
              <label className="text-xs text-faint flex items-center gap-2">ถึง <input type="date" className="rounded-md border border-line bg-white px-2 py-2 text-sm text-ink" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
              <select
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-crimson"
                style={{ width: "auto", minWidth: 140 }}
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                aria-label="คะแนน"
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
            {filtered.length === 0 && (
              <p className="rounded-lg bg-white shadow-card p-6 text-center text-sm text-faint">ไม่พบความคิดเห็นที่ตรงกับตัวกรอง</p>
            )}
            {filtered.map((f) => (
              <button
                type="button"
                key={f.id}
                className="block w-full text-left rounded-lg bg-white shadow-card p-4 cursor-pointer transition-all hover:shadow-card-hover border"
                style={{
                  borderColor: selected?.id === f.id ? "#8B1538" : "#E5E7EB",
                  borderWidth: selected?.id === f.id ? 2 : 1,
                }}
                onClick={() => setSelectedId(f.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold leading-snug flex-1 text-ink">
                    {f.title}
                  </p>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {isManager && !f.isPublished && <span className="badge badge-gray">ยังไม่เผยแพร่</span>}
                    <span className={`badge ${statusColors[f.status] ?? "badge-gray"}`}>{label(feedbackStatusLabels, f.status)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {f.source !== "—" && (
                    <span className={`badge ${sourceColors[f.source] ?? "badge-gray"} text-xs`}>{f.source}</span>
                  )}
                  <StarRow rating={f.rating} />
                  <span className="text-xs text-faint">{f.date}</span>
                  {isManager && f.reply && <span className="text-xs text-green-700">มีคำตอบแล้ว</span>}
                </div>
                {f.org !== "—" && (
                  <div className="text-xs mt-1.5 text-faint">
                    🏢 {f.org}
                    {f.activity !== "—" && <> • 📅 {f.activity}</>}
                  </div>
                )}
              </button>
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
                  <div className="flex gap-1.5">
                    <span className={`badge ${statusColors[selected.status] ?? "badge-gray"}`}>{label(feedbackStatusLabels, selected.status)}</span>
                    {isManager && (
                      selected.isPublished
                        ? <span className="badge badge-green">เผยแพร่แล้ว</span>
                        : <span className="badge badge-gray">ยังไม่เผยแพร่</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
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
                      {selected.rating ? `${selected.rating} / 5` : "—"}
                    </span>
                  </div>
                  <div className="text-xs text-faint">{selected.date}</div>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                {[
                  { label: "ช่องทาง", value: selected.source },
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
                  {selected.comment || "—"}
                </p>
              </div>

              {isManager && (
                <ReplyForm key={`${selected.id}-${selected.repliedAt}-${selected.status}-${selected.isPublished}`} entry={selected} canPublish={canPublish} onSaved={saved} />
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
