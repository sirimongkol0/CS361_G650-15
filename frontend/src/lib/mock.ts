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
