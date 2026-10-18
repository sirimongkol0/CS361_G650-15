import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

from migrate_v3 import migrate


@pytest.fixture
def migration_engine(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v3.db'}")
    yield engine
    engine.dispose()


def test_v3_migration_adds_auth_tables_and_keeps_v2_data(migration_engine):
    engine = migration_engine
    with engine.begin() as c:
        c.exec_driver_sql('CREATE TABLE partners (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, is_published BOOLEAN NOT NULL DEFAULT false)')
        c.exec_driver_sql("INSERT INTO partners (id, name, is_published) VALUES (7, 'Existing partner', true)")
    migrate(engine)
    migrate(engine)
    with engine.begin() as c:
        inspector = inspect(c)
        assert all(inspector.has_table(name) for name in ("users", "revoked_tokens", "audit_logs"))
        assert "ck_users_role" in {x["name"] for x in inspector.get_check_constraints("users")}
        user_fks = inspector.get_foreign_keys("partners")
        assert any(fk["referred_table"] == "users" and fk["constrained_columns"] == ["owner_user_id"]
                   for fk in user_fks)
        assert c.execute(text("SELECT name FROM partners WHERE id=7")).scalar_one() == "Existing partner"
        c.execute(text("INSERT INTO users (id, cognito_sub, email, role, created_at) "
                       "VALUES (1, 'sub-1', 'staff@example.test', 'staff', CURRENT_TIMESTAMP)"))
        assert c.execute(text("SELECT is_active FROM users")).scalar_one() == True  # noqa: E712
    migrate(engine)
    with engine.begin() as c:
        assert c.execute(text("SELECT count(*) FROM users")).scalar_one() == 1


@pytest.mark.parametrize("role", ["superuser", "Staff"])
def test_users_role_is_constrained(migration_engine, role):
    migrate(migration_engine)
    with pytest.raises(IntegrityError):
        with migration_engine.begin() as c:
            c.execute(text("INSERT INTO users (cognito_sub, email, role, created_at) "
                           "VALUES ('sub', 'x@example.test', :role, CURRENT_TIMESTAMP)"), {"role": role})


def test_v3_4_migration_creates_exchange_table_on_fresh_database(
    migration_engine,
):
    engine = migration_engine

    migrate(engine)
    migrate(engine)

    inspector = inspect(engine)

    assert inspector.has_table("activities")
    assert inspector.has_table("exchange_students")

    activity_columns = {
        column["name"]: column
        for column in inspector.get_columns("activities")
    }
    assert "owner_user_id" in activity_columns
    assert "is_deleted" in activity_columns

    exchange_columns = {
        column["name"]
        for column in inspector.get_columns("exchange_students")
    }
    assert {"user_id", "owner_user_id"} <= exchange_columns

    exchange_fks = inspector.get_foreign_keys("exchange_students")
    assert any(
        fk["constrained_columns"] == ["user_id"]
        and fk["referred_table"] == "users"
        for fk in exchange_fks
    )


def test_v3_4_migration_preserves_existing_exchange_rows(
    migration_engine,
):
    engine = migration_engine

    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE exchange_students (
                id INTEGER PRIMARY KEY,
                name VARCHAR NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO exchange_students (id, name)
            VALUES (42, 'Existing exchange record')
            """
        )

    migrate(engine)
    migrate(engine)

    inspector = inspect(engine)
    columns = {
        column["name"]
        for column in inspector.get_columns("exchange_students")
    }

    assert {"id", "name", "user_id", "owner_user_id"} <= columns

    with engine.connect() as connection:
        row = connection.execute(
            text(
                """
                SELECT id, name, user_id, owner_user_id
                FROM exchange_students
                WHERE id = 42
                """
            )
        ).one()

    assert row.id == 42
    assert row.name == "Existing exchange record"
    assert row.user_id is None
    assert row.owner_user_id is None


def test_v3_3_migration_keeps_published_documents_public(migration_engine):
    engine = migration_engine
    with engine.begin() as c:
        c.exec_driver_sql("CREATE TABLE documents (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, "
                          "is_published BOOLEAN NOT NULL DEFAULT false)")
        c.exec_driver_sql("INSERT INTO documents (id, name, is_published) VALUES "
                          "(1, 'Published MoU', true), (2, 'Draft MoU', false)")
    migrate(engine)
    with engine.begin() as c:
        rows = dict(c.execute(text("SELECT id, cstu_status FROM documents")).all())
        assert rows == {1: "keep", 2: "review"}
        assert c.execute(text("SELECT count(*) FROM documents WHERE is_deleted")).scalar_one() == 0
        # A later staff decision must survive re-running the migration.
        c.execute(text("UPDATE documents SET cstu_status = 'out_of_scope' WHERE id = 1"))
    migrate(engine)
    inspector = inspect(engine)
    assert any(fk["constrained_columns"] == ["owner_user_id"] and fk["referred_table"] == "users"
               for fk in inspector.get_foreign_keys("documents"))
    with engine.connect() as c:
        assert c.execute(text("SELECT cstu_status FROM documents WHERE id = 1")).scalar_one() == "out_of_scope"
