"""Idempotent V3 migration: brings a database to V2, then adds the auth tables.

Run with the application stopped, after taking a backup/snapshot. Existing
rows are never modified; repeating the migration is a no-op.
"""

import argparse

from sqlalchemy import create_engine

from database import Base
import models  # noqa: F401 -- register the target schema
import migrate_v2

V3_TABLES = ("users", "revoked_tokens", "audit_logs")


def migrate(engine):
    migrate_v2.migrate(engine)
    with engine.begin() as connection:
        for name in V3_TABLES:
            Base.metadata.tables[name].create(connection, checkfirst=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="Defaults to configured DATABASE_URL")
    args = parser.parse_args()
    from config import settings
    engine = create_engine(args.database_url or settings.DATABASE_URL)
    if engine.dialect.name not in {"sqlite", "postgresql"}:
        parser.error("Only SQLite and PostgreSQL are supported")
    migrate(engine)
    engine.dispose()
    print("V3 schema migration complete.")


if __name__ == "__main__":
    main()
