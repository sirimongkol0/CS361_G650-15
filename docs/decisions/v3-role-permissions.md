# สิทธิ์ตามบทบาทของ V3

สถานะ: **ใช้แล้วใน V3** (ร่าง 10 ตุลาคม 2026, ปรับตามที่ deploy 19 ตุลาคม 2026, Asia/Bangkok)

เอกสารนี้กำหนดว่าแต่ละบทบาททำอะไรได้บ้าง เพื่อให้ backend (`require_role(...)`)
และปุ่มบนหน้าเว็บตรงกันทุก issue ของ V3 อ้างอิงบทบาทจาก
[ขอบเขตระบบ](cstu-program-scope.md) และงานใน issue V3-2 ถึง V3-5

## บทบาท

| บทบาท | ชื่อบนเว็บ | หน้าที่ (จากขอบเขตระบบ) |
|---|---|---|
| `public` | ผู้ใช้ทั่วไป | ดูข้อมูลที่อนุญาตให้เผยแพร่ (เหมือนผู้ที่ยังไม่เข้าสู่ระบบ) |
| `student` | นักศึกษา / ผู้เข้าร่วมโครงการ | ดูและดำเนินการกับข้อมูลที่เกี่ยวข้องกับตน |
| `coordinator` | อาจารย์ / ผู้ประสานงาน | บันทึกและติดตามความร่วมมือที่ตนรับผิดชอบ |
| `staff` | เจ้าหน้าที่หลักสูตร | ดูแลข้อมูล เอกสาร สถานะ และข้อมูลสรุปทั้งหมด |
| `admin` | ผู้บริหาร / ผู้ดูแลระบบ | ทุกอย่างของ staff + ดูภาพรวม จัดการบัญชีและสิทธิ์ |

## ตารางสิทธิ์

✅ ทำได้ · 🔸 ทำได้เฉพาะรายการของตน/ที่ตนรับผิดชอบ · — ทำไม่ได้

### การดูข้อมูล

| การกระทำ | public | student | coordinator | staff | admin |
|---|---|---|---|---|---|
| ดูหน่วยงาน เอกสาร และกิจกรรมที่เผยแพร่ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ดูรายการที่ยังไม่เผยแพร่ / ข้อมูลภายใน | — | — | 🔸 | ✅ | ✅ |
| ดาวน์โหลดเอกสารภายใน (V3-3) | — | — | 🔸 | ✅ | ✅ |
| ดูข้อมูลการแลกเปลี่ยนนักศึกษา (V3-4) | — | 🔸 | 🔸 | ✅ | ✅ |
| ดู audit log (V3-5) | — | — | — | ✅ | ✅ |

### หน่วยงานและผู้ประสานงาน (V3-2)

| การกระทำ | public | student | coordinator | staff | admin |
|---|---|---|---|---|---|
| เพิ่มหน่วยงาน / บุคคล / ผู้ประสานงาน | — | — | ✅ | ✅ | ✅ |
| แก้ไข | — | — | 🔸 | ✅ | ✅ |
| ลบ (soft delete เก็บประวัติ) | — | — | — | ✅ | ✅ |

การสร้างหรือแก้ไขรายการโดย coordinator ไม่ได้ให้สิทธิ์เผยแพร่รายการ:
การตั้งหรือยกเลิก `is_published` ทำได้เฉพาะ staff/admin

### ข้อตกลงและเอกสาร (V3-3)

| การกระทำ | public | student | coordinator | staff | admin |
|---|---|---|---|---|---|
| สร้างและแก้ไขข้อตกลงสถานะ "ร่าง" | — | — | 🔸 | ✅ | ✅ |
| อนุมัติ (ร่าง → อนุมัติ) | — | — | — | ✅ | ✅ |
| เปลี่ยนเป็นมีผล / หมดอายุ / ยกเลิก | — | — | — | ✅ | ✅ |
| ตรวจความเกี่ยวข้องกับ CSTU (`cstu_status`) | — | — | — | ✅ | ✅ |
| เผยแพร่ / ยกเลิกเผยแพร่ | — | — | — | ✅ | ✅ |
| อัปโหลด / แทนไฟล์เอกสาร | — | — | 🔸 | ✅ | ✅ |

### กิจกรรมและการแลกเปลี่ยน (V3-4)

| การกระทำ | public | student | coordinator | staff | admin |
|---|---|---|---|---|---|
| เพิ่มและแก้ไขกิจกรรม | — | — | 🔸 | ✅ | ✅ |
| ลบกิจกรรม | — | — | — | ✅ | ✅ |
| เพิ่มและแก้ไขข้อมูลการแลกเปลี่ยนนักศึกษา | — | — | 🔸 | ✅ | ✅ |

### บัญชีผู้ใช้ (ยังไม่มี issue)

| การกระทำ | public | student | coordinator | staff | admin |
|---|---|---|---|---|---|
| สร้างบัญชี ปิดบัญชี และเปลี่ยนบทบาท | — | — | — | — | ✅ |

## หลักที่ใช้

1. **ตรวจที่ backend เสมอ** ปุ่มบนเว็บซ่อนตามบทบาทเพื่อความสะดวกเท่านั้น
   ทุก endpoint ที่เขียนข้อมูลต้องใช้ `require_role(...)` ตามตารางนี้
2. **บทบาทต้องระบุครบ** `require_role` ไม่ถือว่า admin ได้สิทธิ์ของ staff อัตโนมัติ
   ทุก endpoint ต้องใส่ `"admin"` เองถ้าต้องการให้ admin ทำได้
3. **คนสร้างไม่ใช่คนอนุมัติ** coordinator สร้างและแก้ไขร่างได้ แต่การอนุมัติ
   เปลี่ยนสถานะ และเผยแพร่ เป็นของ staff/admin (ตาม V3-3)
4. **ไม่ลบจริง** การลบเป็น soft delete และทุกการเขียนมีบันทึกใน audit log
   (เรียก `audit.record(...)` ใน transaction เดียวกับการเปลี่ยนข้อมูล ดู `backend/audit.py`)

## ข้อตัดสินใจ

1. **"ที่ตนรับผิดชอบ" ดูจาก `owner_user_id`** อ้างอิงตาราง `users` เพิ่มใน `partners`, `documents`,
   `activities` และ `exchange_students` ตั้งเป็นผู้สร้างรายการ นักศึกษาแลกเปลี่ยนใช้ `user_id` ระบุเจ้าของข้อมูล
2. **coordinator เผยแพร่เองไม่ได้** การตั้งหรือยกเลิก `is_published` ทำได้เฉพาะ staff/admin (backend ตอบ 403)
3. **staff เห็นประวัติการแก้ไข** (`GET /audit-logs/` ให้ staff และ admin)
4. **ความคิดเห็นเลื่อนไป V4** ตามขอบเขต FR6/V4 ของโจทย์ API ทำไว้แล้ว: coordinator/staff/admin ดูและตอบได้
   (`GET /feedback/manage`, `PATCH /feedback/{id}`) เผยแพร่ได้เฉพาะ staff/admin หน้าเว็บ `/feedback` และ `/reports` ซ่อนไว้
5. **จัดการบัญชีผู้ใช้ผ่าน Cognito** หน้า "ผู้ใช้และสิทธิ์" (admin) แสดงรายชื่อจากตาราง `users` อย่างเดียว
   เพิ่มบัญชีและเปลี่ยนบทบาทใน Cognito console หรือ `infra/provision_cognito.py`
   ผู้ใช้ทุกบทบาทเปลี่ยนรหัสผ่านตัวเองได้ที่ `POST /auth/change-password`

## สถานะปัจจุบันในโค้ด

- backend: `require_role(...)` พร้อมใช้ (V3-1), `audit.record(...)` และ `GET /api/v1/audit-logs` (staff/admin) พร้อมใช้ (V3-5)
- backend V3-3: ข้อตกลงคือแถวในตาราง `documents` endpoint เขียนข้อมูลอยู่ใน `backend/routers/documents.py`
  และทุกตัวบันทึก audit log

  | Endpoint | สิทธิ์ |
  |---|---|
  | `POST /documents/` สร้างร่าง (`status=draft`, ไม่เผยแพร่, `cstu_status=review`) | coordinator, staff, admin |
  | `PATCH /documents/{id}` แก้ไขข้อมูล | coordinator 🔸 เฉพาะร่าง, staff, admin |
  | `PUT /documents/{id}/file` อัปโหลด/แทนไฟล์ PDF ไม่เกิน `MAX_UPLOAD_BYTES` (10 MB) | coordinator 🔸 เฉพาะร่าง, staff, admin |
  | `GET /documents/manage` รายการรวมร่าง | coordinator 🔸, staff, admin |
  | `GET /documents/{id}/internal-url` ลิงก์ดาวน์โหลดอายุ 5 นาที (S3 presigned URL) | coordinator 🔸, staff, admin |
  | `POST /documents/{id}/transition` เปลี่ยนสถานะ | staff, admin |
  | `PUT /documents/{id}/cstu-status` ตรวจความเกี่ยวข้อง (`keep`/`out_of_scope` ต้องมี `cstu_evidence`) | staff, admin |
  | `POST /documents/{id}/publish`, `/unpublish` | staff, admin |
  | `DELETE /documents/{id}` soft delete | staff, admin |

  สถานะ: `draft → approved → active → expired` และยกเลิก (`cancelled`) ได้จากทุกสถานะที่ยังไม่ปิด
  (`expiring` ถือเป็น `active`) transition อื่นตอบ 409
  หน้าสาธารณะแสดงเฉพาะเอกสารที่ `is_published` และ `cstu_status = keep`
  (`migrate_v3.py` ตั้งเอกสารที่เผยแพร่อยู่แล้วเป็น `keep` ให้ครั้งแรกที่เพิ่มคอลัมน์)
- frontend: ปุ่มเพิ่ม/แก้ไขแสดงให้ coordinator, staff, admin (`canManage` ใน
  `frontend/src/lib/role-context.tsx`) และทำงานจริงทุกหน้า (`/stakeholders/manage`, `/documents/manage`,
  `/activities/manage`, `/exchange`) ถ้า backend ตอบ 401/403 หน้าเว็บแสดง "กรุณาเข้าสู่ระบบ" / "ไม่มีสิทธิ์เข้าถึง"
