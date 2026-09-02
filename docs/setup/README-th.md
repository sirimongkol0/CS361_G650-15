# คู่มือติดตั้ง V1

## สิ่งที่ต้องมี

- Docker Engine หรือ Docker Desktop ที่มี Docker Compose v2 (วิธีแนะนำ) หรือ
- Python 3.11+, Node.js 20+ และ PostgreSQL 15+ สำหรับรันแต่ละ process เอง

## วิธี A — Docker Compose จาก clean checkout

ไม่ต้องมีฐานข้อมูลบน cloud, AWS credentials หรือ language runtime ในเครื่อง
ให้รันจาก root ของ repository:

```bash
docker compose up --build -d
docker compose ps --all
python scripts/smoke_test.py
```

Compose เริ่ม service ตามลำดับต่อไปนี้:

1. รอ PostgreSQL healthy
2. `seed` service แบบ one-shot สร้าง schema และเพิ่มข้อมูล development แล้วต้อง
   จบด้วย exit code 0
3. backend เริ่มทำงานและจะ healthy ต่อเมื่อ query PostgreSQL ได้จริง
4. frontend เริ่มเมื่อ backend healthy แล้ว

จุดตรวจสอบ:

| URL | ผลที่ควรได้ |
|---|---|
| http://localhost:8000/api/v1/health | `{"status":"healthy"}` |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:3000 | redirect ไป `/dashboard/public` |
| http://localhost:3000/activities | รายการกิจกรรมที่ seed แล้ว |

ค่า default ที่ commit ไว้ใช้สำหรับ development เท่านั้นและไม่มี production
credential จึงไม่จำเป็นต้องมีไฟล์ `.env` ถ้าต้องการเปลี่ยน port หรือ credential
ของฐานข้อมูล local ให้คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่า หากเปลี่ยน
`BACKEND_PORT` ต้องเปลี่ยน port ใน `PUBLIC_API_URL` ให้ตรงกันด้วย เพราะ URL นี้
ถูกฝังใน browser bundle

คำสั่งจัดการระบบ:

```bash
# ตรวจ log ของ seed และ application
docker compose logs seed backend frontend

# หยุด container แต่เก็บข้อมูล PostgreSQL และไฟล์ upload ไว้
docker compose down

# ลบ container และข้อมูล development ในเครื่องทั้งหมด แล้วสร้างใหม่
docker compose down --volumes
docker compose up --build -d
```

PostgreSQL เปิด port เฉพาะ `127.0.0.1` และใช้ local file storage เป็นค่า default
ขั้นตอน Compose นี้ไม่เชื่อมต่อ RDS หรือ S3

## วิธี B — รัน process เอง

1. Backend (ค่า default เป็น SQLite จึงเริ่มได้โดยไม่ต้องตั้งค่า):

   ```bash
   cd backend
   python -m venv venv
   venv/Scripts/pip install -r requirements.txt
   copy .env.example .env
   venv/Scripts/python -m uvicorn main:app --reload --port 8000
   ```

   บน macOS/Linux ให้ใช้ `cp`, `venv/bin/pip` และ `venv/bin/python` หากต้องการ
   ใช้ PostgreSQL ให้แก้ `DATABASE_URL` ใน `backend/.env`

2. Frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## ตรวจ schema และ seed

Compose จะ seed ชุดข้อมูลที่ตรงกับ frontend ให้อัตโนมัติ การ seed เป็นแบบ
additive และ idempotent คือรันซ้ำแล้วไม่สร้างแถวซ้ำ

```bash
# เมื่อ Compose database กำลังรัน รอบที่สองต้องรายงานว่า insert 0
docker compose run --rm seed

# ชุดข้อมูล TU จริง สำหรับ local database ที่ตั้งค่าแยกไว้
python backend/seed.py
```

schema และ constraints อยู่ใน `backend/models.py` รายละเอียดกฎความถูกต้องอยู่ที่
`database/schema/README.md` ใน V1 ใช้ SQLAlchemy `create_all` สำหรับสร้าง schema
ใหม่และการเปลี่ยนแบบ additive เท่านั้น ไม่ได้ใช้แทน migration tool สำหรับ
production

## การทดสอบ

```bash
cd backend
python -m pytest tests/ -q

# ตรวจ full stack หลัง docker compose up
cd ..
python scripts/smoke_test.py
```

`test_seed_and_schema.py` สร้าง schema ใหม่ รัน seed สองรอบ เทียบจำนวนแถว ตรวจ
relationships และทดสอบ constraints ส่วน CI จะ build Compose จาก clean checkout
และรัน smoke script ด้วย

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| `seed` จบด้วย code ที่ไม่ใช่ 0 | schema, constraint หรือ database startup มีปัญหา | `docker compose logs seed database` |
| backend ไม่ healthy | backend query PostgreSQL ไม่ได้ | `docker compose logs backend database` |
| port ถูกใช้อยู่ | service อื่นใช้ 3000, 8000 หรือ 5432 | คัดลอก `.env.example` เป็น `.env`, เปลี่ยน port และแก้ `PUBLIC_API_URL` หากจำเป็น |
| ต้องการฐานข้อมูลใหม่จริง ๆ | named volume ยังเก็บข้อมูลเดิม | `docker compose down --volumes` แล้วเริ่มใหม่ |
| ดาวน์โหลดเอกสารที่ seed แล้วได้ 404 | mock seed เก็บเฉพาะ metadata | อัปโหลด PDF ผ่าน API โดยไฟล์ local จะอยู่ใน `backend_storage` |
