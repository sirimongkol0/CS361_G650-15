import pytest
from sqlalchemy import MetaData, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

from database import Base, engine as configured_engine
from migrate_v3 import migrate


@pytest.fixture(params=["sqlite", "configured"])
def migration_engine(request, tmp_path):
    if request.param == "configured":
        if configured_engine.dialect.name == "sqlite":
            pytest.skip("Covered by the SQLite migration case")
        engine = configured_engine
        Base.metadata.drop_all(engine)
    else:
        engine = create_engine(f"sqlite:///{tmp_path / 'v2.db'}")
    yield engine
    metadata = MetaData()
    metadata.reflect(engine)
    metadata.drop_all(engine)
    if request.param == "sqlite":
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
        assert inspector.has_table("users") and inspector.has_table("revoked_tokens")
        assert "ck_users_role" in {x["name"] for x in inspector.get_check_constraints("users")}
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
