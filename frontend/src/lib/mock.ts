// MOCK DATA — รวม mock data ทั้งหมดจาก legacy/figma-mock (port มาเป็น TypeScript)
// ⚠️ ชั่วคราว: รอ V2+ ต่อ API จริง (lib/api.ts) แล้วจะลบ/แทนที่ไฟล์นี้ทั้งหมด
// NOTE: additive-only file — other agents may extend; do not remove existing exports.

// ---------- Public dashboard ----------
export interface PublicActivity {
  name: string;
  org: string;
  date: string;
  open: boolean;
}

export const publicActivities: PublicActivity[] = [
  { name: "อบรมเชิงปฏิบัติการ AI for Education", org: "National Taiwan University", date: "20 ส.ค. 2568", open: true },
  { name: "สัมมนาวิชาการนวัตกรรมการเรียนการสอน", org: "มหาวิทยาลัยเชียงใหม่", date: "15 ส.ค. 2568", open: false },
  { name: "Workshop Data Science for Business", org: "University of Malaya", date: "5 ส.ค. 2568", open: true },
  { name: "งาน Open Day สัมพันธ์ภาคอุตสาหกรรม", org: "สมาคมผู้ประกอบการ IT ไทย", date: "25 ก.ค. 2568", open: false },
];

export interface PublicPartner {
  name: string;
  type: string;
  country: string;
  initials: string;
  bg: string;
  color: string;
}

export const publicPartners: PublicPartner[] = [
  { name: "มหาวิทยาลัยเชียงใหม่", type: "มหาวิทยาลัย", country: "🇹🇭 ไทย", initials: "มช", bg: "#F5D6DE", color: "#8B1538" },
  { name: "National Taiwan University", type: "มหาวิทยาลัย", country: "🇹🇼 ไต้หวัน", initials: "NTU", bg: "#DBEAFE", color: "#1D4ED8" },
  { name: "University of Malaya", type: "มหาวิทยาลัย", country: "🇲🇾 มาเลเซีย", initials: "UM", bg: "#DCFCE7", color: "#15803D" },
  { name: "บริษัท เทคโนโลยี จำกัด", type: "บริษัทเอกชน", country: "🇹🇭 ไทย", initials: "TC", bg: "#FEF3C7", color: "#B45309" },
  { name: "บริษัท ABC จำกัด", type: "บริษัทเอกชน", country: "🇹🇭 ไทย", initials: "ABC", bg: "#EDE9FE", color: "#7C3AED" },
  { name: "Waseda University", type: "มหาวิทยาลัย", country: "🇯🇵 ญี่ปุ่น", initials: "WU", bg: "#FFE4E6", color: "#E11D48" },
];

// ---------- Student dashboard ----------
export interface StudentProject {
  name: string;
  org: string;
  date: string;
  status: string;
  statusColor: string;
}

export const studentProjects: StudentProject[] = [
  { name: "Student Exchange Program — NTU", org: "National Taiwan University", date: "ก.พ.–พ.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { name: "Research Internship — CRI", org: "Chulabhorn Research Institute", date: "ส.ค.–ก.ย. 2568", status: "วางแผน", statusColor: "badge-crimson" },
  { name: "อบรม AI for Education", org: "National Taiwan University", date: "20 ส.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
];

export interface StudentUpcomingActivity {
  name: string;
  date: string;
  location: string;
}

export const studentUpcomingActivities: StudentUpcomingActivity[] = [
  { name: "Workshop Data Science", date: "5 ก.ย. 2568", location: "ห้อง 301" },
  { name: "สัมมนาวิชาการนวัตกรรม", date: "12 ก.ย. 2568", location: "Auditorium" },
];

export interface StudentPendingFeedback {
  activity: string;
  deadline: string;
}

export const studentPendingFeedback: StudentPendingFeedback[] = [
  { activity: "อบรม AI for Education", deadline: "ภายใน 3 วัน" },
  { activity: "Research Internship CRI", deadline: "ภายใน 7 วัน" },
];

export interface StudentExchangeSummary {
  program: string;
  org: string;
  period: string;
  status: string;
}

export const studentExchange: StudentExchangeSummary = {
  program: "NTU Exchange Program",
  org: "National Taiwan University",
  period: "ก.พ.–พ.ค. 2568",
  status: "เสร็จสิ้น",
};

// ---------- Teacher dashboard ----------
export interface TeacherStakeholder {
  name: string;
  type: string;
  mou: number;
  initials: string;
  bg: string;
  color: string;
}

export const teacherStakeholders: TeacherStakeholder[] = [
  { name: "มหาวิทยาลัยเชียงใหม่", type: "มหาวิทยาลัย", mou: 2, initials: "มช", bg: "#F5D6DE", color: "#8B1538" },
  { name: "National Taiwan University", type: "มหาวิทยาลัย", mou: 1, initials: "NTU", bg: "#DBEAFE", color: "#1D4ED8" },
  { name: "บริษัท เทคโนโลยี จำกัด", type: "บริษัทเอกชน", mou: 1, initials: "TC", bg: "#FEF3C7", color: "#B45309" },
];

export interface TeacherActivity {
  name: string;
  org: string;
  date: string;
  status: string;
  statusColor: string;
  participants: number;
}

export const teacherActivities: TeacherActivity[] = [
  { name: "อบรมเชิงปฏิบัติการ AI for Education", org: "NTU", date: "20 ส.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green", participants: 45 },
  { name: "Workshop Data Science", org: "UM", date: "5 ก.ย. 2568", status: "กำลังวางแผน", statusColor: "badge-gold", participants: 30 },
  { name: "การเยี่ยมชมบริษัท", org: "บ.เทคโนฯ", date: "10 ส.ค. 2568", status: "กำลังดำเนินการ", statusColor: "badge-blue", participants: 25 },
];

export interface TeacherRecentFeedback {
  title: string;
  source: string;
  rating: number;
  date: string;
}

export const teacherRecentFeedback: TeacherRecentFeedback[] = [
  { title: "ความพึงพอใจการอบรม AI", source: "ผู้เข้าร่วม", rating: 5, date: "21 ส.ค. 2568" },
  { title: "Feedback ภาคอุตสาหกรรม", source: "คู่ความร่วมมือ", rating: 4, date: "18 ส.ค. 2568" },
];

// ---------- Staff dashboard ----------
export interface MonthlyActivityPoint {
  month: string;
  กิจกรรม: number;
}

export const staffMonthlyActivities: MonthlyActivityPoint[] = [
  { month: "ม.ค.", กิจกรรม: 8 }, { month: "ก.พ.", กิจกรรม: 12 }, { month: "มี.ค.", กิจกรรม: 15 },
  { month: "เม.ย.", กิจกรรม: 10 }, { month: "พ.ค.", กิจกรรม: 18 }, { month: "มิ.ย.", กิจกรรม: 22 },
  { month: "ก.ค.", กิจกรรม: 19 }, { month: "ส.ค.", กิจกรรม: 25 },
];

export interface StaffRecentActivity {
  name: string;
  org: string;
  date: string;
  status: string;
  statusColor: string;
}

export const staffRecentActivities: StaffRecentActivity[] = [
  { name: "อบรม AI for Education", org: "NTU", date: "20 ส.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { name: "สัมมนาวิชาการนวัตกรรม", org: "มช.", date: "15 ส.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { name: "ศึกษาดูงาน บ.เทคโนฯ", org: "บ.เทคโนฯ", date: "10 ส.ค. 2568", status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { name: "Workshop Data Science", org: "UM", date: "5 ก.ย. 2568", status: "วางแผน", statusColor: "badge-crimson" },
];

export interface ExpiringDocument {
  title: string;
  org: string;
  expire: string;
  days: number;
}

export const staffExpiringDocs: ExpiringDocument[] = [
  { title: "MoU UM 2565", org: "University of Malaya", expire: "31 พ.ค. 2568", days: 25 },
  { title: "MoA สหกิจ บ.เทคโนฯ", org: "บริษัท เทคโนโลยี จำกัด", expire: "30 มิ.ย. 2568", days: 15 },
];

// ---------- Admin dashboard ----------
export interface YearlyTrendPoint {
  year: string;
  ความร่วมมือ: number;
}

export const adminYearlyTrend: YearlyTrendPoint[] = [
  { year: "2564", ความร่วมมือ: 28 }, { year: "2565", ความร่วมมือ: 34 },
  { year: "2566", ความร่วมมือ: 41 }, { year: "2567", ความร่วมมือ: 46 },
  { year: "2568", ความร่วมมือ: 48 },
];

export interface AdminMonthlyActivityPoint {
  month: string;
  กิจกรรม: number;
  feedback: number;
}

export const adminMonthlyActivities: AdminMonthlyActivityPoint[] = [
  { month: "ม.ค.", กิจกรรม: 8, feedback: 12 },
  { month: "ก.พ.", กิจกรรม: 12, feedback: 18 },
  { month: "มี.ค.", กิจกรรม: 15, feedback: 22 },
  { month: "เม.ย.", กิจกรรม: 10, feedback: 16 },
  { month: "พ.ค.", กิจกรรม: 18, feedback: 28 },
  { month: "มิ.ย.", กิจกรรม: 22, feedback: 31 },
  { month: "ก.ค.", กิจกรรม: 19, feedback: 24 },
  { month: "ส.ค.", กิจกรรม: 25, feedback: 35 },
];

export interface StakeholderTypeSlice {
  name: string;
  value: number;
  color: string;
}

export const adminStakeholderTypes: StakeholderTypeSlice[] = [
  { name: "มหาวิทยาลัย", value: 22, color: "#8B1538" },
  { name: "บริษัทเอกชน", value: 35, color: "#C8961E" },
  { name: "สถาบันวิจัย", value: 15, color: "#1D4ED8" },
  { name: "สมาคม/เครือข่าย", value: 28, color: "#15803D" },
];

export interface TopCollaboration {
  name: string;
  score: number;
  activities: number;
  feedback: number;
  pct: number;
}

export const adminTopCollaborations: TopCollaboration[] = [
  { name: "มหาวิทยาลัยเชียงใหม่", score: 92, activities: 12, feedback: 4.8, pct: 92 },
  { name: "National Taiwan University", score: 85, activities: 8, feedback: 4.7, pct: 85 },
  { name: "Chulabhorn Research Institute", score: 80, activities: 9, feedback: 4.6, pct: 80 },
  { name: "University of Malaya", score: 72, activities: 5, feedback: 4.5, pct: 72 },
  { name: "บริษัท เทคโนโลยี จำกัด", score: 68, activities: 7, feedback: 4.3, pct: 68 },
];

export interface FeedbackDevelopmentItem {
  text: string;
  source: string;
  rating: number;
}

export const adminFeedbackDevelopment: FeedbackDevelopmentItem[] = [
  { text: "หลักสูตรควรเพิ่ม practical skills ด้าน DevOps และ Cloud", source: "ศิษย์เก่า", rating: 4 },
  { text: "บัณฑิตมีทักษะการสื่อสารที่ควรพัฒนา", source: "ภาคอุตสาหกรรม", rating: 4 },
  { text: "ควรเพิ่มโครงการวิจัยร่วมกับต่างประเทศ", source: "คู่ความร่วมมือ", rating: 5 },
];

export interface WatchMOUItem {
  title: string;
  org: string;
  days: number;
}

export const adminWatchMOU: WatchMOUItem[] = [
  { title: "MoU UM 2565", org: "University of Malaya", days: 25 },
  { title: "MoA สหกิจ บ.เทคโนฯ", org: "บริษัท เทคโนโลยี จำกัด", days: 15 },
];

/* ============================================================
   PAGES-B (exchange / feedback / settings pages) mock data
   Ported from legacy/figma-mock/src/pages/{StudentExchange,Feedback,Settings}.tsx
   ============================================================ */

export interface ExchangeStudent {
  id: number;
  name: string;
  type: "outbound" | "inbound";
  from: string;
  to: string;
  period: string;
  program: string;
  status: string;
}

export const exchangeStudents: ExchangeStudent[] = [
  { id: 1, name: "นายสมศักดิ์ ใจดี", type: "outbound", from: "หลักสูตรวิทยาการคอมพิวเตอร์", to: "National Taiwan University", period: "ก.พ.–พ.ค. 2568", program: "Student Exchange", status: "เสร็จสิ้น" },
  { id: 2, name: "นางสาวปวีณา เพ็ชรดี", type: "outbound", from: "หลักสูตรวิทยาการคอมพิวเตอร์", to: "University of Malaya", period: "มิ.ย.–ส.ค. 2568", program: "Student Exchange", status: "กำลังดำเนินการ" },
  { id: 3, name: "นายธนวัฒน์ พรสวรรค์", type: "outbound", from: "หลักสูตรวิศวกรรมซอฟต์แวร์", to: "Waseda University", period: "ก.ย.–ธ.ค. 2568", program: "Internship", status: "กำลังสมัคร" },
  { id: 4, name: "Miss Li Wei", type: "inbound", from: "National Taiwan University", to: "หลักสูตรวิทยาการคอมพิวเตอร์", period: "มี.ค.–มิ.ย. 2568", program: "Student Exchange", status: "เสร็จสิ้น" },
  { id: 5, name: "Mr. Ahmad Faiz", type: "inbound", from: "University of Malaya", to: "หลักสูตรวิทยาการคอมพิวเตอร์", period: "ก.ค.–ต.ค. 2568", program: "Research Exchange", status: "กำลังดำเนินการ" },
  { id: 6, name: "นางสาวกัลยา รักษ์ดี", type: "outbound", from: "หลักสูตรวิทยาการคอมพิวเตอร์", to: "Chulabhorn Research Institute", period: "ส.ค.–ก.ย. 2568", program: "Research Internship", status: "วางแผน" },
  { id: 7, name: "Mr. Takeshi Tanaka", type: "inbound", from: "Waseda University", to: "หลักสูตรวิศวกรรมซอฟต์แวร์", period: "ต.ค.–ธ.ค. 2568", program: "Student Exchange", status: "กำลังสมัคร" },
];

export interface FeedbackEntry {
  id: number;
  title: string;
  source: string;
  org: string;
  activity: string;
  rating: number;
  date: string;
  status: string;
  comment: string;
}

export const feedbackEntries: FeedbackEntry[] = [
  { id: 1, title: "ความพึงพอใจการอบรม AI for Education", source: "ผู้เข้าร่วมกิจกรรม", org: "National Taiwan University", activity: "อบรม AI for Education", rating: 5, date: "21 ส.ค. 2568", status: "ตรวจสอบแล้ว", comment: "กิจกรรมมีประโยชน์มากและทีมวิทยากรมีความเชี่ยวชาญสูง เนื้อหาตรงกับความต้องการ และกิจกรรม hands-on ทำให้เข้าใจได้ดีมาก ขอขอบคุณทีมงานทุกท่าน" },
  { id: 2, title: "ข้อเสนอแนะหลักสูตรปริญญาโท", source: "ศิษย์เก่า", org: "—", activity: "—", rating: 4, date: "18 ส.ค. 2568", status: "รอดำเนินการ", comment: "หลักสูตรดีมากแต่อยากให้เพิ่มวิชาที่เน้น practical skills มากกว่านี้ โดยเฉพาะด้าน DevOps และ Cloud Computing ซึ่งตลาดงานต้องการมาก" },
  { id: 3, title: "Feedback จากภาคอุตสาหกรรม", source: "คู่ความร่วมมือ", org: "บริษัท เทคโนโลยี จำกัด", activity: "—", rating: 5, date: "15 ส.ค. 2568", status: "ตรวจสอบแล้ว", comment: "บัณฑิตจากหลักสูตรนี้มีคุณภาพดีมาก สามารถทำงานได้จริงตั้งแต่วันแรก ขอชื่นชมทีมอาจารย์ที่เน้นการปฏิบัติจริง" },
  { id: 4, title: "ประเมินสหกิจศึกษา ภาคเรียนที่ 1/2568", source: "ระบบสหกิจศึกษา", org: "บริษัท ABC จำกัด", activity: "โครงการสหกิจศึกษา", rating: 4, date: "12 ส.ค. 2568", status: "รอดำเนินการ", comment: "นักศึกษาขยันและเรียนรู้เร็ว แต่ควรพัฒนาทักษะการสื่อสารและการนำเสนองานให้มากขึ้น" },
  { id: 5, title: "ความพึงพอใจการสัมมนาวิชาการ", source: "ผู้เข้าร่วมกิจกรรม", org: "มหาวิทยาลัยเชียงใหม่", activity: "สัมมนาวิชาการนวัตกรรม", rating: 5, date: "16 ส.ค. 2568", status: "ตรวจสอบแล้ว", comment: "เนื้อหาตรงกับความต้องการและเป็นประโยชน์ต่อการพัฒนาหลักสูตร ได้แนวคิดใหม่ ๆ กลับไปมาก" },
  { id: 6, title: "Feedback นักศึกษาแลกเปลี่ยน NTU", source: "นักศึกษา", org: "National Taiwan University", activity: "Student Exchange Program", rating: 5, date: "10 ส.ค. 2568", status: "รับทราบ", comment: "ประสบการณ์แลกเปลี่ยนครั้งนี้ดีมากเลยครับ ได้เรียนรู้วัฒนธรรมใหม่และมีโอกาสพัฒนาทักษะภาษาอังกฤษ" },
];

export interface AdminProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
}

export const adminProfile: AdminProfile = {
  firstName: "Admin",
  lastName: "System",
  email: "admin@university.ac.th",
  phone: "+66 2 123 4567",
  position: "ผู้ดูแลระบบ",
  department: "สำนักงานหลักสูตร",
};

/* ============================================================
   PAGES-C (activities / documents pages) mock data
   Ported from legacy/figma-mock/src/pages/{Activities,ActivityDetail,
   Documents,DocumentDetail}.tsx
   ⚠️ MOCK — รอ V2 ต่อ API จริง (lib/api.ts) แล้วจะแทนที่ด้วย fetch
   ============================================================ */

export interface MockActivity {
  id: number;
  name: string;
  org: string;
  type: string;
  date: string;
  participants: number;
  /** label ของ MoU/MoA ที่เกี่ยวข้อง (mock) */
  mou: string;
  /** id ของเอกสารใน `documents` (mock) — undefined = ไม่มีลิงก์ */
  mouDocId?: number;
  status: string;
  statusColor: string;
}

export const activities: MockActivity[] = [
  { id: 1, name: "อบรมเชิงปฏิบัติการ AI for Education", org: "National Taiwan University", type: "อบรม", date: "20 ส.ค. 2568", participants: 45, mou: "MoU NTU 2567", mouDocId: 2, status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 2, name: "สัมมนาวิชาการนวัตกรรมการเรียนการสอน", org: "มหาวิทยาลัยเชียงใหม่", type: "สัมมนา", date: "15 ส.ค. 2568", participants: 80, mou: "MoU มช. 2567", mouDocId: 1, status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 3, name: "การเยี่ยมชมบริษัทและศึกษาดูงาน", org: "บริษัท เทคโนโลยี จำกัด", type: "การเยี่ยมเยือน", date: "10 ส.ค. 2568", participants: 25, mou: "MoA บ.เทคโนฯ", mouDocId: 4, status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { id: 4, name: "Workshop Data Science for Business", org: "University of Malaya", type: "อบรม", date: "5 ส.ค. 2568", participants: 30, mou: "MoU UM 2565", mouDocId: 3, status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { id: 5, name: "โครงการวิจัยร่วม AI Healthcare", org: "บริษัท ABC จำกัด", type: "การวิจัย", date: "1 ส.ค. 2568", participants: 15, mou: "MoA ABC 2568", mouDocId: 6, status: "วางแผน", statusColor: "badge-purple" },
  { id: 6, name: "งาน Open Day สัมพันธ์ภาคอุตสาหกรรม", org: "สมาคมผู้ประกอบการ IT ไทย", type: "กิจกรรมวิชาการ", date: "25 ก.ค. 2568", participants: 120, mou: "MoU สมาคม IT", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 7, name: "นิทรรศการผลงานนักศึกษา Tech Expo", org: "บริษัท เทคโนโลยี จำกัด", type: "กิจกรรมวิชาการ", date: "20 ก.ค. 2568", participants: 200, mou: "MoA บ.เทคโนฯ", mouDocId: 4, status: "เสร็จสิ้น", statusColor: "badge-green" },
  { id: 8, name: "ประชุมความร่วมมือวิจัยชีวภาพ", org: "Chulabhorn Research Institute", type: "การวิจัย", date: "15 ก.ค. 2568", participants: 18, mou: "MoU CRI 2567", mouDocId: 7, status: "เสร็จสิ้น", statusColor: "badge-green" },
];

/** สี badge ตามประเภทกิจกรรม (mock) — badge-indigo/yellow ไม่มีในธีมใช้ inline class แทน */
export const activityTypeColors: Record<string, string> = {
  "อบรม": "badge-blue",
  "สัมมนา": "badge-purple",
  "การเยี่ยมเยือน": "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-[#E0E7FF] text-[#4338CA]",
  "กิจกรรมวิชาการ": "badge-green",
  "การวิจัย": "badge-gold",
  "กิจกรรมร่วมกับหน่วยงานภายนอก": "badge-gray",
};

export interface MockDocument {
  id: number;
  title: string;
  org: string;
  type: "MoU" | "MoA";
  start: string;
  expire: string;
  responsible: string;
  status: "active" | "expiring" | "expired" | "draft";
  daysLeft: number;
}

export const documents: MockDocument[] = [
  { id: 1, title: "MoU ความร่วมมือทางวิชาการ มช.", org: "มหาวิทยาลัยเชียงใหม่", type: "MoU", start: "1 ม.ค. 2567", expire: "31 ธ.ค. 2571", responsible: "ผศ.ดร.วิชัย สอนดี", status: "active", daysLeft: 1200 },
  { id: 2, title: "MoA แลกเปลี่ยนนักศึกษา NTU", org: "National Taiwan University", type: "MoA", start: "15 มี.ค. 2566", expire: "14 มี.ค. 2569", responsible: "รศ.ดร.นงนุช ประเสริฐ", status: "active", daysLeft: 560 },
  { id: 3, title: "MoU ความร่วมมือ University of Malaya", org: "University of Malaya", type: "MoU", start: "1 มิ.ย. 2565", expire: "31 พ.ค. 2568", responsible: "ดร.กิตติพงษ์ รักษา", status: "expiring", daysLeft: 25 },
  { id: 4, title: "MoA สหกิจศึกษา บ.เทคโนโลยี", org: "บริษัท เทคโนโลยี จำกัด", type: "MoA", start: "1 ก.ค. 2565", expire: "30 มิ.ย. 2568", responsible: "ผศ.สุดา วงศ์ดี", status: "expiring", daysLeft: 15 },
  { id: 5, title: "MoU ความร่วมมือ Waseda University", org: "Waseda University", type: "MoU", start: "1 ก.พ. 2563", expire: "31 ม.ค. 2568", responsible: "รศ.ดร.มานะ ฝึกฝน", status: "expired", daysLeft: -30 },
  { id: 6, title: "MoA ฝึกงาน บ.ABC จำกัด", org: "บริษัท ABC จำกัด", type: "MoA", start: "1 ส.ค. 2568", expire: "31 ก.ค. 2571", responsible: "ผศ.ดร.ธนา ขยัน", status: "draft", daysLeft: 999 },
  { id: 7, title: "MoU ความร่วมมือ CRI", org: "Chulabhorn Research Institute", type: "MoU", start: "1 มี.ค. 2567", expire: "28 ก.พ. 2572", responsible: "ดร.นิภา วิจัย", status: "active", daysLeft: 1400 },
];

export const documentStatusMap: Record<string, { label: string; cls: string }> = {
  active: { label: "ใช้งาน", cls: "badge-green" },
  expiring: { label: "ใกล้หมดอายุ", cls: "badge-gold" },
  expired: { label: "หมดอายุ", cls: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-[#FEE2E2] text-[#B91C1C]" },
  draft: { label: "อยู่ระหว่างจัดทำ", cls: "badge-blue" },
};

/* ---- Activity detail (mock: เนื้อหาเขียนไว้สำหรับกิจกรรม id=1) ---- */

export interface ActivityParticipant {
  name: string;
  role: string;
  avatar: string;
}

export const activityParticipants: ActivityParticipant[] = [
  { name: "นายสมศักดิ์ ใจดี", role: "นักศึกษาปริญญาโท", avatar: "สศ" },
  { name: "นางสาวปวีณา เพ็ชรดี", role: "นักศึกษาปริญญาตรี", avatar: "ปว" },
  { name: "ดร.กิตติพงษ์ รักษา", role: "อาจารย์ผู้ดูแล", avatar: "กต" },
  { name: "คุณวิรัช พัฒนา", role: "วิทยากรภายนอก", avatar: "วร" },
];

export interface ActivityFeedbackItem {
  name: string;
  rating: number;
  comment: string;
}

export const activityFeedbackList: ActivityFeedbackItem[] = [
  { name: "นายสมศักดิ์ ใจดี", rating: 5, comment: "เนื้อหาตรงกับความต้องการมาก วิทยากรมีความเชี่ยวชาญสูง และกิจกรรมปฏิบัติ hands-on ช่วยให้เข้าใจได้ดีมาก" },
  { name: "นางสาวปวีณา เพ็ชรดี", rating: 5, comment: "ได้รับความรู้ใหม่เยอะมาก โดยเฉพาะเรื่อง AI application ในการศึกษา ประทับใจมากค่ะ" },
  { name: "ผู้เข้าร่วมไม่ประสงค์ออกนาม", rating: 4, comment: "ดีมาก แต่ควรเพิ่มเวลา workshop ให้มากกว่านี้" },
];

export const activityPhotos: string[] = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=300&fit=crop&auto=format",
];

export const activityOutcomeStats = [
  { label: "ผู้เข้าร่วม", value: "45", sub: "คน", color: "#4f46e5", bg: "#ede9fe" },
  { label: "คะแนนความพึงพอใจ", value: "4.8", sub: "/ 5.0", color: "#16a34a", bg: "#dcfce7" },
  { label: "เอกสารประกอบ", value: "12", sub: "ชิ้น", color: "#d97706", bg: "#fef3c7" },
];

export const activityOutcomes = [
  "ผู้เข้าร่วม 45 คน สามารถนำ AI tools มาใช้ในการออกแบบบทเรียนได้",
  "สร้าง prototype AI-assisted learning module จำนวน 8 ชิ้น",
  "เกิดความร่วมมือวิจัยต่อเนื่องระหว่างสองสถาบัน",
  "นักศึกษา 3 คนได้รับเชิญเข้าร่วมโปรแกรมแลกเปลี่ยนที่ NTU",
];

export const activityInfoRows = [
  { label: "หน่วยงาน", value: "National Taiwan University" },
  { label: "ประเภท", value: "อบรมเชิงปฏิบัติการ" },
  { label: "วันที่", value: "20 สิงหาคม 2568" },
  { label: "เวลา", value: "09:00 – 17:00 น." },
  { label: "สถานที่", value: "ห้อง 301 อาคารวิจัย NTU" },
  { label: "ผู้รับผิดชอบ", value: "ผศ.ดร.วิชัย สอนดี" },
];

export const activityFiles = [
  "กำหนดการ_AI_Education.pdf",
  "สไลด์_Workshop.pdf",
  "รายชื่อผู้เข้าร่วม.xlsx",
];

/* ---- Document detail (mock: เนื้อหาเขียนไว้สำหรับเอกสาร id=1) ---- */

export interface DocumentTimelineStep {
  label: string;
  date: string;
  done: boolean;
  current: boolean;
}

export const documentTimeline: DocumentTimelineStep[] = [
  { label: "Draft", date: "1 พ.ย. 2566", done: true, current: false },
  { label: "Review", date: "15 พ.ย. 2566", done: true, current: false },
  { label: "Signed", date: "1 ม.ค. 2567", done: true, current: false },
  { label: "Active", date: "1 ม.ค. 2567", done: true, current: true },
  { label: "Renewal", date: "31 ธ.ค. 2571", done: false, current: false },
];

export interface DocumentRelatedActivity {
  /** id ใน `activities` (mock) — undefined = ไม่ทำเป็นลิงก์ (กัน 404) */
  activityId?: number;
  name: string;
  date: string;
  status: string;
  statusColor: string;
}

export const documentRelatedActivities: DocumentRelatedActivity[] = [
  { activityId: 2, name: "สัมมนาวิชาการนวัตกรรมการเรียนการสอน", date: "15 ส.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
  { activityId: 1, name: "อบรมเชิงปฏิบัติการ AI for Education", date: "20 ส.ค. 2568", status: "กำลังดำเนินการ", statusColor: "badge-blue" },
  { name: "โครงการวิจัยร่วม Digital Learning", date: "5 ก.ค. 2568", status: "เสร็จสิ้น", statusColor: "badge-green" },
];

export const documentScope = [
  "การแลกเปลี่ยนนักศึกษาและบุคลากรระหว่างสองสถาบัน",
  "การจัดกิจกรรมและโครงการวิชาการร่วมกัน",
  "การวิจัยและพัฒนาร่วมกันในสาขาที่เกี่ยวข้อง",
  "การแลกเปลี่ยนข้อมูล ทรัพยากร และองค์ความรู้",
  "การพัฒนาหลักสูตรและโปรแกรมการเรียนรู้ร่วมกัน",
  "การสนับสนุนทุนการศึกษาและการฝึกอบรม",
];

export const documentInfoRows = [
  { label: "ประเภท", value: "MoU (Memorandum of Understanding)" },
  { label: "หน่วยงาน", value: "มหาวิทยาลัยเชียงใหม่" },
  { label: "วันที่เริ่มต้น", value: "1 มกราคม 2567" },
  { label: "วันหมดอายุ", value: "31 ธันวาคม 2571" },
  { label: "ระยะเวลา", value: "5 ปี" },
  { label: "ผู้รับผิดชอบ", value: "ผศ.ดร.วิชัย สอนดี" },
  { label: "สถานะ", value: "ใช้งาน" },
  { label: "ผู้ลงนาม (ฝ่ายเรา)", value: "รศ.ดร.ประธาน มหาวิทยาลัย" },
  { label: "ผู้ลงนาม (หน่วยงาน)", value: "รศ.ดร.สมชาย ใจดี" },
];

export const documentFile = {
  name: "MoU_CMU_signed.pdf",
  meta: "PDF • 3.2 MB • อัปโหลด 1 ม.ค. 2567",
};

