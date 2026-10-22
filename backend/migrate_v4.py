"""Idempotent V4 migration (V4-1, #86) for SQLite and PostgreSQL.

Adds outcomes, admin-extensible type lists, import batches and the V4
feedback columns. Runs the V3 migration first. Existing feedback keeps every
row: the free-text ``source`` is mapped to a respondent type and channel, and
rows without any context are flagged ``is_legacy``.

Run with the application stopped and after taking a database backup.
"""

import argparse

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text

from database import Base
import models
import migrate_v3


# Created in dependency order; lookup tables seed themselves on creation.
V4_TABLES = ("outcome_types", "respondent_types", "feedback_sources", "import_batches", "outcomes")

V4_FEEDBACK_COLUMNS = {
    "document_id": "INTEGER REFERENCES documents (id) ON DELETE SET NULL",
    "exchange_id": "INTEGER REFERENCES exchange_students (id) ON DELETE SET NULL",
    "is_legacy": "BOOLEAN NOT NULL DEFAULT FALSE",
    "respondent_type_id": "INTEGER REFERENCES respondent_types (id)",
    "feedback_source_id": "INTEGER REFERENCES feedback_sources (id)",
    "submitted_by_user_id": "INTEGER REFERENCES users (id) ON DELETE SET NULL",
    "import_batch_id": "INTEGER REFERENCES import_batches (id) ON DELETE SET NULL",
    "external_id": "VARCHAR",
}

FEEDBACK_INDEXED = (
    "partner_id", "activity_id", "document_id", "exchange_id",
    "respondent_type_id", "feedback_source_id", "submitted_by_user_id", "import_batch_id",
)

# Pre-V4 ``feedbacks.source`` mixed who answered with how it arrived.
# value -> (respondent type code, feedback source code)
LEGACY_SOURCE_MAP = {
    "participant": ("participant", "manual_entry"),
    "ผู้เข้าร่วมกิจกรรม": ("participant", "manual_entry"),
    "alumni": ("alumni", "manual_entry"),
    "ศิษย์เก่า": ("alumni", "manual_entry"),
    "partner": ("partner", "manual_entry"),
    "คู่ความร่วมมือ": ("partner", "manual_entry"),
    "student": ("student", "manual_entry"),
    "นักศึกษา": ("student", "manual_entry"),
    "coop_system": (None, "coop_system"),
    "ระบบสหกิจศึกษา": (None, "coop_system"),
}


def _lookup_ids(connection, table):
    return dict(connection.exec_driver_sql(f"SELECT code, id FROM {table}").fetchall())


def _backfill_feedback(connection):
    """Map legacy ``source`` text; unknown values become manual entries with no respondent type."""
    respondents = _lookup_ids(connection, "respondent_types")
    channels = _lookup_ids(connection, "feedback_sources")
    rows = connection.exec_driver_sql(
        "SELECT id, source FROM feedbacks WHERE feedback_source_id IS NULL"
    ).fetchall()
    for row_id, source in rows:
        respondent, channel = LEGACY_SOURCE_MAP.get((source or "").strip(), (None, "manual_entry"))
        connection.execute(
            text("UPDATE feedbacks SET respondent_type_id = :respondent, "
                 "feedback_source_id = :channel WHERE id = :id"),
            {"respondent": respondents.get(respondent), "channel": channels[channel], "id": row_id},
        )
    connection.exec_driver_sql(
        f"UPDATE feedbacks SET is_legacy = TRUE WHERE NOT ({models.CONTEXT_PRESENT})"
    )


def _relax_feedback_title(connection):
    """Pre-V4 titles were unique; two people may now send feedback with the same title."""
    inspector = inspect(connection)
    for index in inspector.get_indexes("feedbacks"):
        if index["column_names"] == ["title"] and index.get("unique"):
            connection.exec_driver_sql(f"DROP INDEX {index['name']}")
    unique_titles = [
        c["name"] for c in inspector.get_unique_constraints("feedbacks")
        if c["column_names"] == ["title"] and c.get("name")
    ]
    if unique_titles:
        with Operations(MigrationContext.configure(connection)).batch_alter_table("feedbacks") as batch:
            for name in unique_titles:
                batch.drop_constraint(name, type_="unique")
    connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_feedbacks_title ON feedbacks (title)")


def _ensure_feedback_constraints(connection):
    inspector = inspect(connection)
    checks = {c["name"] for c in inspector.get_check_constraints("feedbacks")}
    uniques = {c["name"] for c in inspector.get_unique_constraints("feedbacks")}
    missing_check = "ck_feedbacks_context" not in checks
    missing_unique = "uq_feedbacks_source_external_id" not in uniques
    if not (missing_check or missing_unique):
        return
    with Operations(MigrationContext.configure(connection)).batch_alter_table("feedbacks") as batch:
        if missing_check:
            batch.create_check_constraint(
                "ck_feedbacks_context", f"is_legacy OR {models.CONTEXT_PRESENT}"
            )
        if missing_unique:
            batch.create_unique_constraint(
                "uq_feedbacks_source_external_id", ["feedback_source_id", "external_id"]
            )


def migrate(engine):
    """Apply V3 then V4 schema changes idempotently."""
    if engine.dialect.name not in {"sqlite", "postgresql"}:
        raise ValueError("Only SQLite and PostgreSQL are supported")

    migrate_v3.migrate(engine)

    with engine.begin() as connection:
        for name in V4_TABLES:
            Base.metadata.tables[name].create(connection, checkfirst=True)
        # Tables created before a seed row was added still get it; admin rows are kept.
        for name in ("outcome_types", "respondent_types", "feedback_sources"):
            models.seed_lookup(Base.metadata.tables[name], connection)

        existing = {c["name"] for c in inspect(connection).get_columns("feedbacks")}
        for column, definition in V4_FEEDBACK_COLUMNS.items():
            if column not in existing:
                connection.exec_driver_sql(f"ALTER TABLE feedbacks ADD COLUMN {column} {definition}")
        for column in FEEDBACK_INDEXED:
            connection.exec_driver_sql(
                f"CREATE INDEX IF NOT EXISTS ix_feedbacks_{column} ON feedbacks ({column})"
            )

        _backfill_feedback(connection)
        _relax_feedback_title(connection)
        _ensure_feedback_constraints(connection)


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

    print("V4 schema migration complete.")


if __name__ == "__main__":
    main()
