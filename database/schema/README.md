# Database schema

The V1 schema is defined once in `backend/models.py` with SQLAlchemy. Both the
application startup and seed commands call `Base.metadata.create_all`, so a
clean SQLite or PostgreSQL database can be initialized without RDS or a SQL
dump. V1 only supports additive schema changes; a migration tool is required
before destructive production migrations are introduced.

Core integrity rules are enforced by the database:

- stable natural keys for seeded partners, documents, activities and feedback;
- foreign keys use `SET NULL` for optional parent links and `CASCADE` for
  document scope/timeline children;
- ratings, counts, positions and date ranges have check constraints;
- required identity/date/publish fields are non-null.

Run `pytest tests/test_seed_and_schema.py -q` from `backend/` to verify schema
creation, constraints, relationship resolution and two-pass seed idempotency.
