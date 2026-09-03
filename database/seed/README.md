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
Database constraints also protect the seed natural keys. For the complete local
Compose demo, the one-shot `seed` service runs `backend/seed_mock.py`; it
initializes the schema and inserts the frontend-compatible dataset before the
backend starts. Re-running `docker compose up` leaves the row counts unchanged.

Automated verification lives in `backend/tests/test_seed_and_schema.py`.
