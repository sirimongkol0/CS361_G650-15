import pytest
from sqlalchemy import MetaData, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from database import Base, engine as configured_engine

from migrate_v2 import migrate


@pytest.fixture(params=["sqlite", "configured"])
def migration_engine(request, tmp_path):
    if request.param == "configured":
        if configured_engine.dialect.name == "sqlite":
            pytest.skip("Covered by the SQLite migration case")
        engine = configured_engine
        Base.metadata.drop_all(engine)
    else:
        engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    yield engine
    metadata = MetaData()
    metadata.reflect(engine)
    metadata.drop_all(engine)
    if request.param == "sqlite":
        engine.dispose()


def test_migrate_preserves_rows_and_can_repeat(migration_engine):
    engine = migration_engine
    with engine.begin() as c:
        def ddl(sql):
            if engine.dialect.name == "postgresql":
                sql = sql.replace("id INTEGER PRIMARY KEY", "id SERIAL PRIMARY KEY")
            c.exec_driver_sql(sql)
        ddl('CREATE TABLE partners (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL UNIQUE, is_published BOOLEAN)')
        c.exec_driver_sql("INSERT INTO partners VALUES (7, 'Partner', NULL)")
        ddl('CREATE TABLE documents (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL UNIQUE, storage_key VARCHAR NOT NULL UNIQUE, mime_type VARCHAR NOT NULL, partner_id INTEGER REFERENCES partners(id), is_published BOOLEAN NOT NULL)')
        c.exec_driver_sql("INSERT INTO documents VALUES (8, 'Agreement', 'original.pdf', 'application/pdf', 7, true)")
        ddl('CREATE TABLE document_scope_items (id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id), position INTEGER NOT NULL, text VARCHAR NOT NULL, UNIQUE(document_id, position))')
        c.exec_driver_sql("INSERT INTO document_scope_items VALUES (9, 8, 0, 'Cooperation')")
        ddl('CREATE TABLE document_timeline_steps (id INTEGER PRIMARY KEY, document_id INTEGER REFERENCES documents(id))')
        c.exec_driver_sql('INSERT INTO document_timeline_steps VALUES (1, 8)')
        ddl('CREATE TABLE unrelated (id INTEGER PRIMARY KEY, partner_id INTEGER REFERENCES partners(id))')
        c.exec_driver_sql('INSERT INTO unrelated VALUES (1, 7)')
    migrate(engine)
    migrate(engine)
    with engine.begin() as c:
        assert not inspect(c).has_table('document_timeline_steps')
        assert c.execute(text('SELECT partner_id FROM documents WHERE id=8')).scalar_one() == 7
        assert c.execute(text('SELECT text FROM document_scope_items WHERE id=9')).scalar_one() == 'Cooperation'
        assert c.execute(text('SELECT partner_id FROM unrelated')).scalar_one() == 7
        assert c.execute(text('SELECT is_published FROM partners WHERE id=7')).scalar_one() == 0
        assert c.execute(text('SELECT contact_is_public FROM partners WHERE id=7')).scalar_one() == 0
        c.execute(text("INSERT INTO partners (name) VALUES ('Partner')"))
        c.execute(text("INSERT INTO documents (name) VALUES ('Agreement')"))
        c.execute(text("INSERT INTO activities (name) VALUES ('Unscheduled')"))
        if engine.dialect.name == 'sqlite':
            assert c.exec_driver_sql('PRAGMA foreign_key_check').fetchall() == []
        assert c.execute(text("SELECT is_published FROM activities WHERE name='Unscheduled'")).scalar_one() == 0


def test_migration_rolls_back_on_invalid_required_data(migration_engine):
    engine = migration_engine
    with engine.begin() as c:
        c.exec_driver_sql('CREATE TABLE partners (id INTEGER PRIMARY KEY, name VARCHAR, is_published BOOLEAN DEFAULT true)')
        c.exec_driver_sql('INSERT INTO partners VALUES (1, NULL, NULL)')
        c.exec_driver_sql('CREATE TABLE document_timeline_steps (id INTEGER PRIMARY KEY)')
    with pytest.raises(IntegrityError):
        migrate(engine)
    with engine.connect() as c:
        assert inspect(c).has_table('document_timeline_steps')
        assert c.execute(text('SELECT is_published FROM partners')).scalar_one() is None
        assert {x['name'] for x in inspect(c).get_columns('partners')} == {'id','name','is_published'}


def test_migration_replaces_true_publication_default(migration_engine):
    engine = migration_engine
    with engine.begin() as c:
        c.exec_driver_sql('CREATE TABLE partners (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, is_published BOOLEAN NOT NULL DEFAULT true)')
    migrate(engine)
    with engine.begin() as c:
        c.execute(text("INSERT INTO partners (id, name) VALUES (1, 'Unpublished by default')"))
        assert c.execute(text('SELECT is_published FROM partners')).scalar_one() == False


def test_migration_adds_scope_level_column_and_constraint_idempotently(migration_engine):
    engine = migration_engine
    tables = ('partners', 'documents', 'activities')
    with engine.begin() as c:
        c.exec_driver_sql('CREATE TABLE partners (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, is_published BOOLEAN NOT NULL DEFAULT false)')
        c.exec_driver_sql("INSERT INTO partners (id, name) VALUES (1, 'Existing partner')")
        c.exec_driver_sql('CREATE TABLE documents (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, is_published BOOLEAN NOT NULL DEFAULT false)')
        c.exec_driver_sql("INSERT INTO documents (id, name) VALUES (2, 'Existing agreement')")
        c.exec_driver_sql('CREATE TABLE activities (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, is_published BOOLEAN NOT NULL DEFAULT false)')
        c.exec_driver_sql("INSERT INTO activities (id, name) VALUES (3, 'Existing activity')")
    migrate(engine)
    migrate(engine)
    with engine.begin() as c:
        inspector = inspect(c)
        for name in tables:
            columns = {col['name']: col for col in inspector.get_columns(name)}
            assert columns['scope_level']['nullable'] is True
            assert f'ck_{name}_scope_level' in {x['name'] for x in inspector.get_check_constraints(name)}
            # Existing rows stay unclassified (NULL) instead of being guessed.
            assert c.execute(text(f'SELECT scope_level FROM {name}')).scalar_one() is None
    for name in tables:
        with pytest.raises(IntegrityError):
            with engine.begin() as c:
                c.execute(text(f"INSERT INTO {name} (id, name, scope_level) VALUES (100, 'Bad level', 'department')"))
        with engine.begin() as c:
            # Legacy tables have no id sequence on PostgreSQL, so ids are explicit.
            for offset, level in enumerate(('program', 'faculty', 'university', None)):
                c.execute(text(f"INSERT INTO {name} (id, name, scope_level) VALUES (:id, 'Level {level}', :level)"), {'id': 101 + offset, 'level': level})
