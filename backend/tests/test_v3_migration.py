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
