"""V4-6 (#99): improvements recorded from feedback (PDCA), their API, and the report figures."""
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError

import models
from database import Base
import migrate_v4_6


# --- schema / migration ------------------------------------------------------

def test_migration_adds_tables_and_runs_twice(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'v46.db'}")
    try:
        existing = [t for t in Base.metadata.sorted_tables if t.name not in migrate_v4_6.V4_6_TABLES]
        Base.metadata.create_all(engine, tables=existing)
        migrate_v4_6.migrate(engine)
        migrate_v4_6.migrate(engine)
        names = set(inspect(engine).get_table_names())
        assert set(migrate_v4_6.V4_6_TABLES) <= names
    finally:
        engine.dispose()


def _feedback(db_session, title="f"):
    partner = models.Partner(name=f"P {title}", type="university")
    db_session.add(partner)
    db_session.flush()
    row = models.Feedback(title=title, partner_id=partner.id, status="pending")
    db_session.add(row)
    db_session.flush()
    return row


def test_improvement_status_is_constrained(db_session):
    db_session.add(models.Improvement(title="x", status="maybe", created_at=datetime.now(timezone.utc)))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_deleting_feedback_removes_only_the_link(db_session):
    feedback = _feedback(db_session)
    improvement = models.Improvement(title="Revise course", status="done", created_at=datetime.now(timezone.utc),
                                     feedbacks=[feedback])
    db_session.add(improvement)
    db_session.commit()
    db_session.delete(feedback)
    db_session.commit()
    db_session.refresh(improvement)
    assert improvement.feedbacks == []
    assert db_session.get(models.Improvement, improvement.id) is not None
