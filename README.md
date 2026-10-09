# PCSMS – ระบบจัดการความร่วมมือและผู้มีส่วนได้ส่วนเสียของหลักสูตร CSTU

ระบบติดตามความร่วมมือของ **หลักสูตรวิทยาการคอมพิวเตอร์ ระดับปริญญาตรี มหาวิทยาลัยธรรมศาสตร์ ศูนย์รังสิต**
มีส่วนข้อมูลสาธารณะที่ได้รับอนุญาตให้เผยแพร่ และ (ในเวอร์ชันถัดไป) พื้นที่ทำงานภายในสำหรับผู้ที่ได้รับสิทธิ์

เกณฑ์ว่าข้อมูลแบบไหนนับเป็นของหลักสูตร แผนพัฒนา V1–V7 และรายการข้อมูลเดิมที่รอตรวจ
ดูที่ [ขอบเขตหลักสูตร CSTU](docs/decisions/cstu-program-scope.md)
(เอกสารนี้ไม่ได้รับรองว่าข้อมูลที่มีอยู่เดิมเป็นของ CSTU)

## เวอร์ชันปัจจุบัน: V2 – Collaboration Repository

คลังข้อมูลสาธารณะแบบอ่านอย่างเดียว ของหน่วยงานคู่ความร่วมมือ ข้อตกลง MoU/MoA เอกสาร และกิจกรรมที่เผยแพร่แล้ว
สร้างด้วย **Next.js + FastAPI + PostgreSQL**

## เว็บที่ deploy แล้ว

**https://main.d5kr2senr2j9o.amplifyapp.com** (ข้อมูลสมมติสำหรับสาธิต)

- หน้าเว็บ Next.js อยู่บน AWS Amplify ส่วน API อยู่บน EC2 ข้อมูลอยู่บน RDS และไฟล์อยู่บน S3
- push เข้า `main` แล้วหน้าเว็บอัปเดตเอง ส่วน backend ต้อง deploy เอง
- ดูภาพรวมที่ [สถาปัตยกรรมระบบ V2](docs/architecture/v2-architecture.md)
  และวิธี deploy ที่ [การ deploy V2](docs/decisions/v2-deployment-amplify-ec2.md)

## รันบนเครื่องตัวเอง

ทุกแบบใช้ฐานข้อมูลแยกกัน ข้อมูลไม่ปนกัน
รายละเอียดของแต่ละแบบดูที่ [คู่มือ infrastructure](infra/README.md)

### 1. เดโมข้อมูลสมมติ (แนะนำสำหรับนำเสนอ)

```powershell
docker compose -f docker-compose.demo.yml up --build -d --wait
```

เปิด http://localhost:3100/dashboard/public

- ใช้ฐานข้อมูล PostgreSQL `cstu_demo` และพื้นที่เก็บไฟล์ที่แยกออกมา
- ทุกหน้ามีป้ายบอกว่าเป็นข้อมูลสมมติ
- ข้อมูลทุกอย่างมาจาก API และฐานข้อมูลจริง หน้าเว็บไม่มีข้อมูลตัวอย่างสำรองในตัว
- ไม่กระทบฐานข้อมูล CSTU จริงที่ port 3000

ดูข้อมูลที่ครอบคลุมและวิธีเตรียม/ตรวจซ้ำที่ [คู่มือเดโมข้อมูลสมมติ](docs/demo-fictional.md)

**ถ้าต้องการให้เดโมอ่านไฟล์ PDF จาก S3** (แบบที่เครื่องหลักใช้อยู่) ให้รัน Compose สองไฟล์ร่วมกัน:

```powershell
docker compose -f docker-compose.demo.yml -f docker-compose.demo-s3.yml up -d --wait
```

ก่อนเปิดใช้ S3 บนเครื่องใหม่ ดู [เอกสารเดโมบน S3](docs/demo-s3.md)

### 2. ฐานข้อมูล CSTU จริง

```powershell
docker compose --env-file .env.cstu -f docker-compose.cstu.yml up --build -d --wait
python scripts/smoke_test.py --api http://localhost:3000/api/v1
```

- ต้องสร้างไฟล์ `.env.cstu` ก่อน
- ฐานข้อมูลเริ่มต้นว่าง และใช้พื้นที่เก็บเอกสารแยก

วิธีตั้งรหัสผ่านบนเครื่องใหม่ การเก็บข้อมูลถาวร และการสลับกลับไปใช้ RDS เดิม
ดูที่ [ฐานข้อมูล CSTU](docs/setup/cstu-database.md)

### 3. สำหรับพัฒนาทั่วไป

```bash
docker compose up --build -d --wait
python scripts/smoke_test.py
```

เปิด http://localhost:3000/dashboard/public

- ไม่ต้องมีไฟล์ `.env` และไม่ต้องใช้ AWS
- ฐานข้อมูลเริ่มต้นว่าง

## V2 ทำอะไรได้บ้าง

- ดูรายการและรายละเอียดของหน่วยงาน ข้อตกลง และกิจกรรม
- ค้นหาและกรองหลายเงื่อนไขพร้อมกัน เรียงลำดับ และแบ่งหน้า
- ส่งออก CSV
- ค้นหาทั้งระบบด้วย **Ctrl+K**
- ดูตัวอย่าง PDF และดาวน์โหลดเอกสาร
- ดูความสัมพันธ์ระหว่างข้อมูลที่เผยแพร่แล้ว และแหล่งอ้างอิงของข้อมูล

API สาธารณะมีเฉพาะการอ่าน (GET) ของ health, partners, documents และ activities

**ยังไม่มีใน V2:** การอัปโหลดหรือลบเอกสาร, API ของ users, feedback และ exchange,
การเข้าสู่ระบบ และการแก้ไขข้อมูลโดยผู้มีสิทธิ์ (อยู่ใน V3 เป็นต้นไป)

### การแสดงผลข้อมูล

- กิจกรรมที่ไม่รู้สถานะหรือจำนวนผู้เข้าร่วม จะแสดงว่า "ไม่ทราบ"
- วันที่คงความหมายเดิมไว้ เช่น วันประกาศ หรือวันปิดรับสมัคร
  และแสดงตามความละเอียดที่มี (เดือน, ปี หรือโดยประมาณ)
- หน้า dashboard เรียงกิจกรรมจากใหม่ไปเก่า
  และจำนวนข้อตกลงไม่นับแบบฟอร์มและประกาศ

## ข้อมูลทดสอบ

- หน้าเว็บไม่เคยแสดงข้อมูลทดสอบแทนข้อมูลจาก API ฐานข้อมูลใหม่จึงเริ่มต้นว่าง
- tests ใช้ข้อมูลสังเคราะห์ใน `backend/tests/sample_data.py`
- `scripts/prepare_v2_validation.py` เตรียมเฉพาะฐานข้อมูลชั่วคราวชื่อ `*_test` หรือไฟล์ `*_test.db`
  ข้อมูลเหล่านี้ไม่ใช่ข้อตกลงจริงของมหาวิทยาลัย
- ถ้าต้องการสภาพแวดล้อมทดสอบแยก ทำตาม [คู่มือเดโมและการตรวจ V2](docs/demo-v2.md)

## เอกสาร

**V3 (กำลังพัฒนา)**

- [คู่มือ Login และสิทธิ์ตามบทบาท](docs/setup/v3-auth.md)
- [ตารางสิทธิ์ตามบทบาท (ร่าง)](docs/decisions/v3-role-permissions.md)

**ระบบปัจจุบัน (V2)**

- [สถาปัตยกรรมระบบ V2](docs/architecture/v2-architecture.md)
- [การ deploy V2: Amplify + EC2 + RDS + S3](docs/decisions/v2-deployment-amplify-ec2.md)
- [คู่มือ infrastructure](infra/README.md)
- [คู่มือติดตั้ง](docs/setup/README-th.md)
- [ขอบเขตหลักสูตร CSTU และแผนพัฒนา](docs/decisions/cstu-program-scope.md)
- [ฐานข้อมูล CSTU](docs/setup/cstu-database.md)
- [สัญญา field ของ V2](docs/api/v2-field-contract.md)
- [คู่มือเดโมและการตรวจ API/เบราว์เซอร์ของ V2](docs/demo-v2.md)
- [เดโมข้อมูลสมมติ](docs/demo-fictional.md) · [เดโมบน S3](docs/demo-s3.md) · [ฐานเดโมบน RDS](docs/demo-rds.md)
- [การปรับปรุงและผลตรวจ V2 ล่าสุด](docs/evidence/v2-improvements.md)

**ประวัติ V1**

- [สถาปัตยกรรม V1](docs/architecture/v1-architecture-th.md)
- [สัญญา API V1](docs/api/v1-api-contract-th.md)
- [การตัดสินใจด้านเทคโนโลยี V1](docs/decisions/v1-tech-stack-th.md)
- [การ deploy V1](docs/decisions/v1-deployment-ec2.md)
- [หลักฐานความพร้อม V1](docs/evidence/v1-readiness.md)

เอกสารภาษาอังกฤษ: [Setup guide](docs/setup/README.md) ·
[Architecture V1](docs/architecture/v1-architecture.md) ·
[API contract V1](docs/api/v1-api-contract.md) ·
[Technology decisions V1](docs/decisions/v1-tech-stack.md)

ไฟล์ PDF ใน `docs/pdf` เป็นเวอร์ชันเก่าที่ export ไว้ ให้ใช้ไฟล์ Markdown ที่ลิงก์ไว้ด้านบนเป็นหลัก
