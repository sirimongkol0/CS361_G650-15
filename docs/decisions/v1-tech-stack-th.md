# เทคโนโลยีและการตัดสินใจของ V1 (ฉบับภาษาไทย)

> คำแปลของ `docs/decisions/v1-tech-stack.md`

## Stack ที่ใช้

| ชั้น | ที่เลือก | เวอร์ชัน | เหตุผล |
|---|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | 14.x | SSR ทำให้ first paint เร็ว; framework เดียวจบทั้งหน้าเว็บและชั้นดึง API; App Router ตรงโครงสร้างหน้า/role ของโปรเจค |
| Styling | Tailwind CSS | 3.x | mock ของทีมดีไซน์ใช้ utility-class ตรง ๆ port ได้โดยไม่ต้องพังทลายเป็น component library |
| API | FastAPI + Pydantic v2 | latest stable | มี OpenAPI docs อัตโนมัติ, alias แปลง snake_case ↔ camelCase, dependency injection สำหรับ db session |
| ORM | SQLAlchemy | 2.x | models ตัวเดียวใช้ร่วมทั้ง API, seed, test; `create_all` sync schema ใน dev/CI โดยไม่ต้องพึ่ง migration tool ใน V1 |
| ฐานข้อมูล | PostgreSQL บน RDS | 16.x | managed, เข้ากับ service container ใน CI (`postgres:15`), ปลอดภัยกับการเพิ่มคอลัมน์ nullable |
| Object storage | AWS S3 | — | PDF เป็น blob ใหญ่ — S3 ทำให้ db เหลือแต่ metadata ใช้ IAM แบบจำกัดสิทธิ์ (`cs361-partner-s3`) Get/Put เฉพาะ `cs361-partner-docs/*` |
| Local dev | Docker Compose | — | คำสั่งเดียวได้ backend + frontend พร้อม network ถูกต้อง; แยก `NEXT_PUBLIC_API_URL` (server) กับ `NEXT_PUBLIC_API_BROWSER_URL` (browser) |
| CI | GitHub Actions | — | ฟรีสำหรับ repo; รัน backend pytest บน `postgres:15` และ `next build` ทุก push — ไม่ต้องมี `.env` |
| Testing | pytest + FastAPI TestClient | — | 23 tests: endpoint contract, การกรอง publish, validation อัปโหลด (413/415), download round-trip, delete cleanup |

## การตัดสินใจ & Trade-offs

### 1. เพิ่ม schema แบบ additive แทนรื้อ schema ใหม่
field สำหรับรองรับหน้าจอ เพิ่มเป็นคอลัมน์ nullable และตารางลูก ไม่ reshaping ตารางเดิม
- **ได้:** seed/test เดิมไม่พัง, pytest เขียวตลอด, ฐานข้อมูลของจริงไม่กระทบ
- **เสีย:** บางคอลัมน์ยังว่างในแถวข้อมูลจริงจนกว่าจะมีข้อมูลจริงมาเติม; อาจต้องมีรอบ cleanup ภายหลัง

### 2. สอง logical databases บน RDS อินสแตนซ์เดียว
`partner_activity_v1` (ข้อมูลจริง) กับ `partner_activity_mock` (ชุด mock) ใช้ schema เดียวกัน สลับด้วย `DATABASE_URL`
- **ได้:** สาธิตด้วยข้อมูลตรงหน้าจอโดยไม่แตะของจริง; สลับกลับแค่บรรทัดเดียว; reversible สุด ๆ (ลบ mock db ทิ้งก็จบ)
- **เสีย:** ต้องระวังตอน seed สองฐาน (แก้ด้วย `seed_mock.py` ที่ปฏิเสธฐานอื่นที่ไม่ใช่ mock ถ้าไม่ใส่ `--yes`)

### 3. Frontend render จาก mock ก่อน
ทุกหน้าแสดง `lib/mock.ts` ทันที แล้วสลับเป็นผล API เมื่อ fetch สำเร็จ — API ล่มก็คง mock ไว้
- **ได้:** หน้าเว็บไม่มีวันดูพังตอน backend ล่ม; first paint ทันที; ตอน demo ไม่เสียหน้า
- **เสีย:** อาจเห็นจังหวะ content เปลี่ยน; ต้องรักษา mock ให้ตรง shape API (จุดเชื่อมอยู่ที่ `lib/api.ts` ไฟล์เดียว)

### 4. Default storage เป็น local สำหรับ test/CI, S3 เฉพาะ production
`STORAGE_BACKEND=local` เป็นค่า default ของโค้ด; `.env` เลือกเป็น s3 เอง — CI ไม่มี secrets ก็รันได้
- **ได้:** CI รันโดยไม่ต้องมี AWS credentials แม้แต่ตัวเดียว; test เป็น hermetic
- **เสีย:** พฤติกรรม local กับ S3 ต่างกันเล็กน้อย (เช่น 404 เมื่อไฟล์หาย) — ครอบด้วย test ฝั่ง local path

### 5. เก็บ status เป็นข้อความตรงตัว แทน enum สำหรับ UI
label ไทย (`เสร็จสิ้น` ฯลฯ) เก็บเป็น string ตรงกับ mock เป๊ะ
- **ได้:** ไม่มี mapping คลาดเคลื่อนระหว่าง mock กับ API; sort/filter ง่าย
- **เสีย:** ถ้าเปลี่ยนข้อความต้องแก้ข้อมูล; i18n ไว้เวอร์ชันหน้า (trade-off ที่รู้ตัว ไม่ใช่ลืม)

### 6. คำนวณ document status แทนเก็บ
`expiring/expired` กับ `daysLeft` คำนวณจาก `expiryDate` ตอน render
- **ได้:** ไม่มีข้อมูลเก่าค้าง; ไม่ต้องมี cron ใน V1
- **เสีย:** มีการคำนวณเล็ก ๆ ต่อ request (น้อยมากในสเกล V1)

## สิ่งที่ V1 ตัดออกโดยตั้งใจ (→ V2+)

- Authentication/authorization (หน้า login ยังเป็น mock role picker)
- Write endpoints ของ partner/activity และหน้าจัดการ admin
- Flow ส่ง feedback (ตอนนี้เป็น read-only)
- Endpoint สำหรับกราฟ/aggregate (dashboard ยังใช้ mock)
