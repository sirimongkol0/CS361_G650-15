# สถาปัตยกรรมระบบ V2

> อัปเดตล่าสุด: 6 ตุลาคม 2026 · ใช้กับ V2 – Collaboration Repository

เอกสารนี้อธิบายว่าระบบ V2 ที่ deploy จริงประกอบด้วยอะไรบ้าง และข้อมูลวิ่งผ่านส่วนไหน
ถ้าอยากรู้ว่า **ทำไม** เลือกแบบนี้ ดู [บันทึกการตัดสินใจ deploy V2](../decisions/v2-deployment-amplify-ec2.md)

![สถาปัตยกรรมการ deploy ระบบ V2](v2-deploy-architecture.png)

เปิดไฟล์ [v2-deploy-architecture.html](v2-deploy-architecture.html) ในเบราว์เซอร์เพื่อดู diagram พร้อมตารางอธิบายแต่ละขั้นตอน

## ส่วนประกอบหลัก

| ส่วน | บริการ | หน้าที่ |
|---|---|---|
| หน้าเว็บ | **AWS Amplify Hosting** | รัน Next.js แบบ SSR, ให้ HTTPS และ build ใหม่อัตโนมัติเมื่อ push เข้า `main` |
| API | **FastAPI ใน Docker บน EC2** (`CS361-ec2`) | ให้ข้อมูลหน่วยงาน ข้อตกลง กิจกรรม และไฟล์เอกสาร |
| ฐานข้อมูล | **RDS PostgreSQL** (`cs361-partner-db`) | เก็บข้อมูลใน database `cstu_demo` |
| ไฟล์เอกสาร | **S3** (`cs361-partner-docs`) | เก็บไฟล์ PDF ใต้ `cstu-demo/v2/` |
| ซอร์สโค้ด | **GitHub** | branch `main` เป็นต้นทางของการ deploy frontend |

ทุกบริการอยู่ใน region **ap-southeast-1 (Singapore)**

## ข้อมูลวิ่งอย่างไร

1. **ผู้ใช้เปิดเว็บ** ผ่าน HTTPS ที่ `https://main.d5kr2senr2j9o.amplifyapp.com`
2. **หน้าเว็บขอข้อมูล** โดยเรียก `/api/v1/...` บนโดเมนเดียวกัน
   Next.js ส่งต่อ (rewrite) คำขอไปที่ FastAPI บน EC2 port 8000 ให้เอง
   เบราว์เซอร์จึงไม่ต้องรู้ที่อยู่ของ backend และไม่เจอปัญหา HTTPS ปน HTTP
3. **FastAPI อ่านฐานข้อมูล** จาก RDS ผ่านการเชื่อมต่อแบบเข้ารหัส (TLS)
   และส่งกลับเฉพาะข้อมูลที่เผยแพร่แล้ว
4. **ดาวน์โหลดเอกสาร** ผ่าน `/api/v1/documents/{id}/download`
   FastAPI ดึงไฟล์จาก S3 ด้วย IAM role ของเครื่อง EC2 ไม่มีการส่ง AWS key ให้หน้าเว็บ
5. **อัปเดตหน้าเว็บ** เมื่อ push เข้า `main` บน GitHub แล้ว Amplify จะ build และ deploy ให้เอง
   (ส่วน backend ต้อง deploy เอง ดู[คู่มือ deploy](../decisions/v2-deployment-amplify-ec2.md#ส่วนที่-2-วิธี-deploy))

## สิ่งที่ระบบ V2 ทำได้

- ดูรายการ ดูรายละเอียด ค้นหา และกรอง **หน่วยงาน ข้อตกลง และกิจกรรม**
- เปิดดูความสัมพันธ์ หน่วยงาน ↔ ข้อตกลง ↔ กิจกรรม
- ดาวน์โหลดเอกสาร PDF ที่เตรียมไว้
- แสดงเฉพาะข้อมูลที่เผยแพร่แล้ว (คงการป้องกันจาก V1)

**ยังไม่อยู่ใน V2:** การเพิ่ม/แก้ไข/ลบ การอัปโหลดผ่านหน้าเว็บ และระบบสิทธิ์ผู้ใช้ (อยู่ใน V3 เป็นต้นไป)

## ข้อมูลที่ใช้

database `cstu_demo` เป็น **ข้อมูลสมมติสำหรับสาธิต** ทุกหน้าในเว็บมีป้าย "ระบบสาธิต · ข้อมูลตัวอย่าง"
ข้อมูลจริงอยู่แยกใน database `partner_activity` บน RDS เครื่องเดียวกัน และไม่ได้ใช้ใน deploy นี้
รายละเอียดชุดข้อมูลดูที่ [ฐานเดโมบน RDS](../demo-rds.md)

## ข้อจำกัดที่ควรรู้

- **IP ของ EC2 ไม่ถาวร** ถ้า stop แล้ว start เครื่องใหม่ IP จะเปลี่ยน
  ต้องแก้ค่า env ใน Amplify ตาม ส่วน reboot ทำได้ปกติ
- **backend มีเครื่องเดียว** ถ้า EC2 ล่ม หน้าเว็บยังเปิดได้แต่ไม่มีข้อมูล
- **ไม่มี load balancer และไม่มี Multi-AZ** เหมาะกับการสาธิตและผู้ใช้จำนวนน้อย

## เอกสารที่เกี่ยวข้อง

- [บันทึกการตัดสินใจและคู่มือ deploy V2](../decisions/v2-deployment-amplify-ec2.md)
- [คู่มือ infrastructure](../../infra/README.md)
- [สัญญา field ของ V2](../api/v2-field-contract.md)
- [สถาปัตยกรรม V1](v1-architecture-th.md) (ประวัติ) และ
  [diagram การ deploy แบบ EC2 เครื่องเดียว](deploy-architecture-diagram.svg) (แบบเดิมก่อนย้าย frontend ไป Amplify)
