# V1 Deployment Decision — EC2 + Docker Compose (with Cloudflare Tunnel)

> สถานะ: Accepted (V1) · วันที่: 31 Aug 2026 · ผู้เขียน: CS361_G650-15
> ยังไม่รวมการเปลี่ยนแปลง code — เอกสารบันทึกการตัดสินใจและบทเรียนจากการ deploy จริง

## Context (ที่มา)

- V1 ออกแบบ stack ไว้เดิมคือ Next.js + FastAPI + RDS PostgreSQL โดยมีเป้าหมาย deploy ลง **ECS Fargate** (ดู `v1-tech-stack.md`)
- ตอนเริ่มทำ deploy จริง พบว่า repo พร้อมระดับ "container-ready" (build ผ่านทั้ง 2 images, compose รันบนเครื่อง dev ได้) แต่ **ยังไม่มี infra ฝั่ง ECS เลย** — `infra/` มีแค่ README, ไม่มี taskdef/pipeline, AWS CLI ยังไม่มี credentials
- เวลา/บริบทจำกัด (งานส่ง V1) — ต้องเลือกทางที่ทำให้ "ระบบรันจริง + มี URL สาธิต" เสร็จได้ในวันเดียว

## Decision

เลือก deploy แบบ **EC2 เครื่องเดียว + Docker Compose** แทน ECS Fargate สำหรับ V1

### ทางเลือกที่พิจารณา

| ทางเลือก | ความยากตั้งค่า | เหมาะกับ |
|---|---|---|
| AWS App Runner | ⭐ ง่ายสุด | push image แล้วจบ แต่ควบคุม network น้อย |
| **EC2 + docker compose** ✅ | ⭐⭐ | **ใช้ compose เดิมทุกอย่าง ไม่แก้โค้ดเลย** |
| ECS Fargate (แผนเดิม) | ⭐⭐⭐⭐ | production-grade แต่ต้องประกอบ ECR+cluster+taskdef+ALB |
| เครื่องตัวเอง + tunnel | ⭐ | demo ชั่วคราว เครื่องต้องเปิดตลอด |

### เหตุผลหลัก

1. **Reuse 100%**: `docker-compose.yml` เดิมรันได้บน EC2 เหมือนบนเครื่อง dev ทุกประการ — ไม่แตะโค้ดสักบรรทัด (ยกเว้นแก้ redirect หน้าแรกเป็น `/dashboard/public` ตาม feedback การใช้งาน)
2. **Free tier**: t2.micro + 20 GB gp3 อยู่ใน free tier 12 เดือนแรก
3. **Teachable**: ครบทั้ง IAM, SG, RDS networking, systemd/swap — อธิบายเป็น evidence ด้าน Eng Practice ได้ดีกว่า console clicks
4. ECS ยังเป็นเป้าหมายที่ถูกต้องสำหรับ V2+ (เมื่อต้อง scale และ zero-downtime deploy)

## Architecture ที่ deploy จริง (31 Aug 2026)

```
GitHub (main) ──git clone──▶ EC2 t2.micro (Ubuntu 24.04, ap-southeast-1)
                              │  /opt/cs361 + .env (ไม่อยู่ใน git)
                              ├─▶ FastAPI :8000 ──▶ RDS PostgreSQL (partner_activity_v1)
                              │         └────────▶ S3 cs361-partner-docs (ผ่าน instance role)
                              └─▶ Next.js :3000 (standalone)
                                        ▲
  ผู้ใช้ ──HTTPS──▶ Cloudflare quick tunnel ──▶ cloudflared (บน EC2)
  ผู้ใช้ ──HTTP───▶ 13.212.47.76:3000 (public)
```

### IAM (least-privilege, สร้างโดย `infra/setup_ec2_policies.py`)

| ชื่อ | บทบาท | สิทธิ์ |
|---|---|---|
| `CS361-EC2-Deploy` | ผู้ launch/จัดการเครื่อง | EC2 RunInstances/Describe, SG management, IAM role/profile ops |
| `CS361-EC2-AppRole` | ตัวเครื่อง (instance profile) | S3 เฉพาะ `cs361-partner-docs/*` (List/Get/Put) — **ไม่มี secret key บนเครื่อง** |

### Security groups

- EC2: 22/8000 เปิดเฉพาะ IP ผู้ดูแล, 3000 เปิด public (demo), egress ปกติ
- RDS: 5432 เปิดให้ **IP ของ EC2 เท่านั้น** (เดิมเปิดเฉพาะ IP บ้าน) — จัดการด้วย `infra/open_rds_for_ec2.py`

### HTTPS ผ่าน Cloudflare quick tunnel

- ปัญหา: browser เตือน "Not secure" เพราะ HTTPS ต้องมี certificate ซึ่ง CA ไม่ออกให้ IP เปล่า
- ทางแก้: `cloudflared tunnel --url http://localhost:3000` — เครื่องเรา "ออกไปหา" Cloudflare (outbound) ไม่ต้องเปิด inbound เพิ่ม, Cloudflare ออก cert + ส่งต่อ traffic
- ข้อจำกัด: ชื่อ subdomain สุ่มทุกครั้งที่ process เริ่มใหม่ (reboot/kill = ลิงก์เดิมตาย) — โหมด quick tunnel ไม่การันตี SLA ถ้าต้องการชื่อ fix ต้องใช้ named tunnel (สมัครบัญชีฟรี)

## Incident & Lesson Learned (บทเรียนจากของจริง)

### เหตุการณ์: t2.micro hang ระหว่าง build Next.js

- **อาการ**: ระหว่าง `docker compose up --build` (frontend คือ `npm run build` — กิน RAM สูง) เครื่อง freeze ทั้งเครื่อง — SSH timeout, เว็บ/API ไม่ตอบ, tunnel ขึ้น 530
- **วินิจฉัย**: AWS API รายงาน instance "running / status ok" (hypervisor มองว่าปกติ) แต่ OS ข้างใน unresponsive — สมบัติคลาสสิกของ **memory pressure + OOM บน RAM 1 GB**
- **แก้**:
  1. `aws ec2 reboot-instances` (วิธีเดียวที่เข้าถึงเครื่องที่ OS hang ได้)
  2. เพิ่ม **swap 2 GB** (fallocate → mkswap → swapon → ลง fstaba permanent) — ให้ build มีที่พักของ memory เย็น
- **บทเรียน**:
  - "instance running + status ok" ≠ "OS ทำงานปกติ" — ต้องดูจากหลายชั้น (API → SSH → app health)
  - build workload ≠ runtime workload — เครื่องที่รันเว็บสบาย ๆ อาจ build ไม่ไหว ควรแยก build ออกจากเครื่องจริง (CI build image → pull มารัน) เมื่อขยับไป V2
  - swap เป็นยาแก้ปวดหัวระดับเครื่องเล็ก ไม่ใช่ทางออกระยะยาว (build ครั้งต่อไปอาจหนักกว่า)

### เหตุการณ์รอง: tunnel URL เปลี่ยนหลังเครื่อง hang

- ลิงก์ HTTPS ที่เคยแจ้ง (`jeffrey-packet-...`) ตายพร้อมเครื่อง — ได้ชื่อใหม่หลังรัน cloudflared ใหม่ (`earl-gis-larger-midwest.trycloudflare.com` ณ วันที่จด)
- บทเรียน: quick tunnel เหมาะกับ demo สด ไม่เหมาะพิมพ์ลงเอกสารระยะยาว — ถ้าจะให้ URL เสถียร ต้องใช้ named tunnel หรือมี domain จริง

## Scripts (อยู่ใน `infra/`, idempotent ทั้งหมด)

| ไฟล์ | หน้าที่ |
|---|---|
| `setup_ec2_policies.py` | สร้าง IAM policy/role/instance profile (รันครั้งเดียวตอนตั้งค่า) |
| `launch_ec2.py` | key pair + SG + RunInstances + user-data (ติดตั้ง Docker); `--status/--stop/--start` |
| `deploy_ec2.py` | SSH เข้าเครื่อง → git pull → upload `.env` → compose up → health check |
| `open_rds_for_ec2.py` | เปิด 5432 ให้ IP เครื่อง EC2 บน SG ของ RDS |

**Workflow การ deploy ใหม่**: แก้โค้ด → commit+push → `python infra/deploy_ec2.py` (หรือ SSH สั่ง `git pull && docker compose up -d --build` ตรง ๆ)

## Consequences

- ✅ ระบบรันจริงบน cloud, URL ให้คนอื่นเข้าได้, มี HTTPS, ต้นทุน $0 (free tier)
- ✅ เป็นพื้นฐานตรงไปตรงมา — อัปเกรดเป็น ECS/CI build ภายหลังได้โดยไม่แก้ app code
- ⚠️ ทรัพยากรเครื่องจำกัด (1 GB RAM) — build หนักต้องระวัง (มี swap แล้ว), ไม่เหมาะกับ concurrent users เยอะ
- ⚠️ URL HTTPS ไม่ fix (quick tunnel) — ถ้าต้องการความเสถียร ให้ย้ายไป named tunnel (สมัครบัญชีฟรี) หรือซื้อ domain
- ⚠️ ปล่อยรันต่อเนื่อง = ใช้ free tier; หลัง 12 เดือนแรกหรือหลังจบโปรเจค → `launch_ec2.py --stop`
