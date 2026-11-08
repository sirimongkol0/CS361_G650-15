# คู่มือ Infrastructure

คู่มือนี้บอกวิธีรันระบบบนเครื่องตัวเอง วิธีตรวจว่าระบบทำงาน และวิธีแก้ปัญหาที่เจอบ่อย
ส่วนการ deploy ขึ้น AWS ดูที่ [คู่มือ deploy V5](../docs/runbooks/v5-deploy.md)

## Deploy V5 ขึ้น AWS (CloudFormation)

V5 ใช้ `infra/new-account/deploy.sh` เป็นหลัก และแยก stack เป็น 4 ชุด:

| ไฟล์ | Stack | หน้าที่ |
|---|---|---|
| `stack.yaml` | `cs361` | VPC, EC2, EIP, S3, SSM parameter, Secrets Manager, IAM (conditional) |
| `cognito.yaml` | `cs361-cognito` | User pool, app client, กลุ่มบทบาท |
| `amplify.yaml` | `cs361-amplify` | Amplify app/branch (เฉพาะเมื่อมี GitHub token) |
| `backup.yaml` | `cs361-backup` | SNS, SSM document, EventBridge Scheduler, CloudWatch alarm |

Learner Lab:

```bash
export AWS_REGION=us-west-2
export LAB_MODE=true

infra/new-account/deploy.sh check
infra/new-account/deploy.sh infra --apply
infra/new-account/deploy.sh cognito --apply
infra/new-account/deploy.sh frontend --apply   # หรือ amplify --apply เมื่อมี token
infra/new-account/deploy.sh backend
infra/new-account/deploy.sh seed --yes
infra/new-account/deploy.sh schedule --apply
infra/new-account/deploy.sh status
```

บัญชีปกติใช้ `LAB_MODE=false` และ region `ap-southeast-2` (หรือ region ที่ต้องการ)
รายละเอียดการตั้งค่า secret, backup/restore, การหมุนรหัสผ่าน, self-hosted runner
และข้อจำกัดของ Lab อยู่ใน [คู่มือ deploy V5](../docs/runbooks/v5-deploy.md)

> ใน Learner Lab ห้ามสร้าง IAM role/OIDC และใช้ได้เฉพาะ `us-east-1`/`us-west-2`
> ถ้า Amplify build ไม่ผ่าน ให้ใช้ fallback frontend บน EC2 พอร์ต 3000

## ต้องมีอะไรก่อน

- Docker และ Docker Compose
- Node.js 20 ขึ้นไป และ Python 3.11 ขึ้นไป (ใช้เฉพาะตอนรันแบบไม่ใช้ Docker)

## เลือก Compose ให้ถูกไฟล์

repo มี Compose หลายไฟล์ แต่ละไฟล์ใช้ฐานข้อมูลแยกกัน ข้อมูลไม่ปนกัน

| ไฟล์ | ใช้ทำอะไร | ฐานข้อมูล | เปิดเว็บที่ |
|---|---|---|---|
| `docker-compose.yml` | พัฒนาบนเครื่อง | PostgreSQL ใน Docker (`pcsms`) เริ่มต้นว่าง | http://localhost:3000 |
| `docker-compose.demo.yml` | สาธิตด้วยข้อมูลสมมติ (แนะนำตอนนำเสนอ) | PostgreSQL ใน Docker (`cstu_demo`) | http://localhost:3100 |
| `docker-compose.demo.yml` + `docker-compose.demo-s3.yml` | เดโมที่อ่าน PDF จาก S3 | เหมือนด้านบน | http://localhost:3100 |
| `docker-compose.demo-rds.yml` (ใช้ร่วมกับไฟล์เดโม) | เดโมที่ต่อ RDS จริง | RDS `cstu_demo` | http://localhost:3100 |
| `docker-compose.cstu.yml` | ข้อมูล CSTU จริงที่รวบรวมไว้ | PostgreSQL ใน Docker (`cstu_collaboration`) | http://localhost:3000 |

คู่มือของแต่ละแบบ:
[เดโมข้อมูลสมมติ](../docs/demo-fictional.md) ·
[เดโมบน S3](../docs/demo-s3.md) ·
[เดโมบน RDS](../docs/demo-rds.md) ·
[ฐานข้อมูล CSTU](../docs/setup/cstu-database.md)

## รันระบบสำหรับพัฒนา

```bash
docker compose up --build -d --wait
```

คำสั่งนี้เปิด 3 container:

| Container | ทำอะไร | Port บนเครื่อง |
|---|---|---|
| `database` | PostgreSQL 16 | `127.0.0.1:5432` (เปิดเฉพาะในเครื่อง) |
| `backend` | FastAPI | `8000` |
| `frontend` | Next.js | `3000` |

- ไม่ต้องมีไฟล์ `.env` และไม่ต้องใช้ AWS
- ฐานข้อมูลเริ่มต้น **ว่าง** หน้าเว็บจะไม่มีข้อมูลจนกว่าจะเพิ่มข้อมูลเอง หรือใช้ Compose ของเดโม
- เปลี่ยน port ได้ด้วยตัวแปร `FRONTEND_PORT`, `BACKEND_PORT` และ `POSTGRES_PORT`

ดูสถานะและ log:

```bash
docker compose ps
docker compose logs -f backend
```

ปิดระบบ:

```bash
docker compose down
```

ถ้าใช้ `docker compose down -v` ข้อมูลในฐานข้อมูลและไฟล์ที่อัปโหลดจะ **ถูกลบทั้งหมด**

## รันแบบไม่ใช้ Docker

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

ถ้าไม่ตั้ง `DATABASE_URL` backend จะใช้ SQLite ในไฟล์บนเครื่อง
ถ้าจะต่อ PostgreSQL ให้ตั้งค่าก่อนรัน เช่น
`set DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/pcsms`

บน macOS หรือ Linux ใช้ `source venv/bin/activate` และ `export` แทน

### Frontend

```bash
cd frontend
npm install
npm run dev
```

ค่าเริ่มต้นจะเรียก API ที่ `http://localhost:8000/api/v1`
ถ้า backend อยู่ที่อื่นให้ตั้ง `NEXT_PUBLIC_API_URL` ก่อนรัน

## ตรวจว่าระบบทำงาน

| ตรวจอะไร | คำสั่ง | ผลที่ควรได้ |
|---|---|---|
| backend พร้อมใช้ | `curl http://localhost:8000/api/v1/health` | `{"status":"healthy"}` |
| รายการหน่วยงาน | `curl http://localhost:8000/api/v1/partners/` | รายการหน่วยงาน (ว่างได้ถ้าฐานข้อมูลยังไม่มีข้อมูล) |
| ข้อมูลที่ไม่มีอยู่ | `curl http://localhost:8000/api/v1/partners/999` | 404 |
| ตรวจทั้งระบบ | `python scripts/smoke_test.py` | ทุกข้อผ่าน |
| เอกสาร API | เปิด http://localhost:8000/docs | หน้า Swagger |

หน้าเว็บหลัก: http://localhost:3000/dashboard/public

## แก้ปัญหาที่เจอบ่อย

### backend เชื่อมฐานข้อมูลไม่ได้

1. ดูว่า container `database` ขึ้นสถานะ healthy แล้วหรือยัง: `docker compose ps`
2. ดู log ของ backend: `docker compose logs backend`
3. ถ้าต่อ RDS ต้องให้ security group ของ RDS อนุญาตเครื่องที่รัน backend ที่ port 5432

### Port ถูกใช้อยู่แล้ว

ตั้ง port ใหม่ตอนรัน เช่น

```bash
set FRONTEND_PORT=3001
docker compose up -d
```

### เบราว์เซอร์ขึ้น `DNS_PROBE_POSSIBLE` หรือหา `backend` ไม่เจอ

แปลว่าเบราว์เซอร์ได้ที่อยู่ภายใน Docker (เช่น `http://backend:8000`) ไปเปิดตรง ๆ ซึ่งเบราว์เซอร์มองไม่เห็น
ที่อยู่ที่เบราว์เซอร์ใช้ต้องเป็นที่อยู่ที่เปิดจากเครื่องได้ เช่น `http://localhost:8000/api/v1`
ตรวจค่า `PUBLIC_API_URL` ใน Compose หรือ `NEXT_PUBLIC_API_BROWSER_URL` ของ frontend

### build frontend ไม่ผ่าน

```bash
cd frontend
npm install
npm run build
```

ถ้า build ใน Docker บนเครื่องที่ RAM น้อย (เช่น EC2 t2.micro) เครื่องอาจค้าง
ควร build บนเครื่องอื่นหรือใช้ Amplify แทน (ดู[การ deploy V2](../docs/decisions/v2-deployment-amplify-ec2.md))
