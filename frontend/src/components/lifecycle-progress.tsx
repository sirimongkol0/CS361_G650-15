import { Check, X } from "lucide-react";
import { documentStatusLabels } from "@/lib/labels";

// The agreement's normal path; mirrors TRANSITIONS in backend/routers/documents.py.
// "expiring" is still in force, so it shows as the มีผล step.
const STEPS = ["draft", "approved", "active", "expired"] as const;
const STEP_OF: Record<string, number> = { draft: 0, approved: 1, active: 2, expiring: 2, expired: 3 };

/** Where an agreement is in its lifecycle. A display of state, not navigation:
 *  the current step has aria-current="step" and every step says in text whether it is
 *  done, current or still ahead, so colour is never the only cue. */
export function LifecycleProgress({ status }: { status: string }) {
  const cancelled = status === "cancelled";
  const current = cancelled ? -1 : STEP_OF[status] ?? 0;
  return (
    <div className="mb-3">
      <ol aria-label="ขั้นตอนของข้อตกลง" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
        {STEPS.map((step, index) => {
          const done = index < current;
          const isCurrent = index === current;
          return (
            <li key={step} className="flex items-center gap-1" aria-current={isCurrent ? "step" : undefined}>
              <span
                aria-hidden
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  isCurrent ? "border-crimson bg-crimson text-white"
                    : done ? "border-crimson bg-crimson-light text-crimson"
                    : "border-line bg-white text-faint"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className={isCurrent ? "font-semibold text-crimson" : done ? "text-ink" : "text-faint"}>
                {documentStatusLabels[step]}
              </span>
              <span className="sr-only">
                {cancelled ? "(ไม่ได้ดำเนินการต่อ)" : done ? "(ผ่านแล้ว)" : isCurrent ? "(ขั้นปัจจุบัน)" : "(ยังไม่ถึง)"}
              </span>
              {index < STEPS.length - 1 && <span aria-hidden className={`mx-1 h-px w-5 ${done ? "bg-crimson" : "bg-line"}`} />}
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-mute">
          <X className="h-3.5 w-3.5" aria-hidden />
          {documentStatusLabels.cancelled} ข้อตกลงนี้ไม่ดำเนินการต่อ
        </p>
      )}
    </div>
  );
}
