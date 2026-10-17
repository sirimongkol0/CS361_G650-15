
"""Idempotent V3/V3-4 migration for SQLite and PostgreSQL.

Run with the application stopped and after taking a database backup.
Preserves existing rows and supports repeated migration runs.
"""

import argparse

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect

from database import Base
import models  # noqa: F401 -- register the target schema
import migrate_v2


V3_TABLES = ("users", "revoked_tokens", "audit_logs")

V34_COLUMNS = {
    "activities": {
        "owner_user_id": "INTEGER",
        "is_deleted": "BOOLEAN NOT NULL DEFAULT FALSE",
    },
    "exchange_students": {
        "user_id": "INTEGER",
        "owner_user_id": "INTEGER",
    },
}



def _ensure_exchange_user_foreign_key(connection):
    """Ensure exchange_students.user_id references users.id."""
    inspector = inspect(connection)

    if not inspector.has_table("exchange_students"):
        raise RuntimeError(
            "exchange_students table is missing after schema creation"
        )

    foreign_keys = inspector.get_foreign_keys("exchange_students")

    matching_fk = next(
        (
            fk for fk in foreign_keys
            if fk.get("constrained_columns") == ["user_id"]
            and fk.get("referred_table") == "users"
            and fk.get("referred_columns") == ["id"]
            and (
                (fk.get("options") or {}).get("ondelete", "").upper()
                == "SET NULL"
            )
        ),
        None,
    )

    if matching_fk:
        return

    existing_user_fks = [
        fk for fk in foreign_keys
        if fk.get("constrained_columns") == ["user_id"]
    ]

    if existing_user_fks:
        raise RuntimeError(
            "exchange_students.user_id already has a different "
            "foreign key. Review the existing constraint before "
            "changing it automatically."
        )

    operations = Operations(MigrationContext.configure(connection))

    with operations.batch_alter_table(
        "exchange_students"
    ) as batch:
        batch.create_foreign_key(
            "fk_exchange_students_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )


def migrate(engine):
    with engine.begin() as connection:
        Base.metadata.tables["users"].create(connection, checkfirst=True)

    """Apply V2 and V3/V3-4 schema changes idempotently."""
    if engine.dialect.name not in {"sqlite", "postgresql"}:
        raise ValueError(
            "Only SQLite and PostgreSQL are supported"
        )

    # Create or upgrade the V2 core schema first.
    migrate_v2.migrate(engine)

    with engine.begin() as connection:
        # Authentication and audit tables.
        for name in V3_TABLES:
            Base.metadata.tables[name].create(
                connection,
                checkfirst=True,
            )

        # V3-4: ensure exchange_students exists on a fresh database.
        Base.metadata.tables["exchange_students"].create(
            connection,
            checkfirst=True,
        )

        # Add V3-4 columns that are missing from existing tables.
        for table, columns in V34_COLUMNS.items():
            inspector = inspect(connection)

            if not inspector.has_table(table):
                raise RuntimeError(
                    f"Required table {table!r} is missing"
                )

            existing = {
                column["name"]
                for column in inspector.get_columns(table)
            }

            for column, definition in columns.items():
                if column not in existing:
                    connection.exec_driver_sql(
                        f"ALTER TABLE {table} "
                        f"ADD COLUMN {column} {definition}"
                    )
                    existing.add(column)

            # Create indexes for ownership and user lookups.
            for indexed_column in ("owner_user_id", "user_id"):
                if indexed_column in existing:
                    connection.exec_driver_sql(
                        f"CREATE INDEX IF NOT EXISTS "
                        f"ix_{table}_{indexed_column} "
                        f"ON {table} ({indexed_column})"
                    )

        # Existing exchange tables may lack this model-defined constraint.
        _ensure_exchange_user_foreign_key(connection)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        help="Defaults to configured DATABASE_URL",
    )
    args = parser.parse_args()

    from config import settings

    engine = create_engine(
        args.database_url or settings.DATABASE_URL
    )

    try:
        migrate(engine)
    finally:
        engine.dispose()

    print("V3/V3-4 schema migration complete.")


if __name__ == "__main__":
    main()



