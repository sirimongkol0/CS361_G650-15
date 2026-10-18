"use client";

// Shared building blocks for the V3 add/edit forms: a dialog, labelled fields
// and an error line. Every form submits through the API helpers in lib/api.ts,
// so the backend's role checks and Thai error messages apply everywhere.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { apiErrorMessage } from "@/lib/api";

export const inputCls =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-[#CBD5E1] focus:border-crimson focus:ring-[3px] focus:ring-crimson/10 disabled:bg-soft disabled:text-faint";

/** Modal dialog using the native <dialog> (focus trap, Esc to close). */
export function Dialog({
  open, title, onClose, children, wide = false,
}: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-base bg-white p-0 shadow-card backdrop:bg-black/40`}
      aria-label={title}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold text-ink">{title}</h2>
            <button type="button" className="btn p-1.5 text-faint hover:bg-soft" onClick={onClose} aria-label="ปิด">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Labelled control; the hint sits outside the <label> so it is not part of the field's name. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      {apiErrorMessage(error)}
    </p>
  );
}

export function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
      <CheckCircle2 className="h-4 w-4" />
      {text}
    </p>
  );
}

/**
 * Run an API action with busy/error state: `run(fn)` returns true on success.
 * Keeps forms from double-submitting and shows the backend's reason on failure.
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, clear: () => setError(null) };
}

/** Empty strings from inputs become null so optional API fields stay unset. */
export const orNull = (value: string) => (value.trim() === "" ? null : value.trim());
