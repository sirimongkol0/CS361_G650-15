# สถาปัตยกรรม V1 (ฉบับภาษาไทย)

> เอกสารนี้เป็นคำแปลภาษาไทยของ `docs/architecture/v1-architecture.md` เพื่อการศึกษา — ต้นฉบับภาษาอังกฤษเป็น reference ทางการ

## ภาพรวมระบบ

V1 เป็นระบบเว็บ 3 ชั้น (three-tier) สำหรับบริหารความร่วมมือระหว่างประเทศของ ม.ธรรมศาสตร์:  frontend ด้วย Next.js, backend ด้วย FastAPI ที่เปิด REST API แบบมีเวอร์ชัน (`/api/v1`), และฐานข้อมูล PostgreSQL พร้อม S3 เก็บไฟล์เอกสาร

```
                         ┌──────────────────────────────────────────┐
                         │                 Browser                  │
                         └───────────────┬──────────────────────────┘
                                         │ HTTP
                    ┌────────────────────┴─────────────────────┐
                    │              Next.js (SSR)               │
                    │  ทุกหน้า fetch /api/v1 ตอน render        │
                    │  lib/api.ts — fetch wrapper + mapper     │
                    │  fallback: lib/mock.ts ถ้า API ล่ม       │
                    └────────────────────┬─────────────────────┘
                                         │ REST (JSON) /api/v1
                    ┌────────────────────┴─────────────────────┐
                    │             FastAPI backend              │
                    │  routers: health, partners, activities,  │
                    │  documents, feedback, exchange, users    │
                    │  schemas.py — DTO แบบ camelCase          │
                    │  storage.py — เลือก S3 หรือ local disk   │
                    └───────┬──────────────────────┬───────────┘
                            │ SQLAlchemy ORM       │ put/get/delete
                 ┌──────────┴──────────┐   ┌───────┴──────────────┐
                 │  PostgreSQL (RDS)   │   │  S3 bucket           │
                 │  partner_activity_  │   │  cs361-partner-docs  │
                 │  mock (mockdb สาธิต)│   │  เก็บแค่ไฟล์ PDF     │
                 │  partner_activity_  │   │  1 key ต่อ 1 เอกสาร  │
                 │  v1 (ข้อมูลจริง)    │   └──────────────────────┘
                 └─────────────────────┘
```

## หน้าที่ของแต่ละชั้น

| ชั้น | เทคโนโลยี | หน้าที่ |
|---|---|---|
| Frontend | Next.js 14 + TypeScript, Tailwind | หน้าเว็บ, dashboard แยกตาม role, การแสดงผลทั้งหมด ดึงข้อมูลจาก `/api/v1` ฝั่ง server; แสดงจาก `mock.ts` ก่อน แล้วสลับเป็นข้อมูลจริงเมื่อ fetch สำเร็จ — ถ้า API ล่มใช้ mock ต่อ |
| API | FastAPI + Pydantic v2 | REST ภายใต้ `/api/v1` Routers ทำงานบาง ๆ; response เป็น DTO camelCase แปลงจาก ORM ที่เป็น snake_case การกรองเฉพาะของที่ publish (`is_published`) อยู่ที่ชั้นนี้ |
| ฐานข้อมูล | SQLAlchemy + PostgreSQL (RDS) | ข้อมูลเชิงความสัมพันธ์: partners, activities, documents (+ ตารางลูก scope/timeline), feedbacks, exchange students, admin profiles — ทุกคอลัมน์ที่เพิ่มเพื่อรองรับ mock เป็น nullable และ additive |
| Object storage | S3 (IAM แบบจำกัดสิทธิ์) | เก็บไฟล์ PDF เท่านั้น — ไม่เก็บใน database สิทธิ์ key จำกัดแค่ Get/Put ใต้ `cs361-partner-docs/*` |
| CI | GitHub Actions | push ครั้งไหนรัน 2 jobs: backend pytest (บน Postgres service ไม่ต้องมี `.env`) และ frontend `next build` |

## Design Decisions สำคัญ

1. **ขยาย schema แบบ additive-only** — field ที่เพิ่มเพื่อให้ตรงกับหน้าจอ (participants, location, mouDocId, ผู้ลงนาม ฯลฯ) เพิ่มเป็นคอลัมน์ nullable และตารางลูกใหม่ ไม่แก้/ลบของเดิม ทำให้ seed และ test เก่ายังทำงานเหมือนเดิม (pytest 23/23 ก่อนและหลัง)
2. **แยกฐานข้อมูล mock กับของจริงบน RDS เครื่องเดียว** — `partner_activity_v1` เก็บข้อมูล TU จริง, `partner_activity_mock` เก็บชุดข้อมูล mock ของ frontend schema เดียวกัน สลับกันแค่เปลี่ยน `DATABASE_URL` — ข้อมูลจริงไม่เคยถูกปนเปื้อน
3. **ไฟล์อยู่ S3, metadata อยู่ Postgres** — ตาราง `documents` เก็บแค่ `storage_key` ตัวไฟล์ stream ผ่าน backend เข้า storage (เลือกได้ `STORAGE_BACKEND=s3|local`) ทำให้ dump ฐานข้อมูลเล็กและเร็ว
4. **Render จาก mock ก่อน แล้วสลับของจริง** — ทุกหน้าแสดงจาก `lib/mock.ts` ตั้งแต่ first paint แล้วค่อยสลับเป็นข้อมูล API เมื่อ fetch สำเร็จ — API ล่มหน้าเว็บไม่พัง (แสดง mock เหมือนเดิม)
5. **แยก data กับ decoration** — database เก็บข้อมูล (ชื่อ, วันที่, status เป็นข้อความตรงตัว) ส่วนตัวตกแต่ง (initials, สี badge, emoji ธง) คำนวณฝั่ง frontend — เปลี่ยนธีมไม่ต้องแตะฐานข้อมูล
6. **คำนวณ status แทนเก็บค้างไว้** — สถานะ `expiring/expired` และ `daysLeft` ของเอกสาร คำนวณจาก `expiryDate` ตอน render ไม่เก็บลง db — ไม่มีวันเก่าค้าง

## Flow การดาวน์โหลดเอกสาร

```
Browser → GET /api/v1/documents/{id}/download
        → backend หา storage_key จาก Postgres
        → storage.get_file(key) stream ไฟล์จาก S3
        → 200 พร้อม Content-Disposition: attachment
```

## ขอบเขตของ V1

- อ่านอย่างเดียวสำหรับข้อมูลสาธารณะ + อัปโหลด/ลบเอกสาร ยังไม่มี auth, ยังไม่มี CRUD ของ partner/activity (เป็นของ V2+)
- กราฟ dashboard และข้อมูลส่วนตัวนักศึกษายังเป็น mock ฝั่ง frontend โดยออกแบบ (ยังไม่มี endpoint aggregate)
