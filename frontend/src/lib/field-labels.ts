import {
  activityTypeLabels, cstuStatusLabels, documentStatusLabels, documentTypeLabels, feedbackSourceLabels,
  feedbackStatusLabels, importStatusLabels, improvementStatusLabels, partnerTypeLabels, scopeLevelLabels,
} from "@/lib/labels";
import { ROLES } from "@/lib/role-context";

/* Thai names for the database columns that appear in audit-log snapshots
   (backend audit.snapshot uses the column keys). A key missing here shows as-is. */
export const FIELD_LABELS: Record<string, string> = {
  id: "รหัสรายการ",
  name: "ชื่อ",
  name_th: "ชื่อภาษาไทย",
  title: "หัวข้อ",
  code: "รหัส",
  description: "รายละเอียด",
  type: "ประเภท",
  kind: "ประเภทข้อมูล",
  status: "สถานะ",
  is_published: "เผยแพร่",
  is_deleted: "ลบแล้ว",
  deleted_at: "วันที่ลบ",
  is_active: "ใช้งานอยู่",
  is_open: "เปิดรับ",
  is_legacy: "ข้อมูลเดิม",
  sort_order: "ลำดับ",
  scope_level: "ระดับความร่วมมือ",
  owner_user_id: "ผู้รับผิดชอบรายการ",
  created_by_user_id: "ผู้สร้าง",
  created_at: "วันที่สร้าง",
  updated_at: "วันที่แก้ไข",

  // partners
  logo_url: "ลิงก์โลโก้",
  country: "ประเทศ",
  country_code: "รหัสประเทศ",
  website_url: "เว็บไซต์",
  contact_name: "ชื่อผู้ประสานงาน",
  contact_email: "อีเมลผู้ประสานงาน",
  contact_is_public: "แสดงผู้ประสานงานในหน้าสาธารณะ",
  organization_id: "หน่วยงานแม่",

  // agreements
  doc_type: "ประเภทข้อตกลง",
  document_kind: "ชนิดเอกสาร",
  file_name: "ชื่อไฟล์",
  storage_key: "ที่เก็บไฟล์",
  mime_type: "ชนิดไฟล์",
  size_bytes: "ขนาดไฟล์ (ไบต์)",
  uploaded_at: "วันที่อัปโหลด",
  file_availability: "สถานะไฟล์",
  effective_date: "วันที่เริ่มมีผล",
  expiry_date: "วันหมดอายุ",
  responsible: "ผู้รับผิดชอบ",
  signer_our: "ผู้ลงนามฝ่ายเรา",
  signer_partner: "ผู้ลงนามฝ่ายคู่ความร่วมมือ",
  cstu_status: "ความเกี่ยวข้องกับ CSTU",
  cstu_evidence: "เหตุผลความเกี่ยวข้องกับ CSTU",
  renews_document_id: "ต่ออายุจากข้อตกลง",
  renewal_decision: "ผลการพิจารณาต่ออายุ",
  renewal_reason: "เหตุผลการต่ออายุ",
  renewal_decided_by_user_id: "ผู้พิจารณาต่ออายุ",
  renewal_decided_at: "วันที่พิจารณาต่ออายุ",

  // activities
  date: "วันที่",
  end_date: "วันที่สิ้นสุด",
  time: "เวลา",
  location: "สถานที่",
  participants: "ผู้เข้าร่วม",
  activity_type: "ประเภทกิจกรรม",
  date_kind: "ชนิดวันที่",
  date_precision: "ความละเอียดของวันที่",
  mou_document_id: "ข้อตกลงที่เกี่ยวข้อง",

  // links between records
  partner_id: "หน่วยงาน",
  document_id: "ข้อตกลง",
  activity_id: "กิจกรรม",
  exchange_id: "การแลกเปลี่ยน",
  user_id: "บัญชีนักศึกษา",

  // exchange
  from_program: "จากหลักสูตร",
  to_organization: "ไปยังหน่วยงาน",
  program: "โครงการ",
  start_date: "วันที่เริ่ม",

  // feedback
  source: "แหล่งที่มา",
  rating: "คะแนน",
  comment: "ความคิดเห็น",
  respondent_type_id: "ประเภทผู้ส่ง",
  feedback_source_id: "แหล่งที่มา",
  submitted_by_user_id: "ผู้ส่ง",
  reply: "คำตอบกลับ",
  replied_at: "วันที่ตอบกลับ",
  replied_by_user_id: "ผู้ตอบกลับ",
  import_batch_id: "ชุดนำเข้า",
  external_id: "รหัสจากระบบต้นทาง",

  // outcomes
  outcome_type_id: "ประเภทผลลัพธ์",
  value: "จำนวน",
  unit: "หน่วยนับ",
  occurred_on: "วันที่เกิดผล",
  evidence_url: "ลิงก์หลักฐาน",
  evidence_storage_key: "ไฟล์หลักฐาน",

  // improvements
  action_date: "วันที่ดำเนินการ",

  // import batches
  total_rows: "จำนวนแถวทั้งหมด",
  valid_rows: "แถวที่ผ่าน",
  invalid_rows: "แถวที่ไม่ผ่าน",
  errors: "ข้อผิดพลาด",
  preview_data: "ตัวอย่างข้อมูล",
  committed_at: "วันที่ยืนยันนำเข้า",
  rolled_back_at: "วันที่ย้อนการนำเข้า",

  // users
  email: "อีเมล",
  role: "บทบาท",
  cognito_sub: "รหัสบัญชี Cognito",
  last_login_at: "เข้าสู่ระบบล่าสุด",
};

export const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map((role) => [role.id, role.label]));

/* Thai names for stored codes, by "entity.field" (or "*.field" for any entity). Free-text
   values (exchange and activity statuses are already Thai) are not listed. */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  "documents.status": documentStatusLabels,
  "feedbacks.status": feedbackStatusLabels,
  "improvements.status": improvementStatusLabels,
  "import_batches.status": importStatusLabels,
  "partners.type": partnerTypeLabels,
  "feedbacks.source": feedbackSourceLabels,
  "users.role": ROLE_LABELS,
  "*.cstu_status": cstuStatusLabels,
  "*.doc_type": documentTypeLabels,
  "*.scope_level": scopeLevelLabels,
  "*.activity_type": activityTypeLabels,
};

/** The code → Thai map for one field of one audited entity, if the field holds codes. */
export const valueLabels = (entity: string, key: string): Record<string, string> | undefined =>
  VALUE_LABELS[`${entity}.${key}`] ?? VALUE_LABELS[`*.${key}`];
