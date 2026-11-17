**เกณฑ์ (Line):** P95 ≤ 800 ms, errors ≤ 1%  
**Baseline:** P95 570 ms, CPU 1–2%, DB CPU 0–2%, DB connections 6  
**ทำนาย (Prediction):** จะเริ่มช้าที่ 80 users

| Users | P95 | Fail % | CPU % | DB CPU % |
|---:|---:|---:|---:|---:|
| 10 | 600 ms | 0% | 8–17% | 0–2% |
| 20 | 600 ms | 0% | 17–32% | 2–5% |
| 40 | 650 ms | 0% | 32–33% | 5–17% |
| 80 | 1500 ms | 0.02% | 65–67% | 20–35% |

**Bottleneck:** CPU ของ FastAPI backend container  
**หลักฐาน:** backend container ใช้ CPU 60–97% ที่ 80 users; PostgreSQL CPU เพียง 20–35%; DB connections 6–16; มี HTTP 500 จำนวน 3 ครั้งที่ 80 users

**Policy:** metric ASGAverageCPUUtilization, target 48% (~70% ของ 68% CPU ที่ last passing step), min 1, max 4, warm-up 90 s  
**หลัง scaling:** P95 ที่ 80 users **1700 ms → 430 ms**; capacity 1 → 3 instances; 0 failures จาก 16,065 requests  
**Server-minutes:** ~23.8 ในช่วง 12 นาที (เทียบ 36 ที่ max); หลัง scale-in กลับมา 1 instance เวลา 19:41Z; รวมช่วง scale-in ~75.1 (เทียบ 88.3 ที่ max)
