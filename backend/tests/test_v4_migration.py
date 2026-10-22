"""V4-1 (#86): schema for outcomes, multi-source feedback, lookup types and import batches."""
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

import models
from migrate_v4 import migrate


@pytest.fixture
def engine(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v4.db'}")
    yield engine
    engine.dispose()


def _v3_feedback_table(engine):
    """A pre-V4 feedbacks table with a unique title and free-text source."""
    with engine.begin() as c:
        c.exec_driver_sql("CREATE TABLE partners (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, "
                          "is_published BOOLEAN NOT NULL DEFAULT false)")
        c.exec_driver_sql("CREATE TABLE activities (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, "
                          "is_published BOOLEAN NOT NULL DEFAULT false)")
        c.exec_driver_sql("CREATE TABLE feedbacks (id INTEGER PRIMARY KEY, title VARCHAR NOT NULL, "
                          "source VARCHAR, rating INTEGER, date DATE, status VARCHAR, comment VARCHAR, "
                          "is_published BOOLEAN NOT NULL, partner_id INTEGER REFERENCES partners (id), "
                          "activity_id INTEGER REFERENCES activities (id))")
        c.exec_driver_sql("CREATE UNIQUE INDEX ix_feedbacks_title ON feedbacks (title)")
        c.exec_driver_sql("INSERT INTO partners (id, name) VALUES (1, 'Partner')")
        c.exec_driver_sql("INSERT INTO activities (id, name) VALUES (2, 'Seminar')")
        c.exec_driver_sql("INSERT INTO feedbacks (id, title, source, is_published, activity_id) "
                          "VALUES (1, 'A', 'alumni', true, 2), (2, 'B', 'coop_system', false, NULL), "
                          "(3, 'C', 'ผู้เข้าร่วมกิจกรรม', true, NULL)")
        c.exec_driver_sql("UPDATE feedbacks SET partner_id = 1 WHERE id = 3")


def test_migration_keeps_feedback_and_maps_legacy_source(engine):
    _v3_feedback_table(engine)
    migrate(engine)
    migrate(engine)  # repeatable
    with engine.begin() as c:
        rows = c.execute(text(
            "SELECT f.id, r.code, s.code, f.is_legacy FROM feedbacks f "
            "LEFT JOIN respondent_types r ON r.id = f.respondent_type_id "
            "JOIN feedback_sources s ON s.id = f.feedback_source_id ORDER BY f.id")).fetchall()
    assert [tuple(r) for r in rows] == [
        (1, "alumni", "manual_entry", 0),
        (2, None, "coop_system", 1),       # no context -> legacy, kept
        (3, "participant", "manual_entry", 0),
    ]


def test_migration_creates_tables_seeds_and_relaxes_title(engine):
    _v3_feedback_table(engine)
    migrate(engine)
    with engine.begin() as c:
        inspector = inspect(c)
        for table in ("outcomes", "outcome_types", "respondent_types", "feedback_sources", "import_batches"):
            assert inspector.has_table(table)
        assert c.execute(text("SELECT count(*) FROM outcome_types")).scalar_one() == len(models.LOOKUP_SEEDS["outcome_types"])
        c.execute(text("INSERT INTO feedbacks (title, is_published, activity_id) VALUES ('A', false, 2)"))
        assert c.execute(text("SELECT count(*) FROM feedbacks WHERE title = 'A'")).scalar_one() == 2


def test_migration_keeps_admin_added_types(engine):
    migrate(engine)
    with engine.begin() as c:
        c.execute(text("INSERT INTO respondent_types (code, name_th, is_active, sort_order) "
                       "VALUES ('employer', 'นายจ้าง', true, 99)"))
    migrate(engine)
    with engine.begin() as c:
        codes = {r[0] for r in c.execute(text("SELECT code FROM respondent_types"))}
    assert "employer" in codes and "alumni" in codes


def test_new_feedback_without_context_is_rejected(engine):
    migrate(engine)
    with engine.begin() as c, pytest.raises(IntegrityError):
        c.execute(text("INSERT INTO feedbacks (title, is_published) VALUES ('No context', false)"))


def test_duplicate_external_id_from_same_source_is_rejected(engine):
    _v3_feedback_table(engine)
    migrate(engine)
    insert = text("INSERT INTO feedbacks (title, is_published, activity_id, feedback_source_id, external_id) "
                  "VALUES ('x', false, 2, :source, 'COOP-1')")
    with engine.begin() as c:
        coop, web = (c.execute(text(f"SELECT id FROM feedback_sources WHERE code = '{code}'")).scalar_one()
                     for code in ("coop_system", "web_form"))
        c.execute(insert, {"source": coop})
        c.execute(insert, {"source": web})  # same id from another source is fine
    with engine.begin() as c, pytest.raises(IntegrityError):
        c.execute(insert, {"source": coop})


def test_outcome_needs_context(db_session):
    kind = db_session.query(models.OutcomeType).filter_by(code="participants").one()
    db_session.add(models.Outcome(outcome_type=kind, title="Attendance", value=35))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
    db_session.add(models.Outcome(outcome_type=kind, title="Attendance", value=35,
                                  activity=models.Activity(name="Seminar")))
    db_session.commit()
    assert db_session.query(models.Outcome).one().unit is None


def test_import_batch_status_is_constrained(db_session):
    source = db_session.query(models.FeedbackSource).filter_by(code="coop_system").one()
    db_session.add(models.ImportBatch(kind="feedback", feedback_source=source, file_name="coop.csv",
                                      status="done", created_at=datetime.now(timezone.utc)))
    with pytest.raises(IntegrityError):
        db_session.commit()
