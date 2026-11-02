import { Check } from "lucide-react";

/** Read-only progress through fixed steps (agreement lifecycle, import stages). It shows
 *  state, not navigation: the current step has aria-current="step" and every step says in
 *  text whether it is done, current or still ahead, so colour is never the only cue.
 *  `current` is the index of the current step; steps.length means all done. `stopped`
 *  marks a process that ended early (cancelled, rolled back), so no step is current. */
export function StepProgress({ label, steps, current, stopped = false }: {
  label: string;
  steps: string[];
  current: number;
  stopped?: boolean;
}) {
  const at = stopped ? -1 : current;
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
      {steps.map((step, index) => {
        const done = index < at;
        const isCurrent = index === at;
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
            <span className={isCurrent ? "font-semibold text-crimson" : done ? "text-ink" : "text-faint"}>{step}</span>
            <span className="sr-only">
              {stopped ? "(ไม่ได้ดำเนินการต่อ)" : done ? "(ผ่านแล้ว)" : isCurrent ? "(ขั้นปัจจุบัน)" : "(ยังไม่ถึง)"}
            </span>
            {index < steps.length - 1 && <span aria-hidden className={`mx-1 h-px w-5 ${done ? "bg-crimson" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
