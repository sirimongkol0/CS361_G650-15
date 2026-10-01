"""Verification for schema rules and the consistency of the test dataset."""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

import models
from database import Base, SessionLocal, engine
from tests.sample_data import add_sample_data


@pytest.fixture(scope="function", autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_sample_data_is_internally_consistent():
    session = SessionLocal()
    try:
        add_sample_data(session)
        today = date(2026, 10, 1)
        for document in session.query(models.Document):
            expected = "expired" if document.expiry_date < today else "active"
            assert document.status == expected, document.name
        for activity in session.query(models.Activity):
            assert activity.partner is not None
            agreement = activity.mou_document
            if agreement is not None:
                assert agreement.partner_id == activity.partner_id
                assert agreement.effective_date <= activity.date <= agreement.expiry_date
        feedback = session.query(models.Feedback).one()
        assert feedback.activity.partner_id == feedback.partner_id
    finally:
        session.close()


def test_natural_keys_and_domain_checks_are_enforced():
    session = SessionLocal()
    try:
        session.add(models.Partner(name="Unique partner", is_published=True))
        session.commit()

        session.add(models.Partner(name="Unique partner", is_published=False))
        session.commit()  # V2 permits stakeholders with the same name.

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
