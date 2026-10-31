"""V4-4 (#89) schema migration: async import state and reusable outcome IDs.

Run with the API stopped, after backing up the database:
    python migrate_v4_4.py
"""

import argparse

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text

import migrate_v4


STATUS_CHECK = "status IN ('processing', 'previewed', 'committed', 'rolled_back', 'failed')"


def migrate(engine):
    if engine.dialect.name not in {"sqlite", "postgresql"}:
        raise ValueError("Only SQLite and PostgreSQL are supported")

    # Ensures the prerequisite V4-1 schema/lookups exist before adding V4-4 fields.
    migrate_v4.migrate(engine)

    with engine.connect() as connection:
        # SQLite's batch table rebuild drops/recreates import_batches. Disable FK
        # enforcement for that schema operation so existing feedback/outcome
        # import_batch_id references are not SET NULL while the parent is rebuilt.
        if engine.dialect.name == "sqlite":
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
        transaction = connection.begin()
        try:
            _apply_v4_4_changes(connection, engine)
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise
        finally:
            if engine.dialect.name == "sqlite":
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
                connection.commit()


def _apply_v4_4_changes(connection, engine):
    batch_columns = {c["name"] for c in inspect(connection).get_columns("import_batches")}
    if "preview_data" not in batch_columns:
        connection.exec_driver_sql("ALTER TABLE import_batches ADD COLUMN preview_data JSON")

    outcome_columns = {c["name"] for c in inspect(connection).get_columns("outcomes")}
    if "external_id" not in outcome_columns:
        connection.exec_driver_sql("ALTER TABLE outcomes ADD COLUMN external_id VARCHAR")

    # Rebuild the named status CHECK because existing V4-1 databases constrain
    # status to previewed/committed/rolled_back/failed and would reject processing.
    checks = inspect(connection).get_check_constraints("import_batches")
    status_check = next((c for c in checks if c.get("name") == "ck_import_batches_status"), None)
    if status_check is None or "processing" not in (status_check.get("sqltext") or ""):
        if engine.dialect.name == "sqlite":
            with Operations(MigrationContext.configure(connection)).batch_alter_table(
                "import_batches", recreate="always"
            ) as batch:
                if status_check is not None:
                    batch.drop_constraint("ck_import_batches_status", type_="check")
                batch.create_check_constraint("ck_import_batches_status", STATUS_CHECK)
        else:
            if status_check is not None:
                connection.execute(text(
                    "ALTER TABLE import_batches DROP CONSTRAINT ck_import_batches_status"
                ))
            connection.execute(text(
                "ALTER TABLE import_batches ADD CONSTRAINT ck_import_batches_status CHECK (" + STATUS_CHECK + ")"
            ))

    # Multiple non-imported outcomes may have NULL external_id; real imported
    # IDs are globally unique so a later import cannot silently duplicate them.
    inspector = inspect(connection)
    has_unique = any(
        c.get("column_names") == ["external_id"]
        for c in inspector.get_unique_constraints("outcomes")
    ) or any(
        i.get("unique") and i.get("column_names") == ["external_id"]
        for i in inspector.get_indexes("outcomes")
    )
    if not has_unique:
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX uq_outcomes_external_id ON outcomes (external_id)"
        )

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="Defaults to configured DATABASE_URL")
    args = parser.parse_args()
    from config import settings

    engine = create_engine(args.database_url or settings.DATABASE_URL)
    try:
        migrate(engine)
    finally:
        engine.dispose()
    print("V4-4 schema migration complete.")


if __name__ == "__main__":
    main()
