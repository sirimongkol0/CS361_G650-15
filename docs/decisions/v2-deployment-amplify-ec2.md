# การ deploy V2: Amplify + EC2 + RDS + S3

> สถานะ: ใช้งานอยู่ (V2) · deploy เมื่อ: 2 ตุลาคม 2026 · ผู้เขียน: CS361_G650-15
> แทนที่แนวทางใน [V1 Deployment](v1-deployment-ec2.md) สำหรับส่วน frontend

เอกสารนี้มี 2 ส่วน:

1. **ทำไม** ถึงเลือกสถาปัตยกรรมนี้ และทางเลือกอื่นที่พิจารณา
2. **วิธี deploy** และอัปเดตระบบ ให้ทีมทำซ้ำได้

ภาพรวมของระบบดูที่ [สถาปัตยกรรมระบบ V2](../architecture/v2-architecture.md)

---

## ส่วนที่ 1: การตัดสินใจ

### ที่มา

- V1 deploy ทุกอย่างไว้บน EC2 เครื่องเดียว และใช้ Cloudflare quick tunnel ทำ HTTPS
  ปัญหาคือ URL สุ่มใหม่ทุกครั้งที่ tunnel เริ่มใหม่ และ build Next.js บน t2.micro (RAM 1 GB) ทำให้เครื่องค้าง
- V2 ต้องการ URL ที่ถาวร มี HTTPS และ deploy หน้าเว็บใหม่ได้ง่ายเมื่อแก้โค้ด

### สิ่งที่เลือก

| ส่วน | เลือก | เหตุผลหลัก |
|---|---|---|
| หน้าเว็บ | **AWS Amplify Hosting** | ได้ HTTPS และ URL ถาวรฟรี, build อัตโนมัติจาก GitHub, ไม่ต้อง build บน EC2 ที่ RAM น้อย |
| API | **EC2 เครื่องเดิม + Docker** | มีเครื่องและ IAM role สำหรับ S3 อยู่แล้ว, ค่าใช้จ่ายต่ำ, ตั้งค่าเสร็จเร็ว |
| ฐานข้อมูล | **RDS PostgreSQL เครื่องเดิม** | สร้าง database ใหม่ `cstu_demo` บน instance เดิม ไม่ต้องจ่ายค่า instance เพิ่ม |
| ไฟล์ | **S3 bucket เดิม** | แยก prefix `cstu-demo/v2/` ออกจากไฟล์ข้อมูลจริง |

### ทำไมใช้ RDS (PostgreSQL) ไม่ใช้ DynamoDB

1. **ข้อมูลเชื่อมโยงกันเยอะ** หน่วยงาน ↔ ข้อตกลง ↔ กิจกรรม และตารางแหล่งอ้างอิงต่าง ๆ
   ต้องใช้ JOIN และ foreign key ซึ่ง PostgreSQL ทำได้และช่วยตรวจความถูกต้องให้
   ส่วน DynamoDB ไม่มีทั้งสองอย่าง ต้องเก็บข้อมูลซ้ำหลายที่และเขียนโค้ดดูแลเอง
2. **ค้นหาและกรองได้หลายแบบ** หน้า list ของ V2 กรองหลายเงื่อนไขพร้อมกัน ใน SQL เขียนได้ทันที
   ส่วน DynamoDB ต้องออกแบบ index ล่วงหน้าทุกรูปแบบ และค้นหาข้อความต้องพึ่งบริการเสริม
3. **โค้ดใช้ SQL อยู่แล้ว** backend ใช้ SQLAlchemy มี migration และ tests ทั้ง SQLite และ PostgreSQL
4. **ข้อมูลน้อย** (หลักร้อยแถว) จุดเด่นของ DynamoDB เรื่องรองรับ traffic มหาศาลยังไม่จำเป็น
5. **ตรงกับเนื้อหาวิชา** ออกแบบ schema, normalization และ ER diagram ได้ชัดเจน

ข้อเสียที่ยอมรับ: RDS คิดเงินตลอดเวลาที่เปิดอยู่แม้ไม่มีคนใช้ และต้องดูแล security group เอง

### ทางเลือกอื่นที่พิจารณา

| ทางเลือก | ข้อดี | ข้อเสีย | สรุป |
|---|---|---|---|
| EC2 เครื่องเดียวทั้งระบบ (แบบ V1) | ถูกสุด ง่ายสุด | ไม่มี HTTPS ถาวร, build บน t2.micro แล้วเครื่องค้าง | ไม่เลือก |
| **Amplify + EC2** | HTTPS ถาวร, deploy หน้าเว็บอัตโนมัติ, ถูก | backend เครื่องเดียว, IP ไม่ถาวร | **เลือก** |
| ECS Fargate + Load Balancer | ทนเครื่องล่ม ขยายได้ แนว production | ตั้งค่าซับซ้อน, Load Balancer อย่างเดียวประมาณ $16+/เดือน | เกินความจำเป็นตอนนี้ |
| AWS App Runner (backend) | ง่าย ได้ HTTPS และ URL ถาวร | แพงกว่า EC2 เล็กน้อย | ตัวเลือกถัดไปถ้าจะพัฒนาต่อ |
| Lambda + API Gateway | จ่ายตามการใช้งาน | cold start, ใช้กับ RDS ต้องมี RDS Proxy | ไม่คุ้มกับงานนี้ |
| Elastic Beanstalk | ได้ Load Balancer + Auto Scaling ให้ | บริการรุ่นเก่า debug ยาก | ไม่เลือก |

### ผลที่ตามมา

- ✅ หน้าเว็บมี HTTPS และ URL ถาวร: `https://main.d5kr2senr2j9o.amplifyapp.com`
- ✅ push เข้า `main` แล้วหน้าเว็บอัปเดตเอง
- ⚠️ backend ต้อง deploy เองผ่าน SSH (ดูส่วนที่ 2)
- ⚠️ IP ของ EC2 ไม่ถาวร ห้าม stop เครื่อง ถ้าจำเป็นต้องใช้ IP ถาวรให้จอง Elastic IP
- ⚠️ backend ต้องรับคำขอจาก Amplify ซึ่งไม่มี IP คงที่ จึงจำกัด IP ต้นทางไม่ได้

---

## ส่วนที่ 2: วิธี deploy

### ค่าที่ใช้ในระบบจริง

| รายการ | ค่า |
|---|---|
| URL หน้าเว็บ | `https://main.d5kr2senr2j9o.amplifyapp.com` |
| Amplify App ID | `d5kr2senr2j9o` (branch `main`) |
| EC2 | `CS361-ec2` · t2.micro · Ubuntu (IP ดูใน EC2 Console) |
| Security group | `CS361-app-sg` (เปิด 8000 สำหรับ API) |
| IAM role ของ EC2 | `CS361-EC2-AppRole` (อ่าน/เขียน S3 bucket) |
| RDS | `cs361-partner-db` · database `cstu_demo` |
| S3 | `cs361-partner-docs` · prefix `cstu-demo/v2/` |

> ห้ามใส่รหัสผ่านฐานข้อมูลหรือ AWS key ลงในเอกสารหรือ git
> ค่าเหล่านี้อยู่ในไฟล์ `.env` บนเครื่อง EC2 และในไฟล์ `.env.demo-rds` บนเครื่องผู้ดูแล (ถูก ignore)

### 1. หน้าเว็บบน Amplify

ตั้งครั้งแรกใน AWS Console:

1. **Amplify → Create new app → GitHub** แล้วเลือก repo `sirimongkol0/CS361_G650-15` branch `main`
2. ติ๊ก **My app is a monorepo** แล้วใส่ root เป็น `frontend`
3. ใส่ Environment variables:

   | Key | Value | ใช้ทำอะไร |
   |---|---|---|
   | `AMPLIFY_MONOREPO_APP_ROOT` | `frontend` | บอก Amplify ว่าแอปอยู่โฟลเดอร์ไหน |
   | `API_PROXY_TARGET` | `http://<EC2_PUBLIC_IP>:8000` | ปลายทางที่ Next.js ส่งต่อ `/api/v1` ไป |
   | `NEXT_PUBLIC_API_URL` | `/api/v1` | ที่อยู่ API ที่หน้าเว็บใช้ |

4. กด **Save and deploy**

หลังจากนี้ **push เข้า `main` แล้ว Amplify build ใหม่เอง** ไม่ต้องทำอะไรเพิ่ม
ถ้าแก้ env ต้องกด **Redeploy this version** ใน Amplify Console ค่าใหม่ถึงจะมีผล

### 2. backend บน EC2

backend อยู่ที่ `~/cs361` บนเครื่อง EC2 มีไฟล์:

- `backend/` โค้ดจาก git
- `compose.yml` สั่งรัน container
- `.env` ค่าการเชื่อมต่อ (สิทธิ์ไฟล์ `600`)

เนื้อหา `compose.yml`:

```yaml
name: cs361-backend
services:
  backend:
    build: ./backend
    env_file: .env
    environment:
      LOCAL_STORAGE_DIR: /app/storage
    dns: [8.8.8.8, 1.1.1.1]
    ports: ["8000:8000"]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "--fail", "--silent", "http://localhost:8000/api/v1/health"]
      interval: 10s
      retries: 5
```

ตัวแปรใน `.env` (ใส่ค่าจริงบนเครื่องเท่านั้น):

| ตัวแปร | ค่า |
|---|---|
| `DATABASE_URL` | URL ของ database `cstu_demo` (ใช้ค่าเดียวกับ `DEMO_RDS_DATABASE_URL` ใน `.env.demo-rds`) |
| `STORAGE_BACKEND` | `s3` |
| `S3_BUCKET` | `cs361-partner-docs` |
| `AWS_REGION` | `ap-southeast-1` |
| `CORS_ORIGINS` | `https://main.d5kr2senr2j9o.amplifyapp.com` |

ไม่ต้องใส่ AWS key เพราะ EC2 ใช้ IAM role `CS361-EC2-AppRole` อ่าน S3 ได้เอง

### อัปเดต backend หลังแก้โค้ด

รันจากโฟลเดอร์ repo บนเครื่องตัวเอง (หลัง merge เข้า `main` แล้ว):

```bash
git archive --format=tar.gz -o app.tgz main backend
scp -i infra/CS361-ec2-key.pem app.tgz ubuntu@<EC2_PUBLIC_IP>:~/cs361/
ssh -i infra/CS361-ec2-key.pem ubuntu@<EC2_PUBLIC_IP> "cd ~/cs361 && tar xzf app.tgz && sudo docker compose -f compose.yml up -d --build --wait"
```

ตรวจว่าใช้งานได้:

```bash
curl https://main.d5kr2senr2j9o.amplifyapp.com/api/v1/health
```

ต้องได้ `{"status":"healthy"}`

### ถ้า IP ของ EC2 เปลี่ยน

เกิดเมื่อ stop แล้ว start เครื่องใหม่ (reboot ไม่เปลี่ยน)

1. ดู IP ใหม่ใน EC2 Console หรือใช้คำสั่ง
   `aws ec2 describe-instances --filters "Name=tag:Name,Values=CS361-ec2" --query "Reservations[0].Instances[0].PublicIpAddress"`
2. แก้ `API_PROXY_TARGET` ใน Amplify เป็น IP ใหม่
3. กด Redeploy ใน Amplify

### seed ข้อมูลเดโมใหม่

ใช้เมื่อชื่อหรือข้อมูลในโค้ด `backend/seed_demo.py` เปลี่ยน และต้องการให้ `cstu_demo` ตรงกับโค้ด
**คำสั่งนี้ลบข้อมูลทั้งหมดใน `cstu_demo`** สำรองก่อนทุกครั้ง

1. สำรองข้อมูลทุกตารางเป็นไฟล์ JSON บน EC2
2. หยุด backend: `sudo docker compose -f compose.yml stop backend`
3. ลบตารางทั้งหมดใน `cstu_demo` (ตรวจชื่อ database ก่อนลบทุกครั้ง)
4. รัน seed ด้วย local storage:
   `sudo docker compose -f compose.yml run --rm --no-deps -e STORAGE_BACKEND=local backend python seed_demo.py`
5. เปิด backend: `sudo docker compose -f compose.yml up -d --wait`

ไฟล์ PDF ใน S3 เก็บแบบระบุด้วย hash ถ้า PDF ใน `backend/fixtures/demo-documents/` เปลี่ยน
ต้องรัน `scripts/upload_demo_s3.py` ก่อน seed (ดู [เอกสารเดโมบน S3](../demo-s3.md))

---

## สิ่งที่ควรปรับปรุงต่อ

- จอง **Elastic IP** ให้ EC2 เพื่อให้ IP ไม่เปลี่ยน
- ย้าย backend ไป **App Runner** หรือ **ECS** เพื่อให้ได้ HTTPS และ deploy อัตโนมัติ
- ทบทวน security group ของ RDS และ EC2 ให้เปิดเฉพาะเท่าที่จำเป็น
- ใช้ IAM user ที่มีสิทธิ์เท่าที่จำเป็นสำหรับงาน deploy
