# สถาปัตยกรรมระบบ V4

> อัปเดตล่าสุด: 2 พฤศจิกายน 2026 · ใช้กับ V4 – วงจรความร่วมมือและการปรับปรุง

V4 เพิ่มความคิดเห็นจากหลายแหล่ง ผลลัพธ์ การปรับปรุงจากความคิดเห็น (PDCA) การต่ออายุข้อตกลง
การนำเข้าและส่งออกข้อมูล และรายงานสรุป บนสิทธิ์ตามบทบาทเดิมของ V3
และย้ายการ deploy ไปบัญชี AWS ใหม่ที่ **Sydney** แบบประหยัด
ส่วนที่เปลี่ยนมากที่สุดคือ **ฐานข้อมูลย้ายจาก RDS มาเป็น PostgreSQL ใน Docker บน EC2 เครื่องเดียวกับ API**

![สถาปัตยกรรมการ deploy ระบบ V4](v4-deploy-architecture.png)

เปิดไฟล์ [v4-deploy-architecture.html](v4-deploy-architecture.html) ในเบราว์เซอร์เพื่อดู diagram พร้อมตารางอธิบายแต่ละขั้นตอน

ข้อกำหนดของ V4 ตาม[ขอบเขตหลักสูตร](../decisions/cstu-program-scope.md): ผลลัพธ์และ Feedback หลายแหล่ง
การรับข้อมูลจากระบบอื่น และข้อมูลสรุป พร้อมพิจารณาความพร้อมใช้งานเมื่อการใช้งานเพิ่มขึ้น

## ส่วนประกอบหลัก

| ส่วน | บริการ | หน้าที่ใน V4 |
|---|---|---|
| หน้าเว็บ | **AWS Amplify Hosting** (`main.d1vzv59tpxqtoa.amplifyapp.com`) | Next.js build จาก `main` อัตโนมัติ ส่งต่อ `/api/v1/*` ไปที่ `API_PROXY_TARGET` เบราว์เซอร์จึงเรียก API จาก origin เดียวกับหน้าเว็บ |
| บัญชีผู้ใช้ | **Amazon Cognito** user pool `cstu-v3-auth` | เหมือน V3: ตรวจรหัสผ่าน ออก token บทบาทมาจาก `cognito:groups` |
| API | **FastAPI ใน container `cs361-backend`** บน EC2 `cs361-backend` (t3.micro, Amazon Linux 2023) | ตรวจ token และสิทธิ์ทุก endpoint บันทึก `audit_logs` และมี router ใหม่ของ V4 (ดูหัวข้อถัดไป) |
| ฐานข้อมูล | **PostgreSQL 16 ใน container `cs361-db`** บน EC2 เครื่องเดียวกัน | database `cstu_demo` ข้อมูลอยู่ที่ `/opt/cs361/pgdata` บน EBS gp3 ที่เข้ารหัส พอร์ต 5432 ไม่เปิดออกนอก Docker network |
| ไฟล์ | **S3** `cs361-docs-<account-id>` | PDF ข้อตกลง, ไฟล์นำเข้าที่รอตรวจ, โค้ด backend ที่ deploy (`deploy/`) และไฟล์สำรอง (`backups/` ลบเองเมื่อครบ 30 วัน) |
| เครือข่าย | **VPC `cs361-vpc`** (`10.40.0.0/16`) public subnet เดียว | security group เปิดเฉพาะ `:8000` ไม่เปิด SSH มี Elastic IP ให้ที่อยู่ API ไม่เปลี่ยนเมื่อ stop/start |
| การดูแลเครื่อง | **AWS CloudShell + SSM Run Command** | `infra/new-account/deploy.sh` สร้าง stack, deploy backend, seed และสำรองข้อมูล โดยไม่ต้องใช้ SSH key |

ทุกบริการอยู่ใน region **ap-southeast-2 (Sydney)** โครงสร้างหลักสร้างด้วย CloudFormation (`infra/new-account/stack.yaml`)

## ส่วนที่เพิ่มใน V4

| เรื่อง | API (`/api/v1`) | ตาราง |
|---|---|---|
| ความคิดเห็นจาก 4 บริบท (หน่วยงาน ข้อตกลง กิจกรรม การแลกเปลี่ยน) ตอบกลับ ตรวจสอบ และเผยแพร่ | `/feedback` | `feedbacks`, `feedback_sources`, `respondent_types` |
| ผลลัพธ์พร้อมหน่วยนับ เช่น จำนวนผู้เข้าร่วม ผลงานวิชาการ ทุน | `/outcomes` | `outcomes`, `outcome_types` (ผู้ดูแลระบบจัดการประเภท) |
| การปรับปรุงจากความคิดเห็น ความคิดเห็นที่ผูกไว้เปลี่ยนเป็น "ตรวจสอบแล้ว" | `/improvements` | `improvements` |
| การตัดสินใจต่ออายุ และสายข้อตกลงฉบับเดิมไปฉบับใหม่ | `/renewals` | คอลัมน์ `renews_document_id`, `renewal_decision` ฯลฯ ใน `documents` |
| นำเข้าความคิดเห็นและผลลัพธ์จาก CSV/XLSX ส่งออก CSV ตามตัวกรอง | `/imports`, `/imports/export` | `import_batches` |
| แดชบอร์ดตามบทบาท รายงานรายปี และบทสรุปประจำปี | `/insights` | อ่านจากตารางเดิม ไม่มีตารางใหม่ |

## ข้อมูลวิ่งอย่างไร

1. **เข้าสู่ระบบและตรวจสิทธิ์** เหมือน V3: backend ส่งอีเมลและรหัสผ่านไปตรวจที่ Cognito
   คำขอถัดไปตรวจ token กับ JWKS แล้วตรวจบทบาทด้วย `require_role(...)` ไม่มี token ได้ 401 บทบาทไม่พอได้ 403
2. **นำเข้าไฟล์:** `POST /imports` เก็บไฟล์ไว้บน S3 แล้วสร้างแถวใน `import_batches`
   `BackgroundTasks` ของ FastAPI อ่านและตรวจทีละแถวหลังตอบคำขอแล้ว ผลการตรวจเก็บใน `preview_data`
   และลบไฟล์ออกจาก S3 เมื่อตรวจเสร็จ ผู้ใช้ดูผลก่อนยืนยัน และยกเลิกทั้งชุดได้
3. **ความคิดเห็นไปสู่การปรับปรุง:** เจ้าหน้าที่หรืออาจารย์ที่รับผิดชอบบันทึก `improvements` ที่ผูกกับความคิดเห็น
   ความคิดเห็นเหล่านั้นเปลี่ยนเป็น "ตรวจสอบแล้ว" ทุกการแก้ไขบันทึก `audit_logs` ใน transaction เดียวกัน
4. **รายงาน:** `/insights` รวมตัวเลขด้วย SQL (`GROUP BY`) ที่ฐานข้อมูล ไม่ดึงทุกแถวมานับใน Python
   และส่งออกเป็น CSV ได้
5. **การต่ออายุ:** ข้อตกลงใกล้หมดอายุมีการตัดสินใจ (ต่ออายุ ปรับแก้ หรือยุติ)
   ฉบับใหม่ชี้กลับไปฉบับเดิมด้วย `renews_document_id` และฉบับที่ต่ออายุแล้วจะไม่อยู่ในรายการใกล้หมดอายุ

## ทำไมเลือกแบบนี้ และทางเลือกที่พิจารณา

| เรื่อง | เลือก | ทางเลือกอื่น | เหตุผล |
|---|---|---|---|
| ฐานข้อมูล | **PostgreSQL container บน EC2 เดียวกับ API** | RDS แบบ V3 | ใช้เครดิตบัญชีใหม่ให้อยู่ได้ครบเทอม (รวมประมาณ $15 ต่อเดือน) ข้อเสียคือไม่มี Multi-AZ, snapshot อัตโนมัติ และการ patch ที่ AWS ดูแลให้ |
| สำรองข้อมูล | **`pg_dump` ขึ้น S3 ด้วย `deploy.sh backup`** | RDS automated backup | ไม่มีค่าใช้จ่ายเพิ่ม แต่ต้องสั่งเอง และยังไม่มีคำสั่ง restore ในสคริปต์ |
| เข้าเครื่อง | **SSM Session Manager / Run Command** | SSH ผ่าน key | ไม่ต้องเปิดพอร์ต 22 และไม่ต้องแจก key ทุกคำสั่งมีบันทึกใน SSM |
| ที่อยู่ API | **Elastic IP** | IP สาธารณะที่ได้ตอนเปิดเครื่อง | ค่าใช้จ่ายเท่ากัน และ `API_PROXY_TARGET` ของ Amplify ยังใช้ได้หลัง stop/start (ข้อจำกัดเดิมของ V2–V3) |
| ตรวจไฟล์นำเข้า | **`BackgroundTasks` ใน process เดียวกับ API** | SQS + worker แยก | ไฟล์เล็กและผู้ใช้น้อย ไม่ต้องดูแลบริการเพิ่ม ข้อเสียคือถ้า container restart ระหว่างตรวจ ชุดนั้นค้างสถานะ `processing` และต้องอัปโหลดใหม่ |
| ตัวเลขรายงาน | **รวมด้วย SQL ทุกครั้งที่เรียก** | ตารางสรุปที่คำนวณไว้ล่วงหน้า | ข้อมูลมีหลักร้อยถึงพันแถว ตัวเลขตรงกับข้อมูลล่าสุดเสมอ ไม่ต้องดูแลการอัปเดตตารางสรุป |

## การ deploy V4

รันจาก CloudShell (region Sydney) ที่โฟลเดอร์ของโปรเจกต์:

1. `deploy.sh check` ตรวจว่าบัญชีใช้บริการที่ต้องการได้
2. `deploy.sh infra --apply` สร้าง VPC, EC2, Elastic IP, S3 และ IAM ด้วย CloudFormation
3. `deploy.sh cognito --apply` สร้าง user pool กลุ่มบทบาท และบัญชีทดสอบ
4. `deploy.sh backend` อัปโหลด `backend/` ขึ้น S3 สั่งเครื่องผ่าน SSM ให้สร้างรหัสผ่านฐานข้อมูลบนเครื่อง
   เปิด `cs361-db` แล้ว build และเปิด `cs361-backend` ใหม่ จากนั้นตรวจ `/api/v1/health`
5. `deploy.sh seed --yes` ใส่ข้อมูลสมมติ (**ลบข้อมูลเดิมใน `cstu_demo` ทั้งหมด**)
6. `deploy.sh amplify` แสดงค่าที่ต้องกรอกใน Amplify Console แล้วเชื่อม GitHub repo branch `main` (app root `frontend`)
7. `CORS_ORIGINS=<Amplify URL> deploy.sh backend` อีกรอบเพื่อตั้ง CORS ให้ตรงกับหน้าเว็บ

ฐานข้อมูลใหม่ไม่ต้องรัน `migrate_v4*.py` เพราะ backend สร้างตารางตามโมเดลปัจจุบันตอนเริ่มทำงาน
สคริปต์ migration ใช้เฉพาะตอนอัปเกรดฐานข้อมูล V3 ที่มีข้อมูลอยู่แล้ว
(`migrate_v4.py` → `migrate_v4_4.py` → `migrate_v4_6.py` → `migrate_v4_7.py` รันซ้ำได้)

**อัปเดต backend ครั้งต่อไป:** รัน `deploy.sh backup` ก่อน แล้ว `deploy.sh backend`
API หยุดไม่กี่วินาทีระหว่างสลับ container ข้อมูลในฐานข้อมูลไม่ถูกแตะ

## ข้อจำกัดที่ควรรู้

- **API และฐานข้อมูลอยู่บนเครื่องเดียว** ถ้าเครื่องหรือ EBS เสีย ข้อมูลกู้ได้จากไฟล์สำรองล่าสุดเท่านั้น
  และ RAM 1 GB ใช้ร่วมกัน (`cs361-db` จำกัดไว้ 300 MB และมี swap 2 GB สำหรับตอน build)
- **การสำรองข้อมูลยังต้องสั่งเอง** และไฟล์ใน `backups/` ถูกลบเมื่อครบ 30 วัน
- **Amplify ส่งคำขอไป EC2 เป็น HTTP ธรรมดา** (`http://<Elastic IP>:8000`) รวมถึง Bearer token
  และพอร์ต 8000 เปิดให้ทุก IP เพราะ Amplify ไม่มี IP ต้นทางที่แน่นอน
- **เพิ่มบัญชีหรือเปลี่ยนบทบาทยังต้องทำใน Cognito** เหมือน V3 หน้าเว็บเปิดหรือปิดบัญชีได้อย่างเดียว
- ยังไม่มี load balancer, Auto Scaling หรือ Multi-AZ

## เอกสารที่เกี่ยวข้อง

- [สถาปัตยกรรม V3](v3-architecture.md) (บัญชีเดิม Singapore + RDS)
- [สิทธิ์ตามบทบาท](../decisions/v3-role-permissions.md)
- [ขอบเขตหลักสูตร CSTU และแผนพัฒนา](../decisions/cstu-program-scope.md)
- [คู่มือ infrastructure](../../infra/README.md)
