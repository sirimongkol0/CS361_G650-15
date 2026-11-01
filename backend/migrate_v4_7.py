"""V4-7 (#100) schema migration: agreements that renew an earlier agreement.

Builds on V4-4 and only adds what is missing, so it is safe to run more than once.
Run with the API stopped, after backing up the database:
    python migrate_v4_7.py
"""

import argparse

from sqlalchemy import create_engine, inspect

import migrate_v4_4
from models import RENEWAL_DECISION_CHECK

COLUMNS = {
    "renews_document_id": "INTEGER REFERENCES documents(id) ON DELETE SET NULL",
    "renewal_decision": f"VARCHAR CONSTRAINT ck_documents_renewal_decision CHECK ({RENEWAL_DECISION_CHECK})",
    "renewal_reason": "TEXT",
    "renewal_decided_by_user_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
    "renewal_decided_at": "TIMESTAMP",
}


def migrate(engine):
    migrate_v4_4.migrate(engine)
    with engine.begin() as connection:
        existing = {c["name"] for c in inspect(connection).get_columns("documents")}
        for name, ddl in COLUMNS.items():
            if name not in existing:
                connection.exec_driver_sql(f"ALTER TABLE documents ADD COLUMN {name} {ddl}")
        indexes = {i["name"] for i in inspect(connection).get_indexes("documents")}
        if "ix_documents_renews_document_id" not in indexes:
            connection.exec_driver_sql(
                "CREATE INDEX ix_documents_renews_document_id ON documents (renews_document_id)")


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
    print("V4-7 schema migration complete.")


if __name__ == "__main__":
    main()
