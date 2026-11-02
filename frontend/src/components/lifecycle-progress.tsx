import { X } from "lucide-react";
import { StepProgress } from "@/components/step-progress";
import { documentStatusLabels } from "@/lib/labels";

// The agreement's normal path; mirrors TRANSITIONS in backend/routers/documents.py.
// "expiring" is still in force, so it shows as the มีผล step.
const STEPS = ["draft", "approved", "active", "expired"] as const;
const STEP_OF: Record<string, number> = { draft: 0, approved: 1, active: 2, expiring: 2, expired: 3 };

/** Where an agreement is in its lifecycle. A cancelled agreement may have stopped at any
 *  step, so it shows every step as not reached plus a note. */
export function LifecycleProgress({ status }: { status: string }) {
  const cancelled = status === "cancelled";
  return (
    <div className="mb-3">
      <StepProgress
        label="ขั้นตอนของข้อตกลง"
        steps={STEPS.map((step) => documentStatusLabels[step])}
        current={STEP_OF[status] ?? 0}
        stopped={cancelled}
      />
      {cancelled && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-mute">
          <X className="h-3.5 w-3.5" aria-hidden />
          {documentStatusLabels.cancelled} ข้อตกลงนี้ไม่ดำเนินการต่อ
        </p>
      )}
    </div>
  );
}
