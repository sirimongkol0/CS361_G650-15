**Line:** P95 ≤ 800 ms, errors ≤ 1%
**Baseline:** P95 570 ms, CPU 1–2%, DB CPU 0–2%, DB connections 6
**Prediction:** slow at 80 users

| Users | P95 | Fail % | CPU % | DB CPU % |
|---:|---:|---:|---:|---:|
| 10 | 600 ms | 0% | 8–17% | 0–2% |
| 20 | 600 ms | 0% | 17–32% | 2–5% |
| 40 | 650 ms | 0% | 32–33% | 5–17% |
| 80 | 1500 ms | 0.02% | 65–67% | 20–35% |

**Bottleneck:** FastAPI backend container CPU  
**Evidence:** backend container 60–97% at 80 users; PostgreSQL CPU only 20–35%; DB connections 6–16; 3× HTTP 500 at 80 users.

**Policy:** metric ASGAverageCPUUtilization, target 48%, min 1, max 4, warm-up 90 s  
**After scaling:** P95 at 80 users **1700 ms → 430 ms**; capacity 1 → 3 instances; 0 failures in 16,065 requests.  
**Server-minutes:** ≈23.8 during the 12-min run (vs 36 at max); scale-in by 19:41Z back to 1 instance; ≈75.1 server-minutes through scale-in (vs 88.3 at max).
