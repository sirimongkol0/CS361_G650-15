# Load test — CSTU collaboration system

Prepared for the class load-test session. Fictional data only; never point these
scripts at a real database.

## Target system

```
Internet -> Caddy :443 -> Next.js :3000 -> FastAPI :8000 -> PostgreSQL :5432
                                      \-> Cognito (login/token)
EC2 t3.small (single instance) -> S3 (files/backups), CloudWatch
```

The single EC2 instance is the first expected bottleneck: frontend, API,
PostgreSQL and Caddy share one t3.small.

## User actions and endpoints

| Weight | Action | Endpoint |
|---:|---|---|
| 40% | List published activities | `GET /api/v1/activities/` |
| 40% | Open an activity detail | `GET /api/v1/activities/{id}` |
| 20% | Submit feedback | `POST /api/v1/feedback/` |

The write request needs a bearer token from `POST /api/v1/auth/login`.

## 1. Install Locust

```bash
cd /path/to/CS361_G650-15
python3 -m venv .venv-loadtest
source .venv-loadtest/bin/activate
pip install locust
locust --version
```

If `python3 -m venv` fails because `ensurepip` is missing:

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip
```

## 2. Test accounts

Create the fictional Cognito accounts once:

```bash
python3 infra/provision_cognito.py --apply
```

Passwords are written outside the repository:

```text
~/.config/cstu/cognito-test-users-<pool-id>.txt
```

Copy the account list and edit it:

```bash
cp loadtest/accounts.example.tsv loadtest/accounts.tsv
# loadtest/accounts.tsv is ignored by git
```

`accounts.tsv` format:

```text
student@example.test<TAB>password
coordinator@example.test<TAB>password
```

Use 5–10 accounts. The Locust file distributes virtual users across the list.

## 3. Seed load-test rows

The scripts live in `backend/` so they are included in the backend image.

> The demo database must be `cstu_demo`. The script refuses to run against any
> other database. Run `./deploy.sh backup` first.

After the branch is deployed (`./deploy.sh backend`), run through SSM Session
Manager on the EC2 instance:

```bash
sudo docker exec cs361-backend python loadtest_seed.py
```

The seed adds:

- 100 `[LT] Partner ...` rows
- 50 `[LT] Document ...` rows
- 300 `[LT] Activity ...` rows

For local Compose:

```bash
docker compose exec backend python loadtest_seed.py
```

If the existing demo is enough (93 activities, 29 partners), skip this step and
rely on `./deploy.sh backup` / `./deploy.sh restore`.

## 4. Smoke test with one user

```bash
export LOADTEST_HOST=https://32.189.5.234.sslip.io
export LOADTEST_ACCOUNTS_FILE=loadtest/accounts.tsv

locust -f loadtest/locustfile.py --headless -u 1 -r 1 -t 30s
```

Expected: login succeeds, list/detail/write return 2xx, error rate 0%.
If login fails, check the password file and that the account is in Cognito.

## 5. Load stages

Run from a teammate's laptop (not the EC2 instance) so the network path is
included. Keep each stage 3–5 minutes and record results before increasing.

| Stage | Users | Spawn rate | Duration |
|---|---:|---:|---:|
| Warm-up | 10 | 2/s | 2m |
| Baseline | 50 | 5/s | 5m |
| Stress | 100 | 10/s | 5m |
| Stress | 200 | 10/s | 5m |
| Stress | 400 | 10/s | 5m |

Example:

```bash
mkdir -p loadtest/results
locust -f loadtest/locustfile.py \
  --headless -u 100 -r 10 -t 5m \
  --csv loadtest/results/run-100 \
  --html loadtest/results/run-100.html
```

Stop a stage when any of these happens:

- error rate > 2%
- p95 latency > 3 seconds
- EC2 CPU > 90% for 2 minutes
- PostgreSQL connections close to the pool limit

## 6. Monitor during the test

CloudWatch basic EC2 metrics update every 5 minutes; use the sampler for
per-container detail. Copy `loadtest/monitor.sh` to the instance or paste it
through SSM Session Manager:

```bash
bash monitor.sh | tee /tmp/loadtest-monitor.log
```

It prints CPU/RAM, `docker stats` per container, and the number of PostgreSQL
connections every 5 seconds.

Also watch:

- Locust: RPS, p50/p95/p99, failures
- CloudWatch: CPUUtilization, NetworkIn/Out
- `docker stats`: backend, frontend, database, caddy
- PostgreSQL: `pg_stat_activity`, slow queries

## 7. Cleanup

Preferred: restore the pre-test backup.

```bash
cd infra/new-account
./deploy.sh restore <backup-key> --yes
```

Or remove only the `[LT]` rows:

```bash
sudo docker exec cs361-backend python loadtest_cleanup.py
```

The cleanup removes:

1. feedback rows (including `[LT] locust-...` written during the test)
2. outcomes linked to LT rows
3. audit logs for LT records
4. document scope items
5. activities, documents, partners with the `[LT]` prefix

Delete the test Cognito users separately if they should not remain:

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id <pool-id> \
  --username student2@example.test
```

## 8. Record results

| Stage | Users | RPS | p50 | p95 | p99 | Errors | EC2 CPU | DB conns | Bottleneck |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 10 | 10 | | | | | | | | |
| 50 | 50 | | | | | | | | |
| 100 | 100 | | | | | | | | |
| 200 | 200 | | | | | | | | |
| 400 | 400 | | | | | | | | |

## Notes

- Cognito access tokens expire after about 1 hour; keep each run shorter or
  restart Locust.
- Do not commit `loadtest/accounts.tsv`, passwords, or result CSVs.
- Do not run `./deploy.sh seed --yes` against real data; it deletes every row in
  `cstu_demo`.
- The first bottleneck is likely the single EC2 instance. Measure before
  changing anything, then change one variable at a time.
