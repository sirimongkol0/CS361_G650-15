# ฐานเดโมแยกบน RDS เดิม

วันที่ 2 ตุลาคม 2026 ผู้ใช้เลือกสร้าง database แยกบน instance เดิมเพื่อลดค่าใช้จ่าย
ไม่ได้สร้าง RDS instance ใหม่

- Instance เดิม: `cs361-partner-db`, region `ap-southeast-1`
- Database เดิมที่ตรวจพบจริง: `partner_activity`
- Database เดโม: `cstu_demo`, role: `cstu_demo_app`
- Role เดโมไม่มี SUPERUSER, CREATEDB, CREATEROLE หรือ REPLICATION
- ถอนสิทธิ์ PUBLIC ของ database เดโม และไม่ให้สิทธิ์ตารางฐานเดิมแก่ role เดโม
- ตรวจ SELECT ทุกตาราง public ของฐานเดิมด้วย role เดโมแล้วถูกปฏิเสธ
- PostgreSQL อาจอนุญาต connection ไปฐานเดิมผ่าน PUBLIC แต่ไม่มีสิทธิ์อ่านตาราง
  ไม่เปลี่ยนสิทธิ์ PUBLIC ของฐานเดิมเพื่อไม่กระทบผู้ใช้เดิม
- เชื่อมต่อด้วย TLS (`sslmode=require`) และเก็บ URL/password ใน `.env.demo-rds` ที่ ignored
- เอกสารยังใช้ S3 ตาม `docker-compose.demo-s3.yml`

## รันระบบ

```powershell
docker compose --env-file .env.demo-rds -f docker-compose.demo.yml -f docker-compose.demo-s3.yml -f docker-compose.demo-rds.yml up -d --wait
```

ระบบเดโมเปิดที่ http://localhost:3100 ใช้ API และ RDS จริง
Seed จำกัดชื่อ database เป็น `cstu_demo` และปฏิเสธการทับข้อมูลที่ไม่ใช่ชุดเดโม
Local PostgreSQL volume เดิมยังเก็บไว้

## ผลตรวจ

- RDS `cstu_demo`: partners 12, documents 8, activities 15
- ยืนยัน TLS ผ่าน `pg_stat_ssl`
- จำนวนแถวทุกตาราง public ใน `partner_activity` ก่อนและหลังเท่ากัน
- ไม่มีการสร้าง instance ใหม่ แต่ยังใช้ CPU/RAM/storage ร่วมกับ RDS เดิม
  การใช้งานพื้นที่หรือทรัพยากรที่เพิ่มขึ้นอาจมีค่าใช้จ่าย

`infra/provision_demo_rds.py` เป็นทางเลือกสำหรับ instance แยกในอนาคต
ไม่ใช่ deployment ที่ใช้อยู่ และไม่ควรรัน `--apply` สำหรับการตั้งค่าปัจจุบัน
