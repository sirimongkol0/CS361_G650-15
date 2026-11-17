# Module 10 — Load test evidence

Date: 2026-11-18 (UTC)  
Region: us-west-2  
SLO line: **P95 ≤ 800 ms, errors ≤ 1%**

## Environment

| Item | Value |
|---|---|
| CS361 URL | https://32.189.5.234.sslip.io |
| CS361 EC2 | `i-0ed2694db39677400` · t3.small · Docker Compose |
| Fallback ALB | http://cs361-sc-Alb-bEcelkxpQ5z9-332186962.us-west-2.elb.amazonaws.com |
| Fallback ASG | `cs361-scaling-fallback-Asg-pRlsycWp6ILx` · min 1 / max 4 |
| Test accounts | 8 fictional Cognito accounts |
| Test data | `[LT]` partners/documents/activities + `[LT]` feedback |

## Q1 — Baseline (CS361, normal)

| Metric | Value |
|---|---|
| Test | 2 users, 2 minutes |
| P95 | 570 ms |
| Errors | 0% |
| EC2 CPU | ~1–2% |
| PostgreSQL CPU | ~0–2% |
| DB connections | 6 |
| RPS | 0.90 |

Dashboard: `CS361-LoadTest` (CPU, network, CPU credits, disk, status checks).

## Q2/Q3 — CS361 step test (overload + bottleneck)

Shape: 10 users → 20 → 40 (2 min each) → 80 users (6 min).

| Users | RPS | P95 | Fail % | EC2 CPU | Backend container CPU | DB connections |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 4.4 | 600 ms | 0% | ~8–17% | 3–19% | 6 |
| 20 | 8.5 | 600 ms | 0% | ~17–32% | 9–30% | 6 |
| 40 | 16.7 | 650 ms | 0% | ~32–33% | 27–80% | 6 |
| 80 | 29.3 | **1500 ms** | 0.02% (3×500) | ~65–67% | **60–97%** | 6–16 |

- Knee: **80 users** — P95 jumps to 1500 ms, above the 800 ms line.
- Bottleneck: **FastAPI backend container CPU**, not the database.
- Database evidence: PostgreSQL CPU stayed ~20–35%, connections peaked at 16.
- Error evidence: 3 HTTP 500s at 80 users (2 detail, 1 list).
- Interpretation: busy server → more API capacity would help; the local PostgreSQL is not the limiting resource at this point, but a second app server would need a shared database.

Evidence:
- `cs361-p95.png`
- `cs361-container-cpu.png`
- `cs361-cpu.png`
- `cs361/steps.html`, `cs361/steps_stats_history.csv`

## Q4 — Fallback before scaling

Shape: 10 → 20 → 40 (2 min each) → 80 users (6 min). No scaling policy.

| Users | RPS | P95 | Fail % | Servers |
|---:|---:|---:|---:|---:|
| 10 | 3.8 | 430 ms | 0% | 1 |
| 20 | 9.1 | 380 ms | 0% | 1 |
| 40 | 16.4 | 480 ms | 0% | 1 |
| 80 | 24.7 | **1700 ms** | 0% | 1 |

Policy added:

```text
Metric: ASGAverageCPUUtilization
Target: 48%
Min: 1
Max: 4
Warm-up: measured by ASG health check (60 s grace)
```

Command: `bash loadtest/fallback-policy.sh` (target 48%).

## Q5 — After scaling

| Users | P95 before | P95 after | Servers after |
|---:|---:|---:|---:|
| 10 | 430 ms | 340 ms | 1 |
| 20 | 380 ms | 350 ms | 2 |
| 40 | 480 ms | 330 ms | 2 |
| 80 | **1700 ms** | **430 ms** | 3 |

- Requests: 16,065; failures: 0.
- RPS at 80 users: 34.7 after vs 24.7 before.
- Scale-out activity:
  - 19:11:53Z — desired 1 → 2 (`i-0588d82b3d67bfae1`)
  - 19:22:53Z — desired 2 → 3 (`i-07373e21479d68778`)
- CPU per instance during 80 users: ~48–56%, matching the 48% target.
- Scale-in:
  - 19:39:58Z — low alarm triggered
  - 19:40:07Z — terminated `i-02289bee8d2063e30`
  - 19:41:03Z — terminated `i-0588d82b3d67bfae1`
  - 19:41:08Z — desired capacity back to **1** (`i-07373e21479d68778`)

Server-minutes:

```text
During the 12-minute run:
  max = 3 servers × 12 min = 36
  actual ≈ 23.8 (~66% of max)

Through scale-in (29.4 min total):
  max = 3 × 29.4 = 88.3
  actual ≈ 75.1
```

Evidence:
- `fallback-p95-before-after.png`
- `fallback-before-p95.png`, `fallback-after-p95.png`
- `fallback-before/steps.html`, `fallback-after/steps.html`

## Decision

- CS361 at 40 users: 650 ms P95, 0 errors — under the line.
- CS361 at 80 users: 1500 ms P95, backend CPU ~97% of one core — over the line.
- The bottleneck is the single FastAPI container on one EC2, not PostgreSQL.
- To scale CS361 horizontally: AMI + launch template + ALB + ASG, move PostgreSQL to RDS, keep S3/TLS, and use Cognito (already stateless).
- The fallback proves that adding CPU capacity fixes this busy-server case: P95 at 80 users fell from 1700 ms to 430 ms while capacity rose 1 → 3 instances.

## Cleanup

- [ ] Remove `[LT]` rows: `docker exec cs361-backend python loadtest_cleanup.py`
- [ ] Or restore `s3://cs361-docs-073362813452/backups/cstu_demo-20261117T182920Z.sql.gz`
- [ ] Delete extra Cognito test accounts if not needed
- [ ] Set fallback ASG min = max = 0 after the class
- [ ] Delete `cs361-scaling-fallback` stack if no longer needed
