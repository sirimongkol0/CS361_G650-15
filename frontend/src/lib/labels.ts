/* Thai display labels for enum values returned by the API. Unknown values fall back to the raw value. */

export const activityTypeLabels: Record<string, string> = {
  official_event: "พิธีลงนาม / งานทางการ",
  collaboration_meeting: "ประชุมความร่วมมือ",
  exchange: "แลกเปลี่ยน",
  student_workshop_competition: "เวิร์กช็อป / การแข่งขันนักศึกษา",
  student_activity: "กิจกรรมนักศึกษา",
  engineering_camp: "ค่ายวิศวกรรม",
  seminar: "สัมมนา",
  academic_visit: "เยี่ยมชมทางวิชาการ",
  international_conference: "ประชุมวิชาการนานาชาติ",
};

export const partnerTypeLabels: Record<string, string> = {
  alumni: "ศิษย์เก่า",
  expert: "ผู้เชี่ยวชาญ",
  government: "หน่วยงานรัฐ",
  university: "มหาวิทยาลัย",
  network: "เครือข่าย",
  private_company: "บริษัทเอกชน",
  vocational: "สถาบันอาชีวศึกษา",
  healthcare: "สถานพยาบาล",
  international_organization: "องค์การระหว่างประเทศ",
};

export const label = (map: Record<string, string>, value: string | null | undefined) =>
  value ? map[value] ?? value : "—";

export const sourceTypeLabels: Record<string, string> = {
  demo_fixture: "ข้อมูลตัวอย่าง",
  test_fixture: "ข้อมูลสมมติสำหรับทดสอบ",
  official_news: "ข่าวทางการ",
  official_city_report: "รายงานทางการของเมือง",
  official_institution_page: "หน้าเว็บทางการของสถาบัน",
  official_institution_profile: "ข้อมูลทางการของสถาบัน",
  official_institution_source: "แหล่งข้อมูลทางการของสถาบัน",
  official_partner_source: "แหล่งข้อมูลทางการของหน่วยงาน",
};

/* Badge colour per activity type (keyed by the API enum, like activityTypeLabels). */
export const activityTypeColors: Record<string, string> = {
  official_event: "badge-crimson",
  collaboration_meeting: "badge-blue",
  exchange: "badge-green",
  student_workshop_competition: "badge-gold",
  student_activity: "badge-green",
  engineering_camp: "badge-gold",
  seminar: "badge-purple",
  academic_visit: "badge-indigo",
  international_conference: "badge-purple",
};

/* Cooperation level of a record (API field scopeLevel). Only "program" is CSTU-direct. */
export type ScopeLevel = "program" | "faculty" | "university";

export const scopeLevelLabels: Record<ScopeLevel, string> = {
  program: "หลักสูตร CSTU",
  faculty: "ระดับคณะ",
  university: "ระดับมหาวิทยาลัย",
};

/* Badge colour per cooperation level (same classes as activityTypeColors). */
export const scopeLevelColors: Record<ScopeLevel, string> = {
  program: "badge-crimson",
  faculty: "badge-blue",
  university: "badge-purple",
};

/* Unknown or missing values mean "not yet classified" (null). */
export const parseScopeLevel = (value: string | null | undefined): ScopeLevel | null =>
  value === "program" || value === "faculty" || value === "university" ? value : null;

/* Document type badges: agreement acronyms in their usual casing, templates in Thai. */
export const documentTypeLabels: Record<string, string> = {
  MOU: "MoU",
  MOA: "MoA",
  TEMPLATE: "แบบฟอร์ม",
};

/** Human-readable file size (KB/MB). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString("th-TH")} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const documentStatusLabels: Record<string, string> = {
  active: "ใช้งาน",
  expiring: "ใกล้หมดอายุ",
  expired: "หมดอายุ",
  draft: "อยู่ระหว่างจัดทำ",
};

// The shared demo banner carries this notice; downloadable PDFs keep theirs.
export const displayDescription = (value: string) =>
  process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    ? value.replace(/^ข้อมูลสมมติสำหรับสาธิตรายวิชา CS361 ไม่ใช่ข้อมูลหรือข้อตกลงจริงของ CSTU\s*/, "")
    : value;
