# สัญญา Public API - V2

คง prefix `/api/v1` เพื่อรองรับ client เดิม เอกสารนี้อธิบาย API ที่เปิดใช้จริง
ดู fields, aliases และกฎเผยแพร่ครบที่ [V2 field contract](v2-field-contract.md)

## API สาธารณะ

| Method | Path | หน้าที่ |
| --- | --- | --- |
| GET | `/api/v1/health` | ตรวจฐานข้อมูล คืน `{"status":"healthy"}` |
| GET | `/api/v1/partners/` | รายการหน่วยงานที่ผ่านเกณฑ์เผยแพร่ |
| GET | `/api/v1/partners/{id}` | รายละเอียดหน่วยงาน |
| GET | `/api/v1/partners/{id}/logo` | โลโก้หน่วยงานที่เผยแพร่ |
| GET | `/api/v1/documents/` | รายการเอกสารที่ผ่านเกณฑ์เผยแพร่ |
| GET | `/api/v1/documents/{id}` | รายละเอียดเอกสารและหน่วยงานที่เกี่ยวข้อง |
| GET | `/api/v1/documents/{id}/download` | ไฟล์ของเอกสารนั้น รองรับชื่อภาษาไทย |
| GET | `/api/v1/activities/` | รายการกิจกรรมที่เผยแพร่ |
| GET | `/api/v1/activities/{id}` | รายละเอียดกิจกรรมและความสัมพันธ์ที่เปิดเผยได้ |

List คืน JSON array; ID เป็น integer ฉบับร่างหรือข้อมูลไม่ผ่านเกณฑ์ไม่ปรากฏใน list
และคืน 404 เมื่อเรียก detail/download ความสัมพันธ์กับข้อมูลที่ไม่ผ่านเกณฑ์เป็น null
แสดงเฉพาะแหล่งข้อมูล verified และผู้ติดต่อที่อนุญาตให้เผยแพร่

## การค้นหาและกรอง

| Resource | Query parameters |
| --- | --- |
| partners | `search`, `partner_type`, `country` |
| documents | `search`, `doc_type`, `status`, `date_from`, `date_to` |
| activities | `search`, `activity_type`, `status`, `date_from`, `date_to` |

ค้นชื่อโดยตัดช่องว่างหัวท้ายและไม่แยกตัวพิมพ์เล็กใหญ่ การค้นหน่วยงานรวมชื่อผู้ติดต่อ
ที่อนุญาตเผยแพร่ เอกสารและกิจกรรมค้นชื่อหน่วยงานที่ผ่านเกณฑ์เผยแพร่ได้ด้วย
ชื่อหน่วยงานที่ไม่เปิดเผยต้องไม่ทำให้ค้นเจอข้อมูล ตัวกรองรวมกันแบบ AND
ประเทศเทียบชื่อที่จัดเก็บตรงตัว ประเภทและสถานะใช้ค่า API ที่บันทึกไว้

วันที่เป็น `YYYY-MM-DD` เอกสารกรองช่วงทับซ้อนแบบรวมวันขอบเขต:
expiry >= date_from และ effective <= date_to กิจกรรมใช้ endDate หรือ date
เมื่อไม่มี endDate เทียบ >= date_from และ date <= date_to วันที่ไม่ทราบค่า
ไม่ผ่านขอบเขตที่ระบุ วันที่ไม่ถูกต้องหรือช่วงย้อนกลับคืน 422 ทั้งสอง resource
กรองวันที่ตามค่าที่บันทึก ส่วนการแสดงผลรักษาความหมายและความละเอียดตาม
`dateKind`/`datePrecision` เช่น วันประกาศ วันปิดรับสมัคร เดือน ปี หรือโดยประมาณ

สถานะกิจกรรมและ `isOpen` ที่ไม่ทราบยังเป็น null หน้าเว็บแสดง “ไม่ระบุ”
ไม่คาดเดาจากวันที่ วันเวลาอัปโหลดและตรวจสอบแหล่งข้อมูลเป็น UTC

## ขอบเขตและข้อผิดพลาด

POST/DELETE เอกสารถูกปิดและคืน 405 โดยไม่เปลี่ยนแถวหรือไฟล์
`/users`, `/feedback`, `/exchange` รวม detail ไม่เปิดใช้งานและคืน 404
CORS อนุญาต GET จาก origin ที่ตั้งค่า Login, สิทธิ์และการเขียนข้อมูลเป็น V3+

Application errors ใช้ `{"detail":"..."}` สถานะ: 200, 404, 405, 422, 500
และ 503 เมื่อฐานข้อมูลไม่พร้อม CORS preflight ใช้ข้อความของ framework
ดาวน์โหลดใช้ `Content-Disposition: attachment` และชื่อ UTF-8

API local: `http://localhost:8000/api/v1`; ภายใน Compose:
`http://backend:8000/api/v1` ตั้งค่า browser origins ด้วย `CORS_ORIGINS`
