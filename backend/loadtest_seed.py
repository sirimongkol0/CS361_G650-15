"""Add isolated load-test rows to the demo database.

Safety:
  * refuses to run unless DATABASE_URL points at PostgreSQL database cstu_demo
  * refuses to run if [LT] rows already exist (run loadtest_cleanup.py first)

Creates:
  * 100 partners      ([LT] Partner ...)
  * 50 documents      ([LT] Document ...)
  * 300 activities    ([LT] Activity ...)

Run inside the backend container:
    docker exec cs361-backend python loadtest_seed.py
"""

from __future__ import annotations

import sys
from datetime import date, timedelta

import models
from database import SessionLocal, engine

PREFIX = "[LT] "
PARTNERS = 100
DOCUMENTS = 50
ACTIVITIES = 300


def _check_database() -> None:
    if engine.url.get_backend_name() != "postgresql" or engine.url.database != "cstu_demo":
        sys.exit(
            "Refusing to seed: DATABASE_URL must be PostgreSQL database cstu_demo "
            f"(got {engine.url.get_backend_name()}:{engine.url.database})"
        )


def main() -> None:
    _check_database()
    with SessionLocal() as db:
        existing = (
            db.query(models.Partner).filter(models.Partner.name.like(PREFIX + "%")).count()
            + db.query(models.Document).filter(models.Document.name.like(PREFIX + "%")).count()
            + db.query(models.Activity).filter(models.Activity.name.like(PREFIX + "%")).count()
        )
        if existing:
            sys.exit(
                f"Found {existing} existing {PREFIX.strip()} rows; "
                "run loadtest_cleanup.py before seeding again."
            )

        partners = [
            models.Partner(
                name=f"{PREFIX}Partner {i:03d}",
                description="Load-test partner; safe to delete.",
                type="private_company",
                country="Thailand",
                country_code="TH",
                website_url=f"https://lt-partner-{i:03d}.example.test",
                contact_name=f"LT Contact {i:03d}",
                contact_email=f"lt-partner-{i:03d}@example.test",
                contact_is_public=False,
                is_published=True,
                scope_level="program",
            )
            for i in range(1, PARTNERS + 1)
        ]
        db.add_all(partners)
        db.flush()

        documents = [
            models.Document(
                name=f"{PREFIX}Document {i:03d}",
                partner_id=partners[(i - 1) % len(partners)].id,
                doc_type="mou",
                document_kind="agreement",
                status="active",
                file_availability="metadata_only",
                cstu_status="keep",
                is_published=True,
                scope_level="program",
                responsible="LT Seed",
            )
            for i in range(1, DOCUMENTS + 1)
        ]
        db.add_all(documents)
        db.flush()

        activities = [
            models.Activity(
                name=f"{PREFIX}Activity {i:03d}",
                partner_id=partners[(i - 1) % len(partners)].id,
                mou_document_id=documents[(i - 1) % len(documents)].id,
                date=date.today() - timedelta(days=i % 365),
                date_kind="event",
                date_precision="day",
                activity_type="seminar",
                description="Load-test activity; safe to delete.",
                status="เสร็จสิ้น",
                participants=10,
                location="Load-test venue",
                is_published=True,
                scope_level="program",
            )
            for i in range(1, ACTIVITIES + 1)
        ]
        db.add_all(activities)
        db.commit()

    print(
        f"Added {PARTNERS} partners, {DOCUMENTS} documents, "
        f"{ACTIVITIES} activities with prefix {PREFIX!r}."
    )


if __name__ == "__main__":
    main()
