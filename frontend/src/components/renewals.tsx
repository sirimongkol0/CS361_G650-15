"use client";

// V4-7: the renewal decision form, the renewal figures on /reports and the
// chain of agreement versions on the partner report.

import { useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  formatThaiDate, loadPartnerTimeline, loadRenewalChains, recordRenewalDecision, useApiResource,
  type RenewalDecision, type RenewalFigures,
} from "@/lib/api";
import { beYear } from "@/lib/dashboard-data";
import { documentStatusLabels, label } from "@/lib/labels";
import { Dialog, Field, FormError, inputCls, useAction } from "@/components/form-ui";
import { ErrorState, LoadingState } from "@/components/data-states";

export const renewalDecisionLabels: Record<RenewalDecision, string> = {
  renew: "ต่ออายุ", revise: "ปรับปรุง", terminate: "ยุติ",
};

const card = "bg-white border border-line rounded-lg shadow-card p-5 break-inside-avoid";
const percent = (rate: number | null) => (rate === null ? "–" : `${Math.round(rate * 100)}%`);

/** Partner figures from /reports/partners/[id], so the decision is made with the record in view. */
function PartnerContext({ partnerId }: { partnerId: number }) {
  const report = useApiResource(() => loadPartnerTimeline(partnerId), [partnerId]);
  if (report.status === "loading") return <LoadingState />;
  if (report.status === "error") return <ErrorState error={report.error} onRetry={report.retry} />;
  const { totals, timeline } = report.data;
  const last = [...timeline].reverse().find((row) => row.activities + row.outcomes + row.feedback > 0);
  return (
    <div className="mb-4 rounded-lg bg-soft p-3 text-sm">
      <p className="text-ink">
        กิจกรรม {totals.activities} • ผลลัพธ์ {totals.outcomes} • Feedback {totals.feedback} • ข้อตกลง {totals.agreements}
      </p>
      <p className="mt-1 text-xs text-faint">
        {last ? `มีความเคลื่อนไหวล่าสุดในปี ${beYear(last.year)}` : "ยังไม่มีกิจกรรมที่บันทึกไว้"} •{" "}
        <Link href={`/reports/partners/${partnerId}`} className="text-crimson hover:underline">ดูรายงานหน่วยงาน</Link>
      </p>
    </div>
  );
}

export function RenewalDecisionDialog({
  agreement, onClose, onDone,
}: {
  agreement: { id: number; name: string; partnerId: number | null } | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [decision, setDecision] = useState<RenewalDecision>("renew");
  const [reason, setReason] = useState("");
  const action = useAction();

  const close = () => { setDecision("renew"); setReason(""); action.clear(); onClose(); };
  const submit = async () => {
    if (!agreement) return;
    const ok = await action.run(async () => {
      const result = await recordRenewalDecision(agreement.id, decision, reason);
      onDone(result.renewal
        ? `บันทึกการ${renewalDecisionLabels[decision]}แล้ว สร้างฉบับร่างใหม่ "${result.renewal.name}"`
        : "บันทึกการยุติข้อตกลงแล้ว");
    });
    if (ok) close();
  };

  return (
    <Dialog open={agreement !== null} title={`ตัดสินใจต่อข้อตกลง: ${agreement?.name ?? ""}`} onClose={close}>
      {agreement?.partnerId && <PartnerContext partnerId={agreement.partnerId} />}
      <FormError error={action.error} />
      <fieldset className="mb-3">
        <legend className="mb-1 text-sm font-medium text-ink">การตัดสินใจ</legend>
        <div className="flex gap-4">
          {(Object.keys(renewalDecisionLabels) as RenewalDecision[]).map((key) => (
            <label key={key} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="radio" name="renewal-decision" value={key} checked={decision === key}
                onChange={() => setDecision(key)} />
              {renewalDecisionLabels[key]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-faint">
          {decision === "terminate" ? "ไม่สร้างฉบับใหม่" : "สร้างฉบับร่างใหม่โดยคัดลอกข้อมูลจากฉบับเดิม"}
        </p>
      </fieldset>
      <Field label="เหตุผล">
        <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-outline text-sm" onClick={close}>ยกเลิก</button>
        <button type="button" className="btn btn-primary text-sm" disabled={action.busy || !reason.trim()} onClick={submit}>
          บันทึกการตัดสินใจ
        </button>
      </div>
    </Dialog>
  );
}

/** Renewal and activation rates for /reports (current state). */
export function RenewalSummary({ figures }: { figures: RenewalFigures }) {
  return (
    <section className={`${card} mt-5`}>
      <h2 className="font-bold mb-1 text-ink">การต่ออายุและการเปิดใช้ข้อตกลง</h2>
      <p className="text-xs mb-4 text-faint">ข้อมูล ณ วันนี้ ไม่รวมฉบับร่างและที่ยกเลิก</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-2xl font-bold text-ink font-display">{percent(figures.renewalRate)}</div>
          <div className="text-xs text-faint">อัตราการต่ออายุ ({figures.renewed} จาก {figures.due} ฉบับที่ถึงกำหนดหรือตัดสินใจแล้ว)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-ink font-display">{percent(figures.activationRate)}</div>
          <div className="text-xs text-faint">อัตราการเปิดใช้ ({figures.activated} จาก {figures.agreements} ฉบับที่มีกิจกรรมจริง)</div>
        </div>
      </div>
    </section>
  );
}

/** Each chain of versions, first to current, for the partner report. */
export function RenewalChain({ partnerId }: { partnerId: number }) {
  const chains = useApiResource(() => loadRenewalChains(partnerId), [partnerId]);
  return (
    <section className={`${card} mt-5`}>
      <h2 className="font-bold mb-3 text-ink flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-crimson" aria-hidden />ประวัติการต่ออายุข้อตกลง
      </h2>
      {chains.status === "loading" && <LoadingState />}
      {chains.status === "error" && <ErrorState error={chains.error} onRetry={chains.retry} />}
      {chains.status === "success" && (chains.data.chains.length === 0
        ? <p className="text-sm text-faint">ยังไม่มีข้อตกลง</p>
        : (
          <div className="space-y-4">
            {chains.data.chains.map((chain) => (
              <ol key={chain[0].id} className="border-l-2 border-line pl-4 space-y-2" aria-label={`สายข้อตกลง ${chain[0].name}`}>
                {chain.map((version, i) => (
                  <li key={version.id} className="text-sm">
                    <div className="text-ink">
                      <span className="text-xs text-faint mr-2">ฉบับที่ {i + 1}</span>
                      <Link href={`/documents/${version.id}`} className="hover:text-crimson">{version.name}</Link>
                      <span className="ml-2 text-xs text-faint">{version.status ? label(documentStatusLabels, version.status) : "ไม่ระบุสถานะ"}</span>
                    </div>
                    <div className="text-xs text-faint">
                      {version.effectiveDate ? formatThaiDate(version.effectiveDate) : "ไม่ระบุวันเริ่ม"} – {version.expiryDate ? formatThaiDate(version.expiryDate) : "ไม่ระบุวันสิ้นสุด"}
                    </div>
                    {version.decision && (
                      <div className="text-xs text-mute mt-0.5">
                        ตัดสินใจ: {renewalDecisionLabels[version.decision]}{version.reason && ` — ${version.reason}`}
                        {version.decidedAt && ` (${formatThaiDate(version.decidedAt)})`}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ))}
          </div>
        ))}
    </section>
  );
}
