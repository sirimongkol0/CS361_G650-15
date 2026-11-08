# PCSMS – ระบบจัดการความร่วมมือและผู้มีส่วนได้ส่วนเสียของหลักสูตร CSTU

ระบบติดตามความร่วมมือของ **หลักสูตรวิทยาการคอมพิวเตอร์ ระดับปริญญาตรี มหาวิทยาลัยธรรมศาสตร์ ศูนย์รังสิต**
มีหน้าสาธารณะสำหรับข้อมูลที่เผยแพร่แล้ว และพื้นที่ทำงานภายในสำหรับอาจารย์ เจ้าหน้าที่ และผู้ดูแลระบบ
ตามสิทธิ์ของแต่ละบทบาท

เกณฑ์ว่าข้อมูลแบบไหนนับเป็นของหลักสูตร และแผนพัฒนา V1–V7
ดูที่ [ขอบเขตหลักสูตร CSTU](docs/decisions/cstu-program-scope.md)

## เวอร์ชันปัจจุบัน: V5 – Automation

V5 ไม่เปลี่ยนฟีเจอร์ผู้ใช้จาก V4 แต่เปลี่ยน infrastructure และ deployment ให้สร้างซ้ำได้:
CloudFormation แยกเป็น stack ย่อย, config อยู่ใน SSM Parameter Store, รหัสผ่านฐานข้อมูลอยู่ใน
Secrets Manager, backup ทำงานตาม schedule และ CI ตรวจ template ด้วย `cfn-lint`/`cfn-guard`
รายละเอียดอยู่ที่ [สถาปัตยกรรม V5](docs/architecture/v5-architecture.md) และ
[คู่มือ deploy V5](docs/runbooks/v5-deploy.md)

> Learner Lab ใช้ได้เฉพาะ `us-east-1`/`us-west-2` และสร้าง IAM role/OIDC ไม่ได้
> V5 จึงใช้ `LabRole`/`LabInstanceProfile` และมี frontend fallback บน EC2 เมื่อ Amplify ใช้ไม่ได้
> ดู [ขอบเขต Learner Lab](docs/decisions/v5-learner-lab-scope.md)

สร้างด้วย **Next.js + FastAPI + PostgreSQL** ล็อกอินผ่าน **Amazon Cognito** และเก็บไฟล์บน **S3** (หรือดิสก์ในเครื่องตอนพัฒนา)

| เรื่อง | ทำอะไรได้ |
|---|---|
| หน่วยงานคู่ความร่วมมือและผู้ประสานงาน | เพิ่ม แก้ไข และเผยแพร่ หน่วยงานจะแสดงในหน้าสาธารณะเมื่อผ่านเงื่อนไขความสมบูรณ์ครบ |
| ข้อตกลง (MoU/MoA) | ฉบับร่าง → อนุมัติ → มีผล → หมดอายุ/ยกเลิก แนบไฟล์ PDF บันทึกขอบเขตความร่วมมือ และตรวจความเกี่ยวข้องกับ CSTU |
| การต่ออายุ | บันทึกการตัดสินใจ (ต่ออายุ ปรับแก้ หรือยุติ) สำหรับข้อตกลงใกล้หมดอายุ และเชื่อมฉบับใหม่กับฉบับเดิม |
| กิจกรรม | บันทึกกิจกรรมพร้อมหน่วยงาน ข้อตกลงที่เกี่ยวข้อง วันที่ และแหล่งอ้างอิง |
| นักศึกษาแลกเปลี่ยน | บันทึกการแลกเปลี่ยนขาเข้าและขาออก และเชื่อมกับบัญชีนักศึกษา |
| ผลลัพธ์ | บันทึกผลลัพธ์ เช่น จำนวนผู้เข้าร่วม ผลงานวิชาการ ทุน พร้อมหน่วยนับ |
| ความคิดเห็นจากหลายแหล่ง | ส่งความคิดเห็นถึงหน่วยงาน ข้อตกลง กิจกรรม หรือการแลกเปลี่ยน ประเภทผู้ส่งตามบทบาท เจ้าหน้าที่ตอบกลับ ตรวจสอบ และเผยแพร่ |
| นำเข้าและส่งออกข้อมูล | นำเข้าความคิดเห็นและผลลัพธ์จาก CSV/XLSX (ตรวจก่อนยืนยัน และยกเลิกทั้งชุดได้) และส่งออก CSV ตามตัวกรอง |
| การปรับปรุง (PDCA) | บันทึกสิ่งที่ปรับปรุงจากความคิดเห็น ความคิดเห็นที่ผูกไว้จะเปลี่ยนเป็น "ตรวจสอบแล้ว" |
| สรุปข้อมูลและรายงาน | แดชบอร์ดตามบทบาท รายงานรายปี บทสรุปประจำปี และส่งออกสรุปเป็น CSV |
| ประวัติการแก้ไข | บันทึกทุกการเพิ่ม แก้ไข ลบ และเผยแพร่ พร้อมค่าก่อนและหลัง |

## สถาปัตยกรรม

```
เบราว์เซอร์ ── Next.js (frontend/) ── /api/v1 ── FastAPI (backend/) ── PostgreSQL
                                                    │
                                                    ├── Amazon Cognito (ตรวจ token และกลุ่มบทบาท)
                                                    └── S3 หรือดิสก์ในเครื่อง (ไฟล์ข้อตกลงและไฟล์นำเข้า)
```

- `frontend/` Next.js App Router หน้าเว็บทุกหน้าอ่านข้อมูลจาก API ไม่มีข้อมูลตัวอย่างสำรองในตัว
- `backend/` FastAPI + SQLAlchemy ตรวจสิทธิ์ที่ server ทุก endpoint (`auth.require_role`, `auth.optional_user`)
- `database/` สคริปต์ฐานข้อมูล ส่วน `backend/migrate_v*.py` ปรับ schema ของฐานข้อมูลเดิมทีละเวอร์ชัน
- `infra/new-account/` CloudFormation 4 ชุด (`stack.yaml`, `cognito.yaml`, `amplify.yaml`, `backup.yaml`)
  และ `deploy.sh` สำหรับ plan/apply, backend, frontend fallback, seed, backup, restore และ teardown
- `scripts/` smoke test และสคริปต์เตรียมข้อมูลทดสอบ

เว็บที่ deploy แล้ว: **https://main.d1vzv59tpxqtoa.amplifyapp.com** (ข้อมูลสมมติสำหรับสาธิต, AWS Sydney)
หน้าเว็บอยู่บน AWS Amplify (push เข้า `main` แล้วอัปเดตเอง) ส่วน API และ PostgreSQL อยู่ใน Docker บน EC2 เครื่องเดียวกัน
และไฟล์กับไฟล์สำรองอยู่บน S3
ดูรายละเอียดที่ [สถาปัตยกรรมระบบ V4](docs/architecture/v4-architecture.md)

## สิทธิ์ตามบทบาท

บทบาทมาจากกลุ่มใน Cognito ทุกครั้งที่เรียก API (ถ้าเปลี่ยนกลุ่ม สิทธิ์จะเปลี่ยนตามทันที)

| การกระทำ | public | student | coordinator | staff | admin |
|---|:-:|:-:|:-:|:-:|:-:|
| ดูหน่วยงาน ข้อตกลง กิจกรรม และความคิดเห็นที่เผยแพร่แล้ว | ✅ | ✅ | ✅ | ✅ | ✅ |
| ดูรายการฉบับร่าง | — | — | 🔸 | ✅ | ✅ |
| เพิ่มและแก้ไขหน่วยงาน ข้อตกลงฉบับร่าง กิจกรรม และการแลกเปลี่ยน | — | — | 🔸 | ✅ | ✅ |
| อนุมัติ เปลี่ยนสถานะ และเผยแพร่ | — | — | — | ✅ | ✅ |
| ลบหน่วยงาน กิจกรรม และข้อตกลง | — | — | — | ✅ | ✅ |
| ดูข้อมูลการแลกเปลี่ยนของตนเอง | — | 🔸 | 🔸 | ✅ | ✅ |
| ส่งความคิดเห็น | — | ✅ | ✅ | ✅ | ✅ |
| ตอบกลับและตรวจสอบความคิดเห็น บันทึกการปรับปรุง | — | — | 🔸 | ✅ | ✅ |
| นำเข้าและส่งออกข้อมูล ดูรายงานสรุป | — | — | — | ✅ | ✅ |
| ดูประวัติการแก้ไข | — | — | — | ✅ | ✅ |
| ดูรายชื่อผู้ใช้ และเปิดหรือปิดบัญชี | — | — | — | — | ✅ |

✅ ทำได้ · 🔸 เฉพาะรายการที่ตนเป็นเจ้าของหรือรับผิดชอบ · — ทำไม่ได้
รายละเอียดราย endpoint ดูที่ [สิทธิ์ตามบทบาท](docs/decisions/v3-role-permissions.md)

## ตั้งค่า `.env`

| ไฟล์ | ใช้กับ | วิธีสร้าง |
|---|---|---|
| `.env` | `docker-compose.yml` (ไม่บังคับ) | `cp .env.example .env` แล้วแก้เฉพาะค่าที่ต้องการ |
| `.env.cstu` | `docker-compose.cstu.yml` | `cp .env.cstu.example .env.cstu` แล้วตั้ง `CSTU_DATABASE_PASSWORD` |
| `.env.demo-s3` | `docker-compose.demo-s3.yml` | ดู [เดโมบน S3](docs/demo-s3.md) |

ค่าที่ต้องตั้งเพื่อให้ล็อกอินได้ (ไม่ใช่ความลับ สร้างได้ด้วย `infra/provision_cognito.py`):

```bash
COGNITO_REGION=ap-southeast-1
COGNITO_USER_POOL_ID=ap-southeast-1_xxxxxxxxx
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

ถ้าไม่ตั้งค่า Cognito หน้าสาธารณะยังใช้ได้ แต่การล็อกอินจะได้ 503
ค่าอื่นของ backend (เช่น `DATABASE_URL`, `STORAGE_BACKEND`, `S3_BUCKET`, `CORS_ORIGINS`) อยู่ใน `backend/config.py`

## รันระบบ

ทุกแบบใช้ฐานข้อมูลแยกกัน ข้อมูลไม่ปนกัน รายละเอียดเพิ่มเติมดูที่ [คู่มือ infrastructure](infra/README.md)

### Docker: สำหรับพัฒนา

```bash
docker compose up --build -d --wait
python scripts/smoke_test.py
```

เปิด http://localhost:3000/dashboard/public ฐานข้อมูลเริ่มต้นว่าง และไม่ต้องใช้ AWS ยกเว้นการล็อกอิน

### Docker: เดโมข้อมูลสมมติ

```bash
docker compose -f docker-compose.demo.yml up --build -d --wait
```

เปิด http://localhost:3100/dashboard/public ทุกหน้ามีป้ายบอกว่าเป็นข้อมูลสมมติ
ดู [คู่มือเดโมข้อมูลสมมติ](docs/demo-fictional.md) และถ้าต้องการอ่านไฟล์จาก S3 ให้เพิ่ม `-f docker-compose.demo-s3.yml`

### Docker: ฐานข้อมูล CSTU จริง

```bash
docker compose --env-file .env.cstu -f docker-compose.cstu.yml up --build -d --wait
python scripts/smoke_test.py --api http://localhost:3000/api/v1
```

ดูการตั้งรหัสผ่าน การเก็บข้อมูลถาวร และการสลับไปใช้ RDS ที่ [ฐานข้อมูล CSTU](docs/setup/cstu-database.md)

### Local: ไม่ใช้ Docker

Backend (Python 3.11):

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --reload --port 8000
```

ค่าเริ่มต้นใช้ SQLite ที่ `backend/app.db` ถ้าต้องการ PostgreSQL ให้ตั้ง `DATABASE_URL`

Frontend (Node 22):

```bash
cd frontend
npm ci
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npm run dev
```

## ทดสอบ

```bash
cd backend && TEST_DATABASE_URL=sqlite:// python -m pytest tests -q
cd frontend && npm run lint && npm run test:display && npm run build
```

- tests ใช้ข้อมูลสังเคราะห์ใน `backend/tests/sample_data.py`
- CI (`.github/workflows/ci.yml`) รัน backend บน PostgreSQL และ SQLite, build frontend, Compose smoke test
  และ job `e2e` ที่รันเทสต์เบราว์เซอร์กับ API และหน้าเว็บจริง
- วิธีรันเทสต์เบราว์เซอร์ในเครื่องดูที่ [คู่มือเดโมและการตรวจ](docs/demo-v2.md)

## เอกสาร

- [สถาปัตยกรรมระบบ V5](docs/architecture/v5-architecture.md) · [V4](docs/architecture/v4-architecture.md) · [V3](docs/architecture/v3-architecture.md) · [V2](docs/architecture/v2-architecture.md)
- [คู่มือ deploy V5](docs/runbooks/v5-deploy.md) · [Baseline before–after](docs/evidence/v5-baseline.md) · [ผลทดสอบ V5](docs/evidence/v5-validation.md)
- [ขอบเขต Learner Lab](docs/decisions/v5-learner-lab-scope.md) · [ADR เครื่องมือ IaC](docs/decisions/v5-iac-tooling.md) · [ADR ช่องทาง deploy backend](docs/decisions/v5-backend-deploy.md)
- [สิทธิ์ตามบทบาท](docs/decisions/v3-role-permissions.md)
- [ขอบเขตหลักสูตร CSTU และแผนพัฒนา](docs/decisions/cstu-program-scope.md)
- [คู่มือคำศัพท์และน้ำเสียงหน้าเว็บ](docs/ui-writing-guide-th.md)
- [การ deploy V5: CloudFormation + EC2 + SSM/Secrets + fallback frontend](docs/architecture/v5-architecture.md#ลำดับการ-deploy) · [การ deploy V4: Amplify + EC2 (API + PostgreSQL) + S3](docs/architecture/v4-architecture.md#การ-deploy-v4) · [การ deploy V2–V3: Amplify + EC2 + RDS + S3](docs/decisions/v2-deployment-amplify-ec2.md) · [คู่มือ infrastructure](infra/README.md)
- [คู่มือติดตั้ง](docs/setup/README-th.md) · [ฐานข้อมูล CSTU](docs/setup/cstu-database.md)
- [สัญญา field ของ API](docs/api/v2-field-contract.md)
- [เดโมข้อมูลสมมติ](docs/demo-fictional.md) · [เดโมบน S3](docs/demo-s3.md) · [ฐานเดโมบน RDS](docs/demo-rds.md)

**ประวัติ V1:** [สถาปัตยกรรม](docs/architecture/v1-architecture-th.md) ·
[สัญญา API](docs/api/v1-api-contract-th.md) ·
[การตัดสินใจด้านเทคโนโลยี](docs/decisions/v1-tech-stack-th.md) ·
[การ deploy](docs/decisions/v1-deployment-ec2.md)
