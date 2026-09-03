# V1 Setup Guide

## Prerequisites

- Docker Engine or Docker Desktop with Docker Compose v2 (recommended), or
- Python 3.11+, Node.js 20.9+, and PostgreSQL 16+ for running processes manually.

## Option A — clean-checkout Docker Compose

No cloud database, AWS credentials or local language runtimes are required.
From the repository root:

```bash
docker compose up --build -d --wait
docker compose ps --all
python scripts/smoke_test.py
```

Compose starts the services in this order:

1. PostgreSQL becomes healthy.
2. The one-shot `seed` service creates the schema and inserts the development
   dataset. It must exit with code 0.
3. The backend starts and becomes healthy only after it can query PostgreSQL.
4. The frontend starts after the backend is healthy.

Expected endpoints:

| URL | Expected result |
|---|---|
| http://localhost:8000/api/v1/health | `{"status":"healthy"}` |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:3000 | redirects to `/dashboard/public` |
| http://localhost:3000/activities | seeded activity list |

The checked-in defaults are development-only and contain no production
credentials. You do not need an `.env` file. To change ports or local database
credentials, copy `.env.example` to `.env` and edit it. When changing
`BACKEND_PORT`, also make `PUBLIC_API_URL` use that port because this URL is
embedded in the browser bundle.

Useful lifecycle commands:

```bash
# Inspect the one-shot seed and application logs
docker compose logs seed backend frontend

# Stop containers but preserve the PostgreSQL and upload volumes
docker compose down

# Delete containers and all local development data, then recreate from scratch
docker compose down --volumes
docker compose up --build -d --wait
```

The PostgreSQL port is published only on `127.0.0.1`. Local file storage is the
default; the Compose flow never connects to RDS or S3.

## Option B — local processes

1. Backend (SQLite is the safe zero-config default):

   ```bash
   cd backend
   python -m venv venv
   # Windows: venv/Scripts/pip install -r requirements.txt
   # macOS/Linux: venv/bin/pip install -r requirements.txt
   copy .env.example .env
   venv/Scripts/python -m uvicorn main:app --reload --port 8000
   ```

   On macOS/Linux, use `cp` instead of `copy` and `venv/bin/python` instead of
   `venv/Scripts/python`. To use PostgreSQL, change `DATABASE_URL` in
   `backend/.env`.

2. Frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Schema and seed verification

Compose seeds the frontend-compatible dataset automatically. The seed is
additive and idempotent: running it again creates no duplicate rows.

```bash
# With the Compose database running; the second run reports zero inserts
docker compose run --rm seed

# Real TU sample data for a separately configured local database
python backend/seed.py
```

Schema definitions and constraints live in `backend/models.py`. See
`database/schema/README.md` for the integrity rules. The V1 setup uses
SQLAlchemy `create_all` for clean/additive schema creation; it is not a
replacement for production migration tooling.

## Tests

```bash
cd backend
python -m pytest tests/ -q

# Full-stack check after docker compose up
cd ..
python scripts/smoke_test.py
```

`test_seed_and_schema.py` creates a clean schema, runs the seed twice, compares
table counts, verifies relationships and exercises database constraints. CI
also builds a clean Compose stack and runs the smoke script.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `seed` exits non-zero | schema, constraint or database startup problem | `docker compose logs seed database` |
| backend remains unhealthy | it cannot query PostgreSQL | `docker compose logs backend database` |
| port already allocated | another local service uses 3000, 8000 or 5432 | copy `.env.example` to `.env`, change the port, and update `PUBLIC_API_URL` if needed |
| a fresh database is required | named volume still contains prior local data | `docker compose down --volumes`, then start again |
| seeded document download is 404 | mock seed stores document metadata only | upload a PDF through the API; local uploads persist in `backend_storage` |
