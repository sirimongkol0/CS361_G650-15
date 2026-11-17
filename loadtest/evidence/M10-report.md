# Module 10 — หลักฐาน Load Test

วันที่: 18 พฤศจิกายน 2026 (UTC)  
Region: us-west-2  
เกณฑ์ SLO: **P95 ≤ 800 ms, errors ≤ 1%**

## สภาพแวดล้อมที่ใช้ทดสอบ

| รายการ | ค่า |
|---|---|
| URL ของ CS361 | https://32.189.5.234.sslip.io |
| EC2 ของ CS361 | `i-0ed2694db39677400` · t3.small · Docker Compose |
| Fallback ALB | http://cs361-sc-Alb-bEcelkxpQ5z9-332186962.us-west-2.elb.amazonaws.com |
| Fallback ASG | `cs361-scaling-fallback-Asg-pRlsycWp6ILx` · min 1 / max 4 |
| บัญชีทดสอบ | 8 บัญชี Cognito (ข้อมูลสมมติ) |
| ข้อมูลทดสอบ | partners/documents/activities และ feedback ที่ขึ้นต้นด้วย `[LT]` |

## Q1 — Baseline (CS361 ในภาวะปกติ)

| ตัวชี้วัด | ค่า |
|---|---|
| การทดสอบ | 2 users นาน 2 นาที |
| P95 | 570 ms |
| Errors | 0% |
| EC2 CPU | ~1–2% |
| PostgreSQL CPU | ~0–2% |
| DB connections | 6 |
| RPS | 0.90 |

Dashboard ที่ใช้: `CS361-LoadTest` (CPU, network, CPU credits, disk, status checks)

## Q2/Q3 — Step test ของ CS361 (overload + bottleneck)

รูปแบบ: 10 users → 20 → 40 (ขั้นละ 2 นาที) → 80 users (6 นาที)

| Users | RPS | P95 | Fail % | EC2 CPU | Backend CPU | DB connections |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 4.4 | 600 ms | 0% | ~8–17% | 3–19% | 6 |
| 20 | 8.5 | 600 ms | 0% | ~17–32% | 9–30% | 6 |
| 40 | 16.7 | 650 ms | 0% | ~32–33% | 27–80% | 6 |
| 80 | 29.3 | **1500 ms** | 0.02% (3×500) | ~65–67% | **60–97%** | 6–16 |

- จุด knee: **80 users** — P95 กระโดดเป็น 1500 ms เกินเส้น 800 ms
- Bottleneck: **CPU ของ container FastAPI backend** ไม่ใช่ฐานข้อมูล
- หลักฐานฝั่ง DB: PostgreSQL CPU อยู่ที่ ~20–35% และ connections สูงสุด 16
- Errors: HTTP 500 จำนวน 3 ครั้งที่ 80 users (detail 2 ครั้ง, list 1 ครั้ง)
- สรุป: เป็น **busy server** → การเพิ่ม API capacity จะช่วยได้ แต่ถ้าจะมีหลาย instance ต้องย้าย DB ไป RDS ก่อน

หลักฐาน:
- `cs361-p95.png`
- `cs361-container-cpu.png`
- `cs361-cpu.png`
- `cs361/steps.html`, `cs361/steps_stats_history.csv`

## Q4 — Fallback ก่อนเปิด scaling

รูปแบบ: 10 → 20 → 40 (ขั้นละ 2 นาที) → 80 users (6 นาที) โดยยังไม่มี policy

| Users | RPS | P95 | Fail % | จำนวน instance |
|---:|---:|---:|---:|---:|
| 10 | 3.8 | 430 ms | 0% | 1 |
| 20 | 9.1 | 380 ms | 0% | 1 |
| 40 | 16.4 | 480 ms | 0% | 1 |
| 80 | 24.7 | **1700 ms** | 0% | 1 |

Policy ที่ใช้:

```text
Metric: ASGAverageCPUUtilization
Target: 48%
Min: 1
Max: 4
Warm-up: 90 s (ASG health-check grace)
```

ทำไมต้อง 48%: CPU ที่ last passing step อยู่ที่ประมาณ 68% และตามแนวทางในสไลด์
`target ≈ 70% × CPU ที่ last passing step` → `0.7 × 68% ≈ 48%`
ค่านี้เหลือ headroom สำหรับ traffic spike และเวลา boot/healthy ของ instance ใหม่
หลัง scaling พบว่า instance ทำงานที่ ~48–56% CPU ตามที่ตั้งใจ

คำสั่ง: `bash loadtest/fallback-policy.sh` (target 48%)

## Q5 — หลังเปิด scaling

| Users | P95 ก่อน | P95 หลัง | จำนวน instance หลัง |
|---:|---:|---:|---:|
| 10 | 430 ms | 340 ms | 1 |
| 20 | 380 ms | 350 ms | 2 |
| 40 | 480 ms | 330 ms | 2 |
| 80 | **1700 ms** | **430 ms** | 3 |

- Requests: 16,065 ครั้ง, failures: 0
- RPS ที่ 80 users: 34.7 หลัง scaling เทียบกับ 24.7 ก่อน scaling
- Scale-out:
  - 19:11:53Z — desired 1 → 2 (`i-0588d82b3d67bfae1`)
  - 19:22:53Z — desired 2 → 3 (`i-07373e21479d68778`)
- CPU ต่อ instance ช่วง 80 users: ~48–56% ใกล้ target 48%
- Scale-in:
  - 19:39:58Z — low alarm เข้า ALARM
  - 19:40:07Z — terminate `i-02289bee8d2063e30`
  - 19:41:03Z — terminate `i-0588d82b3d67bfae1`
  - 19:41:08Z — desired กลับมา **1** (`i-07373e21479d68778`)

Server-minutes:

```text
ในช่วง 12 นาทีที่ยิงโหลด:
  max = 3 servers × 12 นาที = 36
  actual ≈ 23.8 (~66% ของ max)

รวมช่วง scale-in (29.4 นาที):
  max = 3 × 29.4 = 88.3
  actual ≈ 75.1
```

หลักฐาน:
- `fallback-p95-before-after.png`
- `fallback-before-p95.png`, `fallback-after-p95.png`
- `fallback-dashboard-scalein.png`
- `fallback-asg-capacity.png`
- `fallback-before/steps.html`, `fallback-after/steps.html`

## ข้อสรุป / Decision

- CS361 ที่ 40 users: P95 650 ms, 0 errors — ยังอยู่ใต้เส้น SLO
- CS361 ที่ 80 users: P95 1500 ms, backend CPU ~97% ของ 1 core — เกินเส้น SLO
- Bottleneck คือ FastAPI container บน EC2 เครื่องเดียว ไม่ใช่ PostgreSQL
- ถ้าจะให้ CS361 scale แนวนอนจริง ต้อง:
  - สร้าง AMI + Launch Template
  - เพิ่ม ALB + ASG
  - ย้าย PostgreSQL ไป RDS
  - ใช้ S3 สำหรับไฟล์ (มีอยู่แล้ว)
  - ใช้ Cognito สำหรับ auth (stateless อยู่แล้ว)
- Fallback พิสูจน์ว่าในกรณี busy server การเพิ่ม CPU capacity ช่วยได้จริง:
  P95 ที่ 80 users ลดจาก 1700 ms เหลือ 430 ms ขณะที่ capacity เพิ่มจาก 1 → 3 instances

## Cleanup

- [x] ลบข้อมูล `[LT]` ออกจาก CS361 แล้ว
- [x] ตั้ง fallback ASG min = max = 0
- [ ] ลบ fallback stack ถ้าไม่ใช้ต่อ
- [ ] ลบบัญชีทดสอบที่ไม่จำเป็น
- [ ] Stop CS361 หลังเลิกใช้
