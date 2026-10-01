// Date-only values are calendar dates, independent of the browser timezone.
const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const kindLabels: Record<string, string> = {
  announcement: "วันประกาศ", deadline: "กำหนดส่ง / สมัคร",
  application_open: "วันเปิดรับสมัคร", application_close: "วันปิดรับสมัคร",
  period_start: "เริ่มช่วงเวลา", period_end: "สิ้นสุดช่วงเวลา",
};

export function activityDateLabel(iso: string | null | undefined, kind?: string | null, precision?: string | null): string {
  if (!iso) return "ไม่ระบุวันที่";
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return "ไม่ระบุวันที่";
  const year = parsed.getUTCFullYear() + 543;
  const month = thaiMonths[parsed.getUTCMonth()];
  const date = precision === "year" ? `${year}`
    : precision === "month" ? `${month} ${year}`
    : `${parsed.getUTCDate()} ${month} ${year}`;
  const prefix = kind && kindLabels[kind] ? `${kindLabels[kind]}: ` : "";
  return `${prefix}${precision === "approximate" ? "ประมาณ " : ""}${date}`;
}

export function activityStatusLabel(status?: string | null): { status: string; statusColor: string } {
  const value = status?.trim() || "ไม่ระบุ";
  const colors: Record<string, string> = {
    "เสร็จสิ้น": "badge-green", "วางแผน": "badge-purple", "กำลังดำเนินการ": "badge-blue",
  };
  return { status: value, statusColor: colors[value] ?? "badge-gray" };
}

/** Known dates descending, unknown last, ID descending for a stable tie-break. */
export function latestActivities<T extends { id: number; startDate: string | null }>(items: T[], limit = 5): T[] {
  return [...items].sort((a, b) => {
    const aDate = a.startDate ?? "";
    const bDate = b.startDate ?? "";
    return bDate.localeCompare(aDate) || b.id - a.id;
  }).slice(0, limit);
}
