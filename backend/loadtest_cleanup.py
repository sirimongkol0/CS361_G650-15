"""Remove every [LT] load-test row from the demo database.

Deletes, in FK-safe order:
  feedback -> outcome -> audit log -> document scope item -> activity ->
  document -> partner

The write load test creates feedback rows titled "[LT] locust-..."; those are
removed by title prefix, even if they point at non-LT records.

Run inside the backend container:
    docker exec cs361-backend python loadtest_cleanup.py

For a completely clean database, restoring the pre-test backup is still the
safest option:
    ./deploy.sh restore <backup-key> --yes
"""

from __future__ import annotations

import sys

from sqlalchemy import or_

import models
from database import SessionLocal, engine

PREFIX = "[LT] "


def _check_database() -> None:
    if engine.url.get_backend_name() != "postgresql" or engine.url.database != "cstu_demo":
        sys.exit(
            "Refusing to clean: DATABASE_URL must be PostgreSQL database cstu_demo "
            f"(got {engine.url.get_backend_name()}:{engine.url.database})"
        )


def main() -> None:
    _check_database()
    with SessionLocal() as db:
        partner_ids = [
            row[0]
            for row in db.query(models.Partner.id)
            .filter(models.Partner.name.like(PREFIX + "%"))
            .all()
        ]
        document_ids = [
            row[0]
            for row in db.query(models.Document.id)
            .filter(models.Document.name.like(PREFIX + "%"))
            .all()
        ]
        activity_ids = [
            row[0]
            for row in db.query(models.Activity.id)
            .filter(models.Activity.name.like(PREFIX + "%"))
            .all()
        ]

        feedback_filters = [models.Feedback.title.like(PREFIX + "%")]
        if partner_ids:
            feedback_filters.append(models.Feedback.partner_id.in_(partner_ids))
        if document_ids:
            feedback_filters.append(models.Feedback.document_id.in_(document_ids))
        if activity_ids:
            feedback_filters.append(models.Feedback.activity_id.in_(activity_ids))
        feedback_ids = [
            row[0]
            for row in db.query(models.Feedback.id)
            .filter(or_(*feedback_filters))
            .all()
        ]

        outcome_filters = []
        if partner_ids:
            outcome_filters.append(models.Outcome.partner_id.in_(partner_ids))
        if document_ids:
            outcome_filters.append(models.Outcome.document_id.in_(document_ids))
        if activity_ids:
            outcome_filters.append(models.Outcome.activity_id.in_(activity_ids))

        counts = {
            "feedback": 0,
            "outcome": 0,
            "audit": 0,
            "scope_item": 0,
            "activity": 0,
            "document": 0,
            "partner": 0,
        }

        if feedback_ids:
            db.execute(
                models.feedback_improvements.delete().where(
                    models.feedback_improvements.c.feedback_id.in_(feedback_ids)
                )
            )
            counts["feedback"] = (
                db.query(models.Feedback)
                .filter(models.Feedback.id.in_(feedback_ids))
                .delete(synchronize_session=False)
            )

        if outcome_filters:
            counts["outcome"] = (
                db.query(models.Outcome)
                .filter(or_(*outcome_filters))
                .delete(synchronize_session=False)
            )

        for entity, ids in (
            ("feedbacks", feedback_ids),
            ("partners", partner_ids),
            ("documents", document_ids),
            ("activities", activity_ids),
        ):
            if ids:
                counts["audit"] += (
                    db.query(models.AuditLog)
                    .filter(
                        models.AuditLog.entity == entity,
                        models.AuditLog.entity_id.in_(ids),
                    )
                    .delete(synchronize_session=False)
                )

        if document_ids:
            counts["scope_item"] = (
                db.query(models.DocumentScopeItem)
                .filter(models.DocumentScopeItem.document_id.in_(document_ids))
                .delete(synchronize_session=False)
            )

        counts["activity"] = (
            db.query(models.Activity)
            .filter(models.Activity.name.like(PREFIX + "%"))
            .delete(synchronize_session=False)
        )
        if document_ids:
            counts["document"] = (
                db.query(models.Document)
                .filter(models.Document.id.in_(document_ids))
                .delete(synchronize_session=False)
            )
        if partner_ids:
            counts["partner"] = (
                db.query(models.Partner)
                .filter(models.Partner.id.in_(partner_ids))
                .delete(synchronize_session=False)
            )

        db.commit()

    print("Removed load-test rows:")
    for name, value in counts.items():
        print(f"  {name:12} {value}")


if __name__ == "__main__":
    main()
