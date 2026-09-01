# V1 Setup Guide

## Prerequisites

- Docker + Docker Compose (recommended path), **or**
- Python 3.11+, Node.js 20+, and access to a PostgreSQL database

## Option A — Docker Compose (full stack)

1. Configure the environment file next to `docker-compose.yml`
   (`.env`, gitignored):

   ```
   DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
   STORAGE_BACKEND=local            # or s3
   S3_BUCKET=cs361-partner-docs     # when STORAGE_BACKEND=s3
   AWS_REGION=ap-southeast-1
   AWS_ACCESS_KEY_ID=<scoped key>   # only for s3
   AWS_SECRET_ACCESS_KEY=<scoped secret>
   ```

2. Start everything:

   ```bash
   docker compose up --build -d
   ```

3. Verify:

   | URL | Expect |
   |---|---|
   | http://localhost:8000/api/v1/health | `{"status":"healthy"}` |
   | http://localhost:3000 | frontend (redirects to /login) |
   | http://localhost:3000/activities | activity list backed by the API |

Notes:

- Inside the compose network the frontend calls the backend by service name;
  browser-side links use the published port 8000. Both are injected as build
  args in `docker-compose.yml`.
- The frontend publishes on host port **3000**.
- Stop with `docker compose down` (containers only) — data lives in RDS/S3,
  so nothing is lost.

## Option B — Local processes (faster iteration)

1. **Database** — point `DATABASE_URL` at any PostgreSQL instance.
2. **Backend**:

   ```bash
   cd backend
   python -m venv venv && venv/Scripts/pip install -r requirements.txt   # Windows
   cp .env.example .env   # then edit values
   venv/Scripts/python -m uvicorn main:app --reload --port 8000
   ```

   Swagger docs: http://localhost:8000/docs

3. **Frontend**:

   ```bash
   cd frontend
   npm install
   npm run dev   # http://localhost:3000
   ```

## Seeding

Two seed scripts exist (`backend/` namespace, run from `backend/`):

| Script | Target | Data |
|---|---|---|
| `database/seed/seed.py` (via `backend/seed.py` entry) | any DB from `DATABASE_URL` | Real TU stakeholder data (partners, activities, template PDFs uploaded to storage) |
| `seed_mock.py` | **only** sqlite or a `*_mock` database | Frontend mock dataset (8 partners, 10 activities, 7 documents, feedback, exchange, admin) |

```bash
# mock dataset into the mock database (safety-guarded)
venv/Scripts/python seed_mock.py --database-url "$MOCK_DATABASE_URL" --yes

# idempotent: running again inserts 0 new rows
```

`seed_mock.py` writes document metadata only. For downloadable documents on
S3, upload placeholder PDFs once (see `mock/agreements/mock-doc-*.pdf` keys),
or run with `STORAGE_BACKEND=local` so downloads serve from disk.

## Running Tests

```bash
cd backend
DATABASE_URL="postgresql://app_user:app_password@localhost:5432/partner_activity_test" \
STORAGE_BACKEND=local \
venv/Scripts/python -m pytest tests/ -q
```

- Tests create/drop tables per test; they need a **disposable** database.
- With no `.env` present, storage defaults to `local` — CI runs without any
  AWS credentials.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR:

1. **backend-test** — Postgres 15 service container, install
   `requirements.txt`, `pytest tests/ -v` with a disposable `DATABASE_URL`.
2. **frontend-build** — `npm install`, `npm run build` with
   `NEXT_PUBLIC_API_URL` set.

Both jobs are hermetic: no `.env`, no AWS keys, no RDS access.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Error response from daemon: Conflict. The container name ... already in use` | Old container holding the name | `docker rm -f <name>` then `docker compose up` again |
| Frontend renders mock data forever | Backend unreachable | Check `curl http://localhost:8000/api/v1/health`; pages fall back to mock by design |
| Document download returns 500 | Metadata row exists but file missing in storage | Upload the file to the bucket/path in `storageKey`, or re-upload the document |
| 404 on list endpoints that should have data | Rows are `is_published=false` | Publish rows or check you seeded the DB the backend is pointed at |
