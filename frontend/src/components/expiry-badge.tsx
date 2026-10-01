import { daysFromToday, relativeDays } from "@/lib/list-tools";
import { EXPIRING_WITHIN_DAYS } from "@/lib/dashboard-data";

/* Warning for agreements that end within EXPIRING_WITHIN_DAYS or have already ended. */
export function ExpiryBadge({ expiryDate, withText = false }: { expiryDate: string | null; withText?: boolean }) {
  const days = daysFromToday(expiryDate);
  if (days === null) return null;
  if (days < 0) {
    return <span className="badge badge-gray" title={relativeDays(days, "เหลืออีก", "สิ้นสุดเมื่อ")}>
      หมดอายุแล้ว{withText && ` · ${relativeDays(days, "เหลืออีก", "สิ้นสุดเมื่อ")}`}
    </span>;
  }
  if (days <= EXPIRING_WITHIN_DAYS) {
    return <span className="badge badge-gold" title={relativeDays(days, "เหลืออีก", "สิ้นสุดเมื่อ")}>
      ใกล้หมดอายุ · {relativeDays(days, "เหลืออีก", "สิ้นสุดเมื่อ")}
    </span>;
  }
  return withText ? <span className="badge badge-green">{relativeDays(days, "เหลืออีก", "สิ้นสุดเมื่อ")}</span> : null;
}
