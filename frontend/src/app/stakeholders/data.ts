// Mock data for the Stakeholders pages (ported from legacy/figma-mock/src/pages/Stakeholders.tsx).
// TODO(mock): move these into src/lib/mock.ts once the shared mock module lands,
// e.g. exports `stakeholderOrganizations` / `StakeholderOrganization`.

export interface StakeholderOrganization {
  id: number;
  name: string;
  type: string;
  country: string;
  collab: string;
  activities: number;
  contact: string;
  status: "active" | "expiring" | "inactive";
  initials: string;
  bg: string;
  color: string;
  flag: string;
}

export const stakeholderOrganizations: StakeholderOrganization[] = [
  {
    id: 1,
    name: "มหาวิทยาลัยเชียงใหม่",
    type: "มหาวิทยาลัย",
    country: "ไทย",
    collab: "MoU",
    activities: 12,
    contact: "รศ.ดร.สมชาย ใจดี",
    status: "active",
    initials: "มช",
    bg: "#ede9fe",
    color: "#7c3aed",
    flag: "🇹🇭",
  },
  {
    id: 2,
    name: "National Taiwan University",
    type: "มหาวิทยาลัย",
    country: "ไต้หวัน",
    collab: "MoU + MoA",
    activities: 8,
    contact: "Prof. Wei-Lin Chen",
    status: "active",
    initials: "NTU",
    bg: "#dbeafe",
    color: "#1d4ed8",
    flag: "🇹🇼",
  },
  {
    id: 3,
    name: "University of Malaya",
    type: "มหาวิทยาลัย",
    country: "มาเลเซีย",
    collab: "MoU",
    activities: 5,
    contact: "Dr. Ahmad Razali",
    status: "active",
    initials: "UM",
    bg: "#dcfce7",
    color: "#16a34a",
    flag: "🇲🇾",
  },
  {
    id: 4,
    name: "บริษัท เทคโนโลยี จำกัด",
    type: "บริษัทเอกชน",
    country: "ไทย",
    collab: "MoA",
    activities: 7,
    contact: "คุณวิรัช พัฒนา",
    status: "expiring",
    initials: "TC",
    bg: "#fef3c7",
    color: "#d97706",
    flag: "🇹🇭",
  },
  {
    id: 5,
    name: "บริษัท ABC จำกัด",
    type: "บริษัทเอกชน",
    country: "ไทย",
    collab: "MoA",
    activities: 4,
    contact: "คุณศิริพร มั่งคั่ง",
    status: "active",
    initials: "ABC",
    bg: "#fce7f3",
    color: "#be185d",
    flag: "🇹🇭",
  },
  {
    id: 6,
    name: "Waseda University",
    type: "มหาวิทยาลัย",
    country: "ญี่ปุ่น",
    collab: "MoU",
    activities: 3,
    contact: "Prof. Takashi Yamamoto",
    status: "active",
    initials: "WU",
    bg: "#ffe4e6",
    color: "#e11d48",
    flag: "🇯🇵",
  },
  {
    id: 7,
    name: "สมาคมผู้ประกอบการ IT ไทย",
    type: "สมาคม/เครือข่าย",
    country: "ไทย",
    collab: "MoU",
    activities: 6,
    contact: "คุณประเสริฐ ดิจิทัล",
    status: "inactive",
    initials: "IT",
    bg: "#f1f5f9",
    color: "#475569",
    flag: "🇹🇭",
  },
  {
    id: 8,
    name: "Chulabhorn Research Institute",
    type: "สถาบันวิจัย",
    country: "ไทย",
    collab: "MoU + MoA",
    activities: 9,
    contact: "ดร.นิภา วิจัย",
    status: "active",
    initials: "CRI",
    bg: "#e0f2fe",
    color: "#0369a1",
    flag: "🇹🇭",
  },
];
