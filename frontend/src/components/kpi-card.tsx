import type { ElementType, ReactNode } from "react";
import Link from "next/link";

/* One colour per kind of figure, the same on every dashboard and report. */
const TONES = {
  crimson: "bg-crimson-muted text-crimson", // partners
  amber: "bg-[#FEF3C7] text-[#B45309]", // agreements, expiring
  blue: "bg-[#DBEAFE] text-[#1D4ED8]", // activities
  green: "bg-[#DCFCE7] text-[#15803D]", // outcomes
  purple: "bg-[#EDE9FE] text-[#6D28D9]", // feedback
} as const;

export type KpiTone = keyof typeof TONES;

const cardClass =
  "stat-card block rounded-base bg-white p-5 shadow-card transition-all duration-150 hover:-translate-y-px hover:shadow-card-hover";

/** A headline figure: icon, value and label, with optional extra lines (notes, change)
 *  as children. With href the whole card is a link. */
export function KpiCard({ icon: Icon, label, value, tone, href, title, children }: {
  icon: ElementType;
  label: ReactNode;
  value: ReactNode;
  tone: KpiTone;
  href?: string;
  title?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="mb-0.5 font-display text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-faint">{label}</div>
      {children}
    </>
  );
  return href
    ? <Link href={href} title={title} className={cardClass}>{body}</Link>
    : <div className={cardClass}>{body}</div>;
}
