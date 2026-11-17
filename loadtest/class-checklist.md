# Module 10 — class checklist

Use this with `loadtest/README.md`. The class answers five questions with your
own numbers:

| Question | What to produce |
|---|---|
| Q1 Normal | Baseline card + dashboard |
| Q2 Overload | Step-test table + prediction |
| Q3 Bottleneck | Evidence: CPU vs waiting |
| Q4 Decide | Scaling metric, target, min/max, warm-up |
| Q5 Verify | P95 before/after + scale-in + server-minutes |

The course shape is **10 → 20 → 40 users for 2 minutes each, then 80 users for
6 minutes** (12 minutes total). Do not exceed 80 users.

## Before class

- [ ] Start Learner Lab and refresh AWS credentials
- [ ] EC2 `cs361-backend` running; URL/health 200
- [ ] `loadtest/accounts.tsv` with 5–10 test accounts
- [ ] Locust installed: `locust --version`
- [ ] `./deploy.sh backup` taken
- [ ] Test data ready (existing demo or `[LT]` seed)
- [ ] 1-user smoke test passed (list + detail + write)
- [ ] CloudWatch dashboard created; detailed monitoring ON if possible

## Q1 — Baseline (normal)

Create a CloudWatch dashboard with these five graphs (EC2/containers column):

1. Request count (ALB or Locust RPS)
2. P95 response time
3. 5xx errors
4. CPU
5. Running capacity (ASG instances / tasks)

Write the baseline card in the issue:

```text
P95: ____ ms
Errors: ____ %
App CPU: ____ %
DB CPU: ____ %
DB connections: ____
SLO line: P95 <= ____ ms, errors <= ____ %
```

Run the app normally for 3 minutes, or Locust with 2 users. Read graphs near
the end, not at the first spike.

Recommended starting SLO: **P95 ≤ 800 ms, errors ≤ 1%** — adjust to what V4
testers said.

## Q2/Q3 — Step test (overload + bottleneck)

Before running, write your prediction in the issue: **where will it slow down?**

Run:

```bash
export LOADTEST_HOST=http://<your-alb-or-api-url>
export LOADTEST_ACCOUNTS_FILE=loadtest/accounts.tsv
export LOADTEST_STEPS=1

locust -f loadtest/locustfile.py --headless
```

Or use the web UI and press Start; the shape runs by itself.

Fill the table near the end of each step:

| Users | RPS | P95 | Fail % | CPU % | DB CPU % | DB conns |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | | | | | | |
| 20 | | | | | | |
| 40 | | | | | | |
| 80 | | | | | | |

Stop as soon as you cross the SLO line. That step is the knee.

Bottleneck evidence:

| What you see | Meaning |
|---|---|
| CPU 80–100% | Busy server — more EC2 can help |
| CPU low, P95 high | Waiting on DB/external — scale won't fix it |
| CPU low, one request at a time | Single-threaded app — fix worker model first |
| No knee up to 80 | One server is enough for this load |

## Q4 — Decide scaling settings

The CS361 V5 system is Docker Compose on **one EC2**; it has no load balancer
or ASG. For Q4–Q5, use the course fallback stack, then write what your own
system would need.

Fallback stack from `CS361_M10_Fallback.zip`:

```bash
aws cloudformation deploy \
  --stack-name cs361-scaling-fallback \
  --template-file cs361-scaling-fallback.yaml \
  --parameter-overrides InstanceType=t3.micro MinSize=1 MaxSize=4
```

Get outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name cs361-scaling-fallback \
  --query 'Stacks[0].Outputs' --output table
```

`AppUrl` is the ALB URL — point Locust there, never at an instance IP.

Add a target-tracking policy (example: 48% CPU, from 68% at the knee × 0.7):

```bash
bash loadtest/fallback-policy.sh
# or: TARGET=48 STACK=cs361-scaling-fallback bash loadtest/fallback-policy.sh
```

The script reads `AutoScalingGroupName` from the stack and applies:

```text
metric  ASGCAverageCPUUtilization
target  48%
min     1–2
max     3–4
warm-up 60 s (measure it)
```

Policy card:

```text
Metric: Average CPU
Target: 48%
Min: 1 or 2
Max: 3–4 (Learner Lab max 9 EC2 total)
Warm-up: 60 s (measure it)
Why this metric: CPU was high at the knee in Q3
```

What CS361 would need to scale horizontally:

- AMI / launch template for the app server
- ALB + target group + ASG across two AZs
- PostgreSQL moved to RDS (shared, not local container)
- S3 already handles shared files
- Cognito already keeps auth stateless
- Container image or user-data bootstrap for backend/frontend/Caddy

If the DB is the bottleneck, more web servers will not help. Say that with the
DB CPU/connection graph as evidence.

## Q5 — Verify (better, and not wasteful)

Rerun the same step test against the fallback ALB after scaling is active.

| Users | P95 before | P95 after | Servers |
|---:|---:|---:|---:|
| 10 | | | |
| 20 | | | |
| 40 | | | |
| 80 | | | |

Then stop the load and wait 10–15 minutes. Capacity must return to minimum.
Capture the Activity tab / instance count as the scale-in screenshot.

Cost check:

```text
Max servers all the time: ___ x ___ min = ___ server-minutes
Our server-minutes with scaling: ___
```

## Submit — one comment in the team issue

Attach `locustfile.py` in the repo, the Locust chart before/after, and the
dashboard screenshot including scale-in.

```markdown
**Line:** P95 <= ___ ms, errors <= ___ %
**Baseline:** P95 ___ ms, CPU ___ %, DB CPU ___ %
**Prediction:** slow at ___

| Users | P95 | Fail % | CPU % | DB CPU % |
|---:|---:|---:|---:|---:|
| 10 | | | | |
| 20 | | | | |
| 40 | | | | |
| 80 | | | | |

**Bottleneck:** ___ **Evidence:** ___
**Policy:** metric ___, target ___, min ___, max ___, warm-up ___ s
**After scaling:** P95 ___ -> ___ ms
**Server-minutes:** ___ (vs ___ at max)
```

## Cleanup

- [ ] `docker exec cs361-backend python loadtest_cleanup.py` or restore backup
- [ ] Delete test Cognito accounts if they should not remain
- [ ] Set fallback ASG **min = max = 0** if you will not use it again
- [ ] Delete the fallback stack if it is no longer needed
- [ ] Confirm no test rows remain
