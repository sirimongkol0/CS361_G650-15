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

The script is **idempotent** — running it multiple times creates no duplicates. It uses `name` (Partner) and `name` (Activity) as uniqueness keys.
