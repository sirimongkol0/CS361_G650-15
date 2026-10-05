# ฐานเดโมบน RDS

> อัปเดตล่าสุด: 6 ตุลาคม 2026

database `cstu_demo` บน RDS เป็นฐานข้อมูลที่เว็บ V2 บน Amplify ใช้อยู่จริง
เก็บ **ข้อมูลสมมติสำหรับสาธิต** แยกจากข้อมูลจริงอย่างชัดเจน

## อยู่ตรงไหน

| รายการ | ค่า |
|---|---|
| RDS instance | `cs361-partner-db` (region `ap-southeast-1`) |
| database เดโม | `cstu_demo` ใช้ role `cstu_demo_app` |
| database ข้อมูลจริง | `partner_activity` (ไม่ได้ใช้ใน deploy V2 และไม่ถูกแก้ไข) |
| ไฟล์ PDF | S3 `cs361-partner-docs` ใต้ `cstu-demo/v2/` |

สร้างเป็น database แยกบน instance เดิม เพื่อไม่ต้องจ่ายค่า RDS instance เพิ่ม
แต่ยังใช้ CPU, RAM และพื้นที่ร่วมกับฐานข้อมูลเดิม

## ความปลอดภัยของข้อมูลจริง

- role `cstu_demo_app` ไม่มีสิทธิ์ SUPERUSER, CREATEDB, CREATEROLE หรือ REPLICATION
- role เดโมอ่านตารางของ `partner_activity` ไม่ได้ (ทดสอบแล้วถูกปฏิเสธทุกตาราง)
- เชื่อมต่อแบบเข้ารหัส (`sslmode=require`)
- URL และรหัสผ่านเก็บในไฟล์ `.env.demo-rds` ที่ไม่ขึ้น git
- script seed ยอมทำงานกับ database ชื่อ `cstu_demo` เท่านั้น

## ข้อมูลตอนนี้

seed ใหม่จากโค้ดปัจจุบัน (`backend/seed_demo.py` + `backend/demo_expansion.py` เวอร์ชัน `cstu-fictional-v3`) เมื่อ 2 ตุลาคม 2026

| ตาราง | จำนวนทั้งหมด | แสดงบนเว็บ (เผยแพร่แล้ว) |
|---|---|---|
| หน่วยงาน (partners) | 32 | 29 |
| ข้อตกลง/เอกสาร (documents) | 25 | 23 |
| กิจกรรม (activities) | 105 | 93 |
| feedback | 45 | ไม่แสดงใน V2 |
| นักศึกษาแลกเปลี่ยน | 30 | ไม่แสดงใน V2 |

ชื่อหน่วยงานตัวอย่าง: มหาวิทยาลัยรุ่งอรุณวิทยา, Sakuragaoka Institute of Technology,
บริษัท โค้ดช่างฝีมือ จำกัด (CodeCraft Studio)
เอกสาร 5 ฉบับมีไฟล์ PDF ให้ดาวน์โหลดได้

ก่อน seed ใหม่ ได้สำรองข้อมูลชุดเก่าไว้เป็นไฟล์ JSON บนเครื่อง EC2 ที่ `~/cs361/`

## รันเดโมบนเครื่องตัวเองโดยต่อ RDS

ต้องมีไฟล์ `.env.demo-rds` ที่มี `DEMO_RDS_DATABASE_URL` ก่อน

```powershell
docker compose --env-file .env.demo-rds -f docker-compose.demo.yml -f docker-compose.demo-s3.yml -f docker-compose.demo-rds.yml up -d --wait
```

เปิด http://localhost:3100 จะเห็นข้อมูลชุดเดียวกับเว็บบน Amplify

## seed ข้อมูลใหม่

ทำตามขั้นตอนใน [การ deploy V2](decisions/v2-deployment-amplify-ec2.md#seed-ข้อมูลเดโมใหม่)
การ seed ใหม่ **ลบข้อมูลทั้งหมดใน `cstu_demo`** ต้องสำรองก่อนทุกครั้ง

## หมายเหตุ

`infra/provision_demo_rds.py` เป็นทางเลือกสำหรับสร้าง RDS instance แยกในอนาคต
ไม่ได้ใช้กับระบบตอนนี้ และไม่ควรรันด้วย `--apply`
