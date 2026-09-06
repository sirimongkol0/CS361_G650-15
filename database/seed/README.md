# Database Seed Documentation

This directory contains documentation and the seed script for populating the database with test data.

## Seed Script

`seed.py` — A Python script using **SQLAlchemy ORM** (works with both SQLite dev and PostgreSQL RDS/prod).

### Usage

```bash
# Set DATABASE_URL (default: sqlite:///./app.db)
export DATABASE_URL="postgresql://user:pass@endpoint:5432/dbname"

# Run the seed
python database/seed/seed.py
```

The script is **idempotent** — running it multiple times creates no duplicates.
V2 allows repeated names; the sequential seed checks for existing rows before
inserting. Do not run concurrent seed processes. For the complete local
Compose demo, the one-shot `seed` service runs `backend/seed_mock.py`; it
initializes the schema and inserts the frontend-compatible dataset before the
backend starts. Re-running `docker compose up` leaves the row counts unchanged.

Automated verification lives in `backend/tests/test_seed_and_schema.py`.

## V2 sample data and files

Use `backend/seed_mock.py` for the shared V2 field contract and relationship
fixtures. It includes several partner/activity types and dates, activities with
and without an agreement, and document scope items. Each mock agreement has a
downloadable PDF from `backend/fixtures/v2-sample.pdf`, visibly labelled as a
demo fixture rather than an official or signed agreement.

Run from the repository root with a disposable database:

```bash
python backend/migrate_v2.py --database-url sqlite:///./v2-demo.db
python backend/seed_mock.py --database-url sqlite:///./v2-demo.db
python backend/seed_mock.py --database-url sqlite:///./v2-demo.db
```

For PostgreSQL, set `DATABASE_URL` to a disposable database such as
`partner_activity_mock`, then run `python backend/migrate_v2.py` followed by
`python backend/seed_mock.py` twice. Other PostgreSQL names require `--yes`.
Use `STORAGE_BACKEND=local` and `LOCAL_STORAGE_DIR` for local fixture storage.
Do not seed the shared `partner_activity` just to run tests.

Repeat runs preserve row counts and file timestamps. Missing files in the
reserved `mock/agreements/` namespace are restored; unrelated real files and
records are retained. Mock file metadata is filled when previously unknown.
After starting the API against the same database/storage, run:

```bash
python scripts/verify_v2_api.py --api http://localhost:8000/api/v1
```

This read-only check exercises public lists/details, relationships and PDF
downloads. The isolated test suite additionally verifies draft filtering.
