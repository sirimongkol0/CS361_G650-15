"use client";

// Feedback list. Everyone sees published entries with the staff reply (GET /feedback/);
// students see their own submissions (GET /feedback/mine). Staff/admin see every entry,
// coordinators the entries about records they own, and both can reply, review
// (PATCH /feedback/{id}) and record improvements. Only staff/admin publish.
// The sender type follows the role; only staff/admin pick it (#101).

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Search, ChevronRight, Star, X, MessageSquare, Save, Eye, EyeOff } from "lucide-react";
import { apiGetList, apiPatch, apiPost, formatThaiDateTime, loadExchangeStudents, loadFeedbackStrict, useApiResource, type FeedbackEntry } from "@/lib/api";
import { averageRating } from "@/lib/dashboard-data";
import { useRole } from "@/lib/role-context";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-states";
import { Field, FormError, Notice, inputCls, useAction } from "@/components/form-ui";
import { matchesQuery, useDocumentTitle } from "@/lib/list-tools";
import { feedbackStatusLabels, label } from "@/lib/labels";
import { ImprovementSection } from "@/components/improvement-section";
import { StatusBadge } from "@/components/status-badge";

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

type ContextType = "partner" | "document" | "activity" | "exchange";
type Choice = { id: number; name: string };

const CONTEXTS: { type: ContextType; label: string; pick: string; param: string }[] = [
  { type: "activity", label: "กิจกรรม", pick: "เลือกกิจกรรม", param: "activityId" },
  { type: "exchange", label: "การแลกเปลี่ยน", pick: "เลือกรายการแลกเปลี่ยน", param: "exchangeId" },
  { type: "partner", label: "หน่วยงาน", pick: "เลือกหน่วยงาน", param: "partnerId" },
  { type: "document", label: "ข้อตกลง", pick: "เลือกข้อตกลง", param: "documentId" },
];

const NO_RATING = "";

function FeedbackSubmitForm({ role, onCreated }: { role: string; onCreated: () => void }) {
  const canPickSender = role === "staff" || role === "admin";
  const [types, setTypes] = useState<Array<{ id: number; name_th: string; code: string }>>([]);
  const [choices, setChoices] = useState<Record<ContextType, Choice[]>>({ partner: [], document: [], activity: [], exchange: [] });
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [respondentTypeId, setRespondentTypeId] = useState("");
  const [contextType, setContextType] = useState<ContextType>("activity");
  const [contextId, setContextId] = useState("");
  const [rating, setRating] = useState("5");
  const action = useAction();

  useEffect(() => {
    const names = (rows: Array<{ id: number; name: string }>) => rows.map(({ id, name }) => ({ id, name }));
    void Promise.all([
      canPickSender ? apiGetList<{ id: number; name_th: string; code: string }>("/feedback/respondent-types") : Promise.resolve([]),
      apiGetList<Choice>("/partners/").then(names),
      apiGetList<Choice>("/documents/").then(names),
      apiGetList<Choice>("/activities/").then(names),
      // Own records, published or not: GET /exchange/ lists only published ones.
      loadExchangeStudents(role).then((rows) => rows.map(({ id, name }) => ({ id, name }))),
    ]).then(([respondents, partner, document, activity, exchange]) => {
      setTypes(respondents);
      setRespondentTypeId(String(respondents.find((type) => type.code === "staff")?.id ?? respondents[0]?.id ?? ""));
      const loaded = { partner, document, activity, exchange };
      setChoices(loaded);
      const params = new URLSearchParams(window.location.search);
      const preset = CONTEXTS.find(({ type, param }) =>
        loaded[type].some((row) => String(row.id) === params.get(param)));
      const initial = preset?.type ?? CONTEXTS.find(({ type }) => loaded[type].length)?.type ?? "activity";
      setContextType(initial);
      setContextId(preset ? String(params.get(preset.param)) : String(loaded[initial][0]?.id ?? ""));
    }).catch(() => undefined);
  }, [role, canPickSender]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!contextId || !comment.trim()) return;
    if (await action.run(() => apiPost("/feedback/", {
      title, comment,
      rating: rating === NO_RATING ? null : Number(rating),
      ...(canPickSender && respondentTypeId ? { respondent_type_id: Number(respondentTypeId) } : {}),
      [`${contextType}_id`]: Number(contextId),
    }))) {
      setTitle("");
      setComment("");
      onCreated();
    }
  };

  const current = CONTEXTS.find((c) => c.type === contextType)!;
  return (
    <form onSubmit={submit} className="rounded-lg bg-white shadow-card p-4 mb-5">
      <h2 className="font-semibold text-ink mb-3">ส่ง Feedback</h2>
      <FormError error={action.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="หัวข้อ *"><input className={inputCls} required maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        {canPickSender && (
          <Field label="ประเภทผู้ส่ง" hint="เลือกประเภทอื่นเมื่อบันทึกแทนบุคคลภายนอก ระบบจะบันทึกแหล่งที่มาเป็นการบันทึกโดยเจ้าหน้าที่">
            <select className={inputCls} required value={respondentTypeId} onChange={(e) => setRespondentTypeId(e.target.value)}>
              {types.map((type) => <option key={type.id} value={type.id}>{type.name_th || type.code}</option>)}
            </select>
          </Field>
        )}
        <Field label="ประเภทบริบท"><select className={inputCls} value={contextType} onChange={(e) => {
          const next = e.target.value as ContextType;
          setContextType(next);
          setContextId(String(choices[next][0]?.id ?? ""));
        }}>
          {CONTEXTS.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
        </select></Field>
        <Field label={current.pick}><select className={inputCls} required value={contextId} onChange={(e) => setContextId(e.target.value)}>
          {choices[contextType].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></Field>
        <Field label="คะแนน"><select className={inputCls} value={rating} onChange={(e) => setRating(e.target.value)}>
          {[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} / 5</option>)}
          <option value={NO_RATING}>ไม่ระบุคะแนน</option>
        </select></Field>
      </div>
      <Field label="ความคิดเห็น *"><textarea className={`${inputCls} resize-y`} rows={3} required maxLength={4000} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
      <button className="btn btn-primary" disabled={action.busy || !choices[contextType].length}>ส่งความคิดเห็น</button>
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

  // Reviewers reply and mark entries reviewed; coordinators only for records they own.
  const isManager = session === "authenticated" && (role === "coordinator" || role === "staff" || role === "admin");
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
    <div className="p-6 max-w-(--breakpoint-xl) mx-auto">
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
          {role === "coordinator" && isManager
            ? "ความคิดเห็นเกี่ยวกับหน่วยงาน ข้อตกลง กิจกรรม และการแลกเปลี่ยนที่คุณดูแล"
            : isManager ? "ความคิดเห็นจากทุกช่องทาง ทั้งที่เผยแพร่และยังไม่เผยแพร่"
            : role === "student" ? "ความคิดเห็นที่คุณส่งและคำตอบจากเจ้าหน้าที่" : "ความคิดเห็นที่เผยแพร่แล้ว"}
        </p>
      </div>

      <Notice text={notice} />

      {session === "authenticated" && role !== "public" && <FeedbackSubmitForm role={role} onCreated={() => { setNotice("ส่งความคิดเห็นแล้ว"); setReload((n) => n + 1); }} />}

      {session === "authenticated" && role === "coordinator" && (
        <div className="rounded-lg bg-white shadow-card p-5 mb-5">
          <p className="text-xs text-faint">สิ่งที่ปรับปรุงจากความคิดเห็นเกี่ยวกับรายการที่คุณดูแล</p>
          <ImprovementSection canDelete={false} />
        </div>
      )}

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
                  className="w-full rounded-md border border-line bg-white px-3 py-2 pl-9 text-sm text-ink focus:outline-hidden focus:ring-1 focus:ring-crimson"
                  placeholder="ค้นหาความคิดเห็น"
                  aria-label="ค้นหาความคิดเห็น"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-1 focus:ring-crimson"
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
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-1 focus:ring-crimson"
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
                  <div className="flex gap-1.5 shrink-0">
                    {isManager && !f.isPublished && <span className="badge badge-gray">ยังไม่เผยแพร่</span>}
                    <StatusBadge kind="feedback" status={f.status}>{label(feedbackStatusLabels, f.status)}</StatusBadge>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {f.source !== "—" && (
                    <span className={`badge ${sourceColors[f.source] ?? "badge-gray"} text-xs`}>{f.source}</span>
                  )}
                  <StarRow rating={f.rating} />
                  <span className="text-xs text-faint">{f.date}</span>
                  {f.reply && <span className="text-xs text-green-700">มีคำตอบแล้ว</span>}
                  {isManager && f.improvementCount > 0 && <span className="text-xs text-green-700">ปรับปรุง {f.improvementCount} รายการ</span>}
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
                    <StatusBadge kind="feedback" status={selected.status}>{label(feedbackStatusLabels, selected.status)}</StatusBadge>
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

              {!isManager && selected.reply && (
                <div className="p-4 rounded-lg mb-5 border border-green-200 bg-green-50">
                  <div className="text-sm font-semibold text-ink mb-1">คำตอบจากเจ้าหน้าที่</div>
                  <p className="text-sm leading-relaxed text-mute">{selected.reply}</p>
                  {selected.repliedAt && <div className="text-xs text-faint mt-1">{formatThaiDateTime(selected.repliedAt)}</div>}
                </div>
              )}
              {isManager && (
                <ReplyForm key={`${selected.id}-${selected.repliedAt}-${selected.status}-${selected.isPublished}`} entry={selected} canPublish={canPublish} onSaved={saved} />
              )}
              {isManager && (
                <ImprovementSection key={selected.id} feedbackId={selected.id} canDelete={canPublish} onChanged={() => setReload((n) => n + 1)} />
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
