# คู่มือติดตั้ง V2

การเตรียมข้อมูลตัวอย่างแบบแยกฐานข้อมูลและทดสอบ browser ดูที่
[คู่มือ Demo V2](../demo-v2.md) ระบบสาธารณะเป็น read-only; การแก้ไขตามสิทธิ์เป็น V3+

## สิ่งที่ต้องมี

- Docker Engine หรือ Docker Desktop ที่มี Docker Compose v2 (วิธีแนะนำ) หรือ
- Python 3.11+, Node.js 22+ และ PostgreSQL 16+ สำหรับรันแต่ละ process เอง

## วิธี A — Docker Compose จาก clean checkout

ไม่ต้องมีฐานข้อมูลบน cloud, AWS credentials หรือ language runtime ในเครื่อง
ให้รันจาก root ของ repository:

```bash
docker compose up --build -d --wait
docker compose ps --all
python scripts/smoke_test.py
```

Compose เริ่ม service ตามลำดับต่อไปนี้:

1. รอ PostgreSQL healthy
2. backend สร้างตารางที่ยังไม่มี แล้วจะ healthy ต่อเมื่อ query PostgreSQL ได้จริง
3. frontend เริ่มเมื่อ backend healthy แล้ว

ฐานข้อมูล local เริ่มต้นแบบว่าง หน้ารายการจะแสดงสถานะ "ยังไม่มีข้อมูล" จนกว่าจะเพิ่มข้อมูล

จุดตรวจสอบ:

| URL | ผลที่ควรได้ |
|---|---|
| http://localhost:8000/api/v1/health | `{"status":"healthy"}` |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:3000 | redirect ไป `/dashboard/public` |
| http://localhost:3000/activities | รายการกิจกรรม (ว่างเมื่อเป็นฐานข้อมูลใหม่) |
| http://localhost:3000/stakeholders | รายการหน่วยงาน |
| http://localhost:3000/documents | รายการเอกสาร ตัวกรอง และดาวน์โหลด |

ค่า default ที่ commit ไว้ใช้สำหรับ development เท่านั้นและไม่มี production
credential จึงไม่จำเป็นต้องมีไฟล์ `.env` ถ้าต้องการเปลี่ยน port หรือ credential
ของฐานข้อมูล local ให้คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่า หากเปลี่ยน
`BACKEND_PORT` ต้องเปลี่ยน port ใน `PUBLIC_API_URL` ให้ตรงกันด้วย เพราะ URL นี้
ถูกฝังใน browser bundle

คำสั่งจัดการระบบ:

```bash
# ตรวจ log ของ application
docker compose logs backend frontend

# หยุด container แต่เก็บข้อมูล PostgreSQL และไฟล์ upload ไว้
docker compose down

# ลบ container และข้อมูล development ในเครื่องทั้งหมด แล้วสร้างใหม่
docker compose down --volumes
docker compose up --build -d --wait
```

PostgreSQL เปิด port เฉพาะ `127.0.0.1` และใช้ local file storage เป็นค่า default
ขั้นตอน Compose นี้ไม่เชื่อมต่อ RDS หรือ S3

## วิธี B — รัน process เอง

1. Backend (ค่า default เป็น SQLite จึงเริ่มได้โดยไม่ต้องตั้งค่า):

   ```bash
   cd backend
   python -m venv venv
   venv/Scripts/pip install -r requirements.txt
   venv/Scripts/python -m uvicorn main:app --reload --port 8000
   ```

   บน macOS/Linux ให้ใช้ `venv/bin/pip` และ `venv/bin/python` หากต้องการ
   ใช้ PostgreSQL ให้แก้ `DATABASE_URL` ใน `backend/.env`

2. Frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Schema

schema และ constraints อยู่ใน `backend/models.py` รายละเอียดกฎความถูกต้องอยู่ที่
`database/schema/README.md` เมื่อสร้างฐานข้อมูลใหม่ใน V2 ใช้ SQLAlchemy `create_all` สำหรับสร้าง schema
ใหม่และการเปลี่ยนแบบ additive เท่านั้น ไม่ได้ใช้แทน migration tool สำหรับ
production ฐานข้อมูลเดิมต้องหยุด API และรัน `python backend/migrate_v2.py`
โดยตั้ง DATABASE_URL ของฐานข้อมูลนั้นก่อนเริ่ม API ใหม่ และสำรองข้อมูลก่อน migration

## การทดสอบ

```bash
cd backend
python -m pytest tests/ -q

# ตรวจ full stack หลัง docker compose up
cd ..
python scripts/smoke_test.py
```

tests สร้างข้อมูลเองจาก `backend/tests/sample_data.py` โดย `test_seed_and_schema.py`
ตรวจว่าชุดข้อมูลนี้สอดคล้องกันเองและทดสอบ constraints ส่วน CI จะ build Compose
จาก clean checkout และรัน smoke script ด้วย

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| backend ไม่ healthy | backend query PostgreSQL ไม่ได้ | `docker compose logs backend database` |
| port ถูกใช้อยู่ | service อื่นใช้ 3000, 8000 หรือ 5432 | คัดลอก `.env.example` เป็น `.env`, เปลี่ยน port และแก้ `PUBLIC_API_URL` หากจำเป็น |
| ต้องการฐานข้อมูลใหม่จริง ๆ | named volume ยังเก็บข้อมูลเดิม | `docker compose down --volumes` แล้วเริ่มใหม่ |
| ดาวน์โหลดเอกสารได้ 404 | เอกสารมีเฉพาะ metadata หรือไฟล์หาย | ตรวจ fileAvailability และไฟล์ที่ storage; API สาธารณะไม่เปิดอัปโหลด |
