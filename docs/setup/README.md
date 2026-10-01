# V2 Setup Guide

For disposable sample data, migration and browser checks, follow the
[V2 demo guide](../demo-v2.md). Public data is read-only; editing is V3+.

## Prerequisites

- Docker Engine or Docker Desktop with Docker Compose v2 (recommended), or
- Python 3.11+, Node.js 22+, and PostgreSQL 16+ for running processes manually.

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
2. The backend creates any missing tables, then becomes healthy only after it
   can query PostgreSQL.
3. The frontend starts after the backend is healthy.

The local database starts empty; lists show their empty state until records
are added.

Expected endpoints:

| URL | Expected result |
|---|---|
| http://localhost:8000/api/v1/health | `{"status":"healthy"}` |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:3000 | redirects to `/dashboard/public` |
| http://localhost:3000/activities | activity list (empty on a fresh database) |
| http://localhost:3000/stakeholders | stakeholder list |
| http://localhost:3000/documents | document list, filters and downloads |

The checked-in defaults are development-only and contain no production
credentials. You do not need an `.env` file. To change ports or local database
credentials, copy `.env.example` to `.env` and edit it. When changing
`BACKEND_PORT`, also make `PUBLIC_API_URL` use that port because this URL is
embedded in the browser bundle.

Useful lifecycle commands:

```bash
# Inspect the application logs
docker compose logs backend frontend

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
   venv/Scripts/python -m uvicorn main:app --reload --port 8000
   ```

   On macOS/Linux, use `venv/bin/python` instead of
   `venv/Scripts/python`. To use PostgreSQL, change `DATABASE_URL` in
   `backend/.env`.

2. Frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Schema

Schema definitions and constraints live in `backend/models.py`. See
`database/schema/README.md` for the integrity rules. A fresh V2 setup uses
SQLAlchemy `create_all` for fresh schema creation. For an existing database,
stop the API and run `python backend/migrate_v2.py` with its DATABASE_URL before
restarting. Back up existing data before a migration.

## Tests

```bash
cd backend
python -m pytest tests/ -q

# Full-stack check after docker compose up
cd ..
python scripts/smoke_test.py
```

Tests build their own data from `backend/tests/sample_data.py`.
`test_seed_and_schema.py` checks that this dataset is internally consistent and
exercises database constraints. CI also builds a clean Compose stack and runs
the smoke script.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| backend remains unhealthy | it cannot query PostgreSQL | `docker compose logs backend database` |
| port already allocated | another local service uses 3000, 8000 or 5432 | copy `.env.example` to `.env`, change the port, and update `PUBLIC_API_URL` if needed |
| a fresh database is required | named volume still contains prior local data | `docker compose down --volumes`, then start again |
| document download is 404 | the record is metadata-only or its file is missing | check fileAvailability and its storage object; public upload is disabled |
