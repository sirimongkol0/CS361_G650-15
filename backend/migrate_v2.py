"""Idempotent V2 migration for existing SQLite and PostgreSQL databases.

Run with the application stopped. SQLite files are backed up before migration.
PostgreSQL deployments should take a database snapshot before running this CLI.
"""

import argparse
from datetime import datetime, timezone
from pathlib import Path
import sqlite3

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import CheckConstraint, create_engine, inspect, text

from database import Base
import models  # noqa: F401 -- register the target schema


CORE_TABLES = ("partners", "documents", "document_scope_items", "activities")
NAMING = {"uq": "uq_%(table_name)s_%(column_0_name)s",
          "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}


def migrate(engine):
    """Preserve core rows/IDs and unrelated tables; remove retired timeline data."""
    with engine.connect() as connection:
        sqlite = connection.dialect.name == "sqlite"
        if sqlite:
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
        try:
            with connection.begin():
                if sqlite:
                    # sqlite3 legacy transaction mode does not begin on DDL.
                    connection.exec_driver_sql("BEGIN")
                operations = Operations(MigrationContext.configure(connection))
                for name in CORE_TABLES:
                    target = Base.metadata.tables[name]
                    inspector = inspect(connection)
                    if not inspector.has_table(name):
                        target.create(connection)
                        continue
                    columns = {c["name"]: c for c in inspector.get_columns(name)}
                    if "is_published" in columns:
                        connection.execute(text(f'UPDATE "{name}" SET is_published=false WHERE is_published IS NULL'))
                    uniques = inspector.get_unique_constraints(name)
                    indexes = [i for i in inspector.get_indexes(name)
                               if i["unique"] and not i.get("duplicates_constraint")]
                    foreign_keys = inspector.get_foreign_keys(name)
                    foreign_changes = []
                    for fk in target.foreign_key_constraints:
                        local = list(fk.column_keys)
                        remote = [element.column.name for element in fk.elements]
                        parent = fk.referred_table.name
                        old_fk = next((f for f in foreign_keys if f["constrained_columns"] == local), None)
                        if (old_fk is None or old_fk["referred_table"] != parent
                                or old_fk["referred_columns"] != remote
                                or old_fk.get("options", {}).get("ondelete") != fk.ondelete):
                            foreign_changes.append((fk, old_fk, local, parent, remote))
                    check_names = {c["name"] for c in inspector.get_check_constraints(name)}
                    checks = [c for c in target.constraints
                              if isinstance(c, CheckConstraint) and c.name not in check_names]
                    changes = []
                    for column in target.columns:
                        old = columns.get(column.name)
                        if old is None:
                            changes.append((column, None))
                        elif (old["nullable"] != column.nullable
                              or old["type"].compile(dialect=connection.dialect) != column.type.compile(dialect=connection.dialect)
                              or (column.name == "is_published" and str(old["default"]).lower()
                                  not in {"false", "0", "(0)", "false::boolean"})):
                            changes.append((column, old))
                    if not changes and not uniques and not indexes and not foreign_changes and not checks:
                        continue
                    with operations.batch_alter_table(name, naming_convention=NAMING) as batch:
                        for unique in uniques:
                            batch.drop_constraint(
                                unique["name"] or f"uq_{name}_{unique['column_names'][0]}",
                                type_="unique",
                            )
                        for index in indexes:
                            batch.drop_index(index["name"])
                            batch.create_index(index["name"], index["column_names"], unique=False)
                        for column, old in changes:
                            if old is None:
                                batch.add_column(column._copy())
                            else:
                                options = {}
                                if column.name == "is_published":
                                    options["server_default"] = column.server_default.arg
                                batch.alter_column(column.name, existing_type=old["type"],
                                                   type_=column.type, nullable=column.nullable,
                                                   **options)
                        for fk, old_fk, local, parent, remote in foreign_changes:
                            if old_fk:
                                batch.drop_constraint(old_fk["name"] or
                                                      f"fk_{name}_{local[0]}_{old_fk['referred_table']}",
                                                      type_="foreignkey")
                            batch.create_foreign_key(f"fk_{name}_{local[0]}_{parent}", parent,
                                                     local, remote, ondelete=fk.ondelete)
                        for check in checks:
                            batch.create_check_constraint(check.name, check.sqltext)
                if inspect(connection).has_table("document_timeline_steps"):
                    operations.drop_table("document_timeline_steps")
                if sqlite and connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall():
                    raise RuntimeError("Foreign-key validation failed; migration rolled back")
        finally:
            if sqlite:
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
                connection.commit()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="Defaults to configured DATABASE_URL")
    args = parser.parse_args()
    from config import settings
    engine = create_engine(args.database_url or settings.DATABASE_URL)
    if engine.dialect.name not in {"sqlite", "postgresql"}:
        parser.error("Only SQLite and PostgreSQL are supported")
    if engine.dialect.name == "sqlite" and engine.url.database not in {None, "", ":memory:"}:
        path = Path(engine.url.database).resolve()
        if path.exists():
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            backup = path.with_name(f"{path.name}.pre-v2-{stamp}.bak")
            with sqlite3.connect(path) as source, sqlite3.connect(backup) as destination:
                source.backup(destination)
            print(f"Backup: {backup}")
    migrate(engine)
    engine.dispose()
    print("V2 schema migration complete.")


if __name__ == "__main__":
    main()
