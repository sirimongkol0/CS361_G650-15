# คู่มือติดตั้ง V1 (ฉบับภาษาไทย)

> คำแปลของ `docs/setup/README.md`

## สิ่งที่ต้องมีก่อน

- Docker + Docker Compose (แนะนำ) **หรือ**
- Python 3.11+, Node.js 20+, และ PostgreSQL ที่เข้าถึงได้

## ทางเลือก A — Docker Compose (ครบทั้งระบบ)

1. สร้างไฟล์ `.env` ข้าง `docker-compose.yml` (ไฟล์นี้ถูก gitignore):

   ```
   DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
   STORAGE_BACKEND=local            # หรือ s3
   S3_BUCKET=cs361-partner-docs     # เมื่อใช้ s3
   AWS_REGION=ap-southeast-1
   AWS_ACCESS_KEY_ID=<key แบบจำกัดสิทธิ์>
   AWS_SECRET_ACCESS_KEY=<secret>
   ```

2. สั่งรัน:

   ```bash
   docker compose up --build -d
   ```

3. ตรวจว่าพร้อมใช้:

   | URL | ที่ควรเห็น |
   |---|---|
   | http://localhost:8000/api/v1/health | `{"status":"healthy"}` |
   | http://localhost:3000 | หน้าเว็บ (redirect ไป /login) |
   | http://localhost:3000/activities | รายการกิจกรรมจาก API |

ข้อควรรู้:

- ใน network ของ compose, frontend เรียก backend ด้วยชื่อ service แต่ลิงก์ฝั่ง browser ใช้ port ที่ publish ไว้ (8000) — ค่าทั้งสองถูก inject ตอน build ใน `docker-compose.yml`
- frontend publish ที่ host port **3000**
- หยุดด้วย `docker compose down` — ข้อมูลอยู่ที่ RDS/S3 ไม่หาย

## ทางเลือก B — รันแยก process (สำหรับแก้โค้ดบ่อย ๆ)

1. **ฐานข้อมูล** — ชี้ `DATABASE_URL` ไปที่ PostgreSQL ใดก็ได้
2. **Backend**:

   ```bash
   cd backend
   python -m venv venv && venv/Scripts/pip install -r requirements.txt   # Windows
   copy .env.example .env   # แล้วแก้ค่าข้างใน
   venv/Scripts/python -m uvicorn main:app --reload --port 8000
   ```

   Swagger docs: http://localhost:8000/docs

3. **Frontend**:

   ```bash
   cd frontend
   npm install
   npm run dev   # http://localhost:3000
   ```

## การ Seed ข้อมูล

มี seed script อยู่ 2 ตัว (รันจากโฟลเดอร์ `backend/`):

| Script | เป้าหมาย | ข้อมูล |
|---|---|---|
| `database/seed/seed.py` | db จาก `DATABASE_URL` | ข้อมูล TU จริง (partners, activities, PDF template อัปโหลดเข้า storage) |
| `seed_mock.py` | **เฉพาะ** sqlite หรือ db ที่ลงท้าย `_mock` | ชุดข้อมูล mock ของ frontend (8 partners, 10 activities, 7 documents, feedback, exchange, admin) |

```bash
# seed mock ลง mockdb (มี safety guard)
venv/Scripts/python seed_mock.py --database-url "$MOCK_DATABASE_URL" --yes

# ทำซ้ำได้: รันรอบสองจะเพิ่ม 0 แถว
```

`seed_mock.py` เขียนแค่ metadata ของเอกสาร — ถ้าอยากให้ดาวน์โหลดได้จริงบน S3 ต้องอัปโหลดไฟล์ PDF เพิ่ม (ดู key แบบ `mock/agreements/mock-doc-*.pdf`) หรือใช้ `STORAGE_BACKEND=local` เพื่อ serve จากดิสก์

## การรัน Test

```bash
cd backend
DATABASE_URL="postgresql://app_user:app_password@localhost:5432/partner_activity_test" ^
STORAGE_BACKEND=local ^
venv/Scripts/python -m pytest tests/ -q
```

- Test สร้าง/ลบตารางเองทุกเคส — ต้องใช้ **database แยกที่ทิ้งได้**
- ถ้าไม่มีไฟล์ `.env` storage จะ default เป็น `local` — CI รันโดยไม่ต้องมี AWS key เลย

## CI

GitHub Actions (`.github/workflows/ci.yml`) รันทุก push/PR:

1. **backend-test** — service container Postgres 15, ติดตั้ง `requirements.txt`, `pytest tests/ -v` ด้วย `DATABASE_URL` แบบใช้ครั้งเดียว
2. **frontend-build** — `npm install`, `npm run build` โดยตั้ง `NEXT_PUBLIC_API_URL`

ทั้งสอง job เป็น hermetic: ไม่มี `.env`, ไม่มี AWS key, ไม่แตะ RDS

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| `Error response from daemon: Conflict. The container name ... already in use` | container เก่าค้างชื่อซ้ำ | `docker rm -f <ชื่อ>` แล้ว `docker compose up` ใหม่ |
| หน้าเว็บโชว์ mock ตลอด ไม่เปลี่ยน | backend เข้าถึงไม่ได้ | ทดสอบ `curl http://localhost:8000/api/v1/health`; หน้าเว็บ fallback เป็น mock ตามดีไซน์ |
| ดาวน์โหลดเอกสารได้ 500 | มีแถว metadata แต่ไฟล์ไม่อยู่ใน storage | อัปโหลดไฟล์ไปยัง bucket/path ตาม `storageKey` หรืออัปโหลดเอกสารใหม่ |
| list endpoint คืน 404 ทั้งที่ควรมีข้อมูล | แถวยัง `is_published=false` | เปิด publish หรือเช็คว่า seed ลง db เดียวกับที่ backend ชี้อยู่ |
