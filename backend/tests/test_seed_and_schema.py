"""Verification for repeatable schema setup and idempotent development seed."""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

import models
import seed_mock
from database import Base, SessionLocal, engine


@pytest.fixture(scope="function", autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _counts(session):
    return {
        "partners": session.query(models.Partner).count(),
        "documents": session.query(models.Document).count(),
        "activities": session.query(models.Activity).count(),
        "feedbacks": session.query(models.Feedback).count(),
        "exchange_students": session.query(models.ExchangeStudent).count(),
        "admin_profiles": session.query(models.AdminProfile).count(),
        "scope_items": session.query(models.DocumentScopeItem).count(),
        "timeline_steps": session.query(models.DocumentTimelineStep).count(),
    }


def test_mock_seed_is_idempotent_and_relationships_resolve():
    session = SessionLocal()
    try:
        seed_mock.seed(session)
        first = _counts(session)
        seed_mock.seed(session)
        second = _counts(session)

        assert second == first
        assert first == {
            "partners": len(seed_mock.PARTNERS),
            "documents": len(seed_mock.DOCUMENTS),
            "activities": len(seed_mock.ACTIVITIES),
            "feedbacks": len(seed_mock.FEEDBACKS),
            "exchange_students": len(seed_mock.EXCHANGE_STUDENTS),
            "admin_profiles": 1,
            "scope_items": len(seed_mock.DOCUMENT_1_SCOPE),
            "timeline_steps": len(seed_mock.DOCUMENT_1_TIMELINE),
        }

        assert all(activity.partner is not None for activity in session.query(models.Activity))
        assert all(document.partner is not None for document in session.query(models.Document))
        feedback_by_title = {
            feedback.title: feedback for feedback in session.query(models.Feedback)
        }
        seeded_activity_names = {row["name"] for row in seed_mock.ACTIVITIES}
        for row in seed_mock.FEEDBACKS:
            feedback = feedback_by_title[row["title"]]
            assert (feedback.partner is not None) == (row["partner"] is not None)
            expected_activity_link = row["activity"] in seeded_activity_names
            assert (feedback.activity is not None) == expected_activity_link
    finally:
        session.close()


def test_natural_keys_and_domain_checks_are_enforced():
    session = SessionLocal()
    try:
        session.add(models.Partner(name="Unique partner", is_published=True))
        session.commit()

        session.add(models.Partner(name="Unique partner", is_published=False))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        session.add(
            models.Activity(
                name="Invalid period",
                date=date(2026, 2, 2),
                end_date=date(2026, 2, 1),
                is_published=True,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        session.add(models.Feedback(title="Invalid rating", rating=6))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
    finally:
        session.close()
