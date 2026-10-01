# ฐานข้อมูลแยกสำหรับ CSTU

วันที่ 2 ตุลาคม 2026 แยกชุด local Docker เป็น Compose project `cs361-cstu`
โดยใช้ `docker-compose.cstu.yml` และ `.env.cstu` แทนชุด `cs361-deploy`
ที่ใช้ RDS จาก `.env` เดิม

## การแยกข้อมูล

- PostgreSQL 16 ใน container `cs361-cstu-database-1`
- ฐานข้อมูล `cstu_collaboration`, ผู้ใช้ `cstu_app`
- Docker volume `cs361-cstu_cstu_postgres_data` เก็บข้อมูลถาวร
- Docker volume `cs361-cstu_cstu_backend_storage` เก็บไฟล์แยกจากชุดเดิม
- ฐานข้อมูลไม่เปิดพอร์ตออกจาก Docker network
- เว็บเปิดที่ `http://localhost:3000/dashboard/public`
- API ผ่าน origin เดียวกับเว็บที่ `http://localhost:3000/api/v1`
  หรือ loopback `http://localhost:8000/api/v1`
- Backend สร้างตารางตามโมเดลปัจจุบันเมื่อเริ่มทำงาน
  ฐานข้อมูลใหม่ไม่มีข้อมูลธุรกิจ และไม่ได้ seed ข้อมูลทดสอบ

ฐาน RDS, `.env` เดิม, ข้อมูลและไฟล์ของชุดเดิมยังเก็บไว้
การแยกครั้งนี้ไม่ได้คัดลอกหรือแก้ข้อมูลเดิม ต้องคัดข้อมูลที่มีหลักฐาน
ความเกี่ยวข้องกับ CSTU ก่อนนำเข้าตาม [ขอบเขตที่ตกลง](../decisions/cstu-program-scope.md)

## เปิดระบบในเครื่องนี้

รหัสผ่านสุ่มถูกบันทึกไว้ใน `.env.cstu` ซึ่งไม่ควร commit หรือเผยแพร่
ให้ใช้ไฟล์นี้กับ volume เดิมต่อไป ไม่สร้างรหัสผ่านใหม่ทุกครั้งที่เปิดระบบ

```powershell
docker compose --env-file .env.cstu -f docker-compose.cstu.yml up --build -d --wait
python scripts/smoke_test.py --api http://localhost:3000/api/v1
```

ใช้ `docker compose` โดยระบุไฟล์และ env ข้างต้นเสมอสำหรับชุด CSTU
คำสั่งที่ใช้ `docker-compose.deploy.yml` ยังคงเชื่อม RDS เดิม

หากนำ source ไปใช้เครื่องใหม่ ให้คัดลอก `.env.cstu.example` เป็น `.env.cstu`
แล้วตั้งรหัสผ่านสุ่มเป็น hexadecimal ก่อนเปิดระบบ
ไฟล์นี้ใช้ตัวแปร CSTU แยกจากการตั้งค่า RDS เดิม

## หยุดและเปิดอีกครั้ง

```powershell
docker compose --env-file .env.cstu -f docker-compose.cstu.yml stop
docker compose --env-file .env.cstu -f docker-compose.cstu.yml up -d --wait
```

การ stop/start หรือ recreate container ยังคงข้อมูลใน volume
หลีกเลี่ยง `down --volumes` และการลบ volume หากต้องการเก็บข้อมูลไว้

## ตรวจฐานข้อมูลโดยไม่แสดงรหัสผ่าน

```powershell
docker compose --env-file .env.cstu -f docker-compose.cstu.yml exec -T database psql -U cstu_app -d cstu_collaboration -c "SELECT current_database(), current_user;"
docker compose --env-file .env.cstu -f docker-compose.cstu.yml ps
```

## กลับไปใช้ชุดเดิม

ชุด CSTU และชุดเดิมใช้พอร์ต 3000/8000 เดียวกัน จึงเปิดทีละชุด
หากต้องการกลับไปชุดเดิม ให้หยุด CSTU ก่อน:

```powershell
docker compose --env-file .env.cstu -f docker-compose.cstu.yml stop
docker compose -f docker-compose.deploy.yml up -d --wait
```

การเปลี่ยนนี้เป็นฐานข้อมูล local แยกสำหรับพัฒนาและคัดข้อมูล CSTU
ยังไม่ได้สร้างฐาน CSTU บน AWS หรือปรับระบบที่อยู่บน EC2
