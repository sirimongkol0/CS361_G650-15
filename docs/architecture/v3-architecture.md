# สถาปัตยกรรมระบบ V3

> อัปเดตล่าสุด: 19 ตุลาคม 2026 · ใช้กับ V3 – ระบบสิทธิ์ผู้ใช้และการแก้ไขข้อมูล

V3 ยังใช้โครงสร้าง deploy เดิมของ [V2](v2-architecture.md) (Amplify + EC2 + RDS + S3)
และเพิ่ม **การเข้าสู่ระบบด้วย Amazon Cognito** **สิทธิ์ตามบทบาท** **การแก้ไขข้อมูลผ่านหน้าเว็บ**
และ **audit log** ของทุกการแก้ไข

![สถาปัตยกรรมการ deploy ระบบ V3](v3-deploy-architecture.png)

เปิดไฟล์ [v3-deploy-architecture.html](v3-deploy-architecture.html) ในเบราว์เซอร์เพื่อดู diagram พร้อมตารางอธิบายแต่ละขั้นตอน

## ส่วนประกอบหลัก

| ส่วน | บริการ | หน้าที่ |
|---|---|---|
| หน้าเว็บ | **AWS Amplify Hosting** | รัน Next.js แบบ SSR ทั้งหน้าดูข้อมูลและฟอร์มเพิ่ม/แก้ไข และส่งต่อ `/api/v1` ไป backend |
| การเข้าสู่ระบบ | **Amazon Cognito** (user pool `ap-southeast-1_xMmT7e1aL`) | เก็บบัญชีและรหัสผ่าน ออก token และเก็บบทบาทเป็น group (`public` `student` `coordinator` `staff` `admin`) |
| API | **FastAPI ใน Docker บน EC2** (`CS361-ec2`, t2.micro) | ตรวจ token ตรวจสิทธิ์ อ่าน/เขียนข้อมูล และบันทึก audit log |
| ฐานข้อมูล | **RDS PostgreSQL 16** (`cs361-partner-db`, db.t3.micro) | ข้อมูลหน่วยงาน ข้อตกลง เอกสาร กิจกรรม การแลกเปลี่ยน ผู้ใช้ และ `audit_logs` |
| ไฟล์เอกสาร | **S3** (`cs361-partner-docs`) | เก็บ PDF ที่อัปโหลดผ่านหน้าเว็บ |
| ซอร์สโค้ด | **GitHub** | branch `main` เป็นต้นทางของการ deploy frontend |

ทุกบริการอยู่ใน region **ap-southeast-1 (Singapore)**

## ข้อมูลวิ่งอย่างไร

1. **เปิดเว็บ** ผ่าน HTTPS ที่ `https://main.d5kr2senr2j9o.amplifyapp.com`
   หน้าเว็บเรียก `/api/v1/...` บนโดเมนเดียวกัน
2. **ส่งต่อคำขอ** Next.js rewrite `/api/v1/*` ไปยัง FastAPI บน EC2 port 8000
   หลัง sign in ทุกคำขอแนบ `Authorization: Bearer <token>`
3. **Sign in และตรวจสิทธิ์**
   - หน้า `/login` ส่ง email และรหัสผ่านไปที่ `POST /api/v1/auth/login`
     backend เป็นผู้ส่งไปตรวจที่ Cognito แล้วคืน access token ให้หน้าเว็บ
     **เบราว์เซอร์ไม่ได้คุยกับ Cognito โดยตรง**
   - คำขอถัดไป `backend/auth.py` ตรวจลายเซ็น token กับ JWKS ของ Cognito
     แล้วแต่ละ endpoint ใช้ `require_role(...)` ตาม[ตารางสิทธิ์ V3](../decisions/v3-role-permissions.md)
   - ไม่มี token หรือ token ไม่ถูกต้อง → **401** · token ถูกต้องแต่บทบาทไม่พอ → **403**
   - ผู้ใช้ทั่วไปไม่ต้อง sign in และเห็นเฉพาะข้อมูลที่เผยแพร่แล้ว
4. **อ่าน/เขียนข้อมูล** FastAPI ใช้ RDS ผ่านการเชื่อมต่อแบบเข้ารหัส (TLS)
   ทุกการเพิ่ม แก้ไข ลบ และเปลี่ยนสถานะ บันทึกลง `audit_logs` (`backend/audit.py`)
   พร้อมข้อมูลก่อน/หลัง และ commit ใน transaction เดียวกับการแก้ไข
5. **เอกสาร PDF** backend อัปโหลดและแทนไฟล์บน S3 ด้วย IAM role ของเครื่อง EC2
   - เอกสารที่เผยแพร่แล้ว ดาวน์โหลดผ่าน `/api/v1/documents/{id}/download`
   - เอกสารภายใน ผู้มีสิทธิ์ขอลิงก์จาก `/api/v1/documents/{id}/internal-url`
     ได้ presigned URL อายุสั้นไปดาวน์โหลดจาก S3 โดยตรง
   - หน้าเว็บไม่เคยได้ AWS key
6. **อัปเดตหน้าเว็บ** push เข้า `main` แล้ว Amplify build และ deploy frontend ให้เอง
   ส่วน backend ต้อง deploy เองเหมือน V2

## บทบาทผู้ใช้

| บทบาท | ทำอะไรได้โดยสรุป |
|---|---|
| `public` | ดูข้อมูลที่เผยแพร่แล้ว (ไม่ต้อง sign in) |
| `student` | ดูข้อมูลที่เกี่ยวกับตน เช่น ข้อมูลการแลกเปลี่ยนของตน |
| `coordinator` | เพิ่มและแก้ไขรายการที่ตนรับผิดชอบ ยังเผยแพร่เองไม่ได้ |
| `staff` | จัดการข้อมูลทั้งหมด อนุมัติ เผยแพร่ ลบ และดู audit log |
| `admin` | ทุกอย่างของ staff + จัดการบัญชีและสิทธิ์ |

รายละเอียดเต็มดูที่ [สิทธิ์ตามบทบาทของ V3](../decisions/v3-role-permissions.md)

## สิ่งที่เพิ่มจาก V2

- เข้าสู่ระบบด้วย Cognito และสิทธิ์ตามบทบาท 5 ระดับ (ตรวจฝั่ง server ทุก endpoint)
- เพิ่ม/แก้ไข/ลบ หน่วยงาน ข้อตกลง กิจกรรม และข้อมูลการแลกเปลี่ยนนักศึกษาผ่านหน้าเว็บ
- วงจรสถานะของข้อตกลง (ร่าง → อนุมัติ → มีผล/หมดอายุ/ยกเลิก) และการเผยแพร่
- อัปโหลดและแทนไฟล์ PDF ผ่านหน้าเว็บ
- audit log ของทุกการแก้ไข

## ข้อจำกัดที่ควรรู้

ยังเหมือน V2:

- **IP ของ EC2 ไม่ถาวร** ถ้า stop แล้ว start ใหม่ ต้องแก้ค่า env ใน Amplify
- **backend มีเครื่องเดียว** ถ้า EC2 ล่ม หน้าเว็บยังเปิดได้แต่ไม่มีข้อมูลและแก้ไขไม่ได้
- **ไม่มี load balancer และไม่มี Multi-AZ**

- **RDS เปิด `PubliclyAccessible`** ความปลอดภัยจึงขึ้นกับ security group ของฐานข้อมูล
  diagram วาด DB subnet group แยกไว้ แต่ฐานข้อมูลยังรับการเชื่อมต่อจากนอก VPC ได้ถ้า security group อนุญาต

เพิ่มใน V3:

- **IAM role ยังไม่มี `s3:DeleteObject`** (policy `CS361-EC2-AppRuntime` มีแค่ `ListBucket`, `GetObject`, `PutObject`)
  การแทนไฟล์หรือลบเอกสารจึงลบไฟล์เก่าบน S3 ไม่ได้ และ `storage.delete_file` ไม่ได้ดักข้อผิดพลาดนี้
- backend ต้องตั้งค่า `COGNITO_USER_POOL_ID` และ `COGNITO_APP_CLIENT_ID`
  ถ้าไม่ตั้ง endpoint ที่ต้อง sign in จะใช้ไม่ได้

> ตรวจกับ AWS จริงเมื่อ 19 ตุลาคม 2026: EC2 `CS361-ec2` (running), RDS `cs361-partner-db` (available),
> Cognito user pool มีครบ 5 group, Amplify `API_PROXY_TARGET` ชี้ไป EC2 port 8000,
> backend ที่ deploy ตอบ `/api/v1/auth/me` เป็น 401 (มีระบบ sign in ของ V3 แล้ว)

## เอกสารที่เกี่ยวข้อง

- [สิทธิ์ตามบทบาทของ V3](../decisions/v3-role-permissions.md)
- [สถาปัตยกรรมระบบ V2](v2-architecture.md)
- [บันทึกการตัดสินใจและคู่มือ deploy V2](../decisions/v2-deployment-amplify-ec2.md)
- [คู่มือ infrastructure](../../infra/README.md)
