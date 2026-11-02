import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { statusTones, type StatusKind, type StatusTone } from "@/lib/labels";

/** A status shown as a coloured label. The colour comes from the shared map in lib/labels.ts,
 *  so the same status looks the same on every page. Display only: never make it clickable. */
export function StatusBadge({ kind, status, children }: {
  kind: StatusKind;
  status: string | null | undefined;
  children: ReactNode;
}) {
  const tones: Record<string, StatusTone> = statusTones[kind];
  return <Badge variant={(status && tones[status]) || "gray"}>{children}</Badge>;
}
