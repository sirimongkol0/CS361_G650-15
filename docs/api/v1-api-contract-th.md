# API Contract V1 (v1.1) — ฉบับภาษาไทย

> คำแปลของ `docs/api/v1-api-contract.md` — ตัว endpoint และ field เป็นข้อความภาษาอังกฤษตาม API จริง

## ภาพรวม

API แบบสาธารณะเน้นการอ่าน ส่วนใหญ่เป็น GET และกรองเฉพาะรายการที่ publish เอกสาร (documents) มีเพิ่ม: อัปโหลด (POST) และลบ (DELETE)

Base URL: `/api/v1`

- ภายใน Docker network: `http://partner_activity_backend:8000/api/v1`
- จาก Browser: `http://localhost:8000/api/v1`

สิ่งที่เพิ่มจากเวอร์ชันแรก: field ฝั่ง activities (`endDate`, `participants`, `location`, `time`, `status`, `isOpen`, `mouDocId`), field lifecycle ของ documents (`responsible`, `status`, `signerOur`, `signerPartner`, `scopeItems`, `timelineSteps`) และ resource ใหม่ 3 ตัว: feedback, exchange, users — ทั้งหมดเป็น optional/nullable ไม่ทำลายความเข้ากันได้กับเดิม

---

## Endpoints

### GET /api/v1/health

ตรวจสถานะ → `{"status": "healthy"}`

### GET /api/v1/partners/ — รายการ partners ที่ publish

```json
[
  {
    "id": 1,
    "name": "มหาวิทยาลัยเชียงใหม่",
    "description": "...",
    "logoUrl": null,
    "type": "university",
    "country": "ไทย",
    "websiteUrl": null,
    "contactName": null,
    "contactEmail": null
  }
]
```

`type` เป็นหนึ่งใน `university | government | private_company | nonprofit | alumni_network` — หน้าเว็บแปลงเป็น label ไทย

### GET /api/v1/partners/{id} — ตัวเดียว, 404 ถ้าไม่มีหรือยังไม่ publish

### GET /api/v1/activities/ — รายการกิจกรรมที่ publish (เรียงตามวันที่)

```json
[
  {
    "id": 1,
    "name": "อบรมเชิงปฏิบัติการ AI for Education",
    "date": "2025-08-20",
    "description": null,
    "activity_type": "workshop",
    "endDate": null,
    "participants": 45,
    "location": null,
    "time": null,
    "status": "เสร็จสิ้น",
    "isOpen": true,
    "mouDocId": 2,
    "partner": { "id": 2, "name": "National Taiwan University" }
  }
]
```

- `date`/`endDate` เป็น ISO `YYYY-MM-DD` — การแสดงผลแบบไทย (พ.ศ.) เป็นหน้าที่ของ frontend
- `activity_type`: `exchange | internship | cooperative_education | academic_event | workshop`
- `status` เก็บเป็นข้อความตรงตัว (เช่น `เสร็จสิ้น`, `กำลังดำเนินการ`, `วางแผน`)
- `mouDocId` ชี้ไป MoU/MoA ใน documents

### GET /api/v1/activities/{id} — ตัวเดียว, 404 ถ้าไม่พบ

### GET /api/v1/documents/ — รายการเอกสารที่ publish

scope items กับ timeline steps ฝังมาในแต่ละรายการเลย (ใช้ทำหน้า detail — ไม่มี `GET /documents/{id}` แยกโดยตั้งใจ)

```json
[
  {
    "id": 1,
    "name": "MoU ความร่วมมือทางวิชาการ มช.",
    "docType": "mou",
    "storageKey": "mock/agreements/mock-doc-1.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1234,
    "effectiveDate": "2024-01-01",
    "expiryDate": "2028-12-31",
    "partnerId": 1,
    "responsible": "ผศ.ดร.วิชัย สอนดี",
    "status": "active",
    "signerOur": "รศ.ดร.ประธาน มหาวิทยาลัย",
    "signerPartner": "รศ.ดร.สมชาย ใจดี",
    "scopeItems": [
      { "id": 1, "position": 1, "text": "การแลกเปลี่ยนนักศึกษาและบุคลากร" }
    ],
    "timelineSteps": [
      { "id": 1, "position": 1, "label": "Draft", "date": "2023-11-01", "done": true, "current": false }
    ]
  }
]
```

`docType`: `mou | moa | template | announcement` — `status`: `active | expiring | expired | draft`

### POST /api/v1/documents/ — อัปโหลด PDF

ส่งแบบ `multipart/form-data` field `file` (ใส่ `name` เพิ่มได้) ไฟล์เก็บลง storage (S3 ใน production, local disk ตอน dev/CI) — db เก็บแค่ metadata

| สถานะ | ความหมาย |
|---|---|
| 201 | สร้างสำเร็จ |
| 413 | ไฟล์ใหญ่เกิน 10 MB |
| 415 | ไม่ใช่ไฟล์ PDF |

### GET /api/v1/documents/{id}/download — ดาวน์โหลดไฟล์ (attachment), 404 ถ้าไม่พบ

### DELETE /api/v1/documents/{id} — ลบ (204), 404 ถ้าไม่พบ

### GET /api/v1/feedback/ — feedback ที่ publish เรียงใหม่ → เก่า

```json
[
  {
    "id": 1,
    "title": "ความพึงพอใจการอบรม AI for Education",
    "source": "ผู้เข้าร่วมกิจกรรม",
    "rating": 5,
    "date": "2025-08-21",
    "status": "ตรวจสอบแล้ว",
    "comment": "...",
    "partnerId": 2,
    "activityId": 1
  }
]
```

### GET /api/v1/exchange/ — รายชื่อนักศึกษาแลกเปลี่ยน

```json
[
  {
    "id": 1,
    "name": "นายสมศักดิ์ ใจดี",
    "type": "outbound",
    "fromProgram": "หลักสูตรวิทยาการคอมพิวเตอร์",
    "toOrganization": "National Taiwan University",
    "startDate": "2025-02-01",
    "endDate": "2025-05-31",
    "program": "Student Exchange",
    "status": "เสร็จสิ้น",
    "partnerId": 2,
    "activityId": null
  }
]
```

`type`: `outbound | inbound`

### GET /api/v1/users/ — โปรไฟล์ผู้ดูแล (หน้า settings)

```json
[
  {
    "id": 1,
    "firstName": "Admin",
    "lastName": "System",
    "email": "admin@university.ac.th",
    "phone": "+66 2 123 4567",
    "position": "ผู้ดูแลระบบ",
    "department": "สำนักงานหลักสูตร"
  }
]
```

---

## รูปแบบ Error

ตามค่า default ของ FastAPI: `{"detail": "..."}`

| Status | ความหมาย |
|---|---|
| 200 / 201 / 204 | สำเร็จ |
| 404 | ไม่พบ (หรือยังไม่ publish) |
| 413 | ไฟล์ใหญ่เกิน 10 MB |
| 415 | ไม่ใช่ PDF |
| 422 | ค่าที่ส่งไม่ผ่าน validation |
| 500 | Error ฝั่ง server |

## หมายเหตุ

- ทุก list endpoint กรอง `is_published = true` ยกเว้น `users` (ไม่มี flag publish)
- V1 ยังไม่มี authentication; endpoint เขียนมีแค่อัปโหลด/ลบเอกสาร — CRUD ที่เหลือกับ auth เป็นของ V2+
- วันที่เป็น ISO 8601 — หน้าเว็บแปลงเป็น พ.ศ. (+543) ตอนแสดงผล
