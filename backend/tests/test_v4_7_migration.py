"""V4-7 (#100): the renewal columns are added to an existing database, and re-running is harmless."""
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect

import migrate_v4_7
from database import Base

NEW = set(migrate_v4_7.COLUMNS)


def test_migration_adds_renewal_columns_and_can_run_twice(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v4_7.db'}")
    Base.metadata.create_all(engine)
    with engine.begin() as connection:  # roll the documents table back to its V4-5 shape
        connection.exec_driver_sql("DROP INDEX ix_documents_renews_document_id")
        connection.exec_driver_sql("INSERT INTO documents (id, name, cstu_status, is_published, is_deleted) "
                                   "VALUES (1, 'Old MOU', 'review', false, false)")
        with Operations(MigrationContext.configure(connection)).batch_alter_table("documents") as batch:
            batch.drop_constraint("ck_documents_renewal_decision", type_="check")
            for name in NEW:
                batch.drop_column(name)
    assert not NEW & {c["name"] for c in inspect(engine).get_columns("documents")}

    migrate_v4_7.migrate(engine)
    migrate_v4_7.migrate(engine)

    assert NEW <= {c["name"] for c in inspect(engine).get_columns("documents")}
    assert "ix_documents_renews_document_id" in {i["name"] for i in inspect(engine).get_indexes("documents")}
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT name FROM documents").scalar() == "Old MOU"
    engine.dispose()
