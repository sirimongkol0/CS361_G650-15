"use client";

// One confirmation dialog for the whole app, replacing window.confirm. Pages call
//   if (!(await confirm({ title, description, action }))) return;
// Title is the question and description the consequence (ui-writing-guide-th.md §3);
// the close button is "ยกเลิก" and the action button names what will happen. For
// destructive actions the two must not look alike ("ยกเลิก" next to "ยกเลิกข้อตกลง"),
// so the action is solid red with an icon and the header carries a warning icon.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  /** The question, e.g. ลบ “…” ใช่ไหม */
  title: string;
  /** What happens if the user goes ahead, e.g. การยกเลิกย้อนกลับไม่ได้ */
  description: string;
  /** Label of the button that goes ahead, e.g. ลบ */
  action: string;
  /** Red action button for deletes and other irreversible changes. */
  destructive?: boolean;
};

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept after closing so the text doesn't vanish during the exit animation.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  // A modal <dialog> (form-ui Dialog) makes everything outside it inert, so when one is
  // open the confirmation renders inside it instead of at the end of <body>.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const resolve = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>((done) => {
    resolve.current?.(false);
    resolve.current = done;
    setOptions(next);
    setContainer(document.querySelector<HTMLDialogElement>("dialog[open]"));
    setOpen(true);
  }), []);

  const finish = (ok: boolean) => {
    resolve.current?.(ok);
    resolve.current = null;
    setOpen(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(next) => { if (!next) finish(false); }}>
        <AlertDialogContent container={container}>
          <AlertDialogHeader>
            {options?.destructive && (
              <AlertDialogMedia className="bg-red-50 text-destructive">
                <TriangleAlert aria-hidden />
              </AlertDialogMedia>
            )}
            <AlertDialogTitle className="font-semibold">{options?.title}</AlertDialogTitle>
            <AlertDialogDescription>{options?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              variant={options?.destructive ? "danger" : "default"}
              onClick={() => finish(true)}
            >
              {options?.destructive && <TriangleAlert aria-hidden />}
              {options?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

/** Ask the user to confirm; resolves true only if they press the action button. */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}
