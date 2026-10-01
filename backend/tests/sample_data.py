"""Small synthetic dataset for automated tests and the disposable E2E database.

Test-only: nothing here is loaded into an application database. Values are
internally consistent (document status matches its expiry date, activities
fall inside the linked agreement period, enums match frontend/src/lib/labels.ts).
"""

from datetime import date, datetime, timezone
from pathlib import Path

import models
import storage

SAMPLE_PDF = Path(__file__).resolve().parents[1] / "fixtures" / "v2-sample.pdf"
CHECKED_AT = datetime(2026, 10, 1, tzinfo=timezone.utc)
UPLOADED_AT = datetime(2026, 10, 1)

PARTNERS = [
    {"key": "a", "name": "มหาวิทยาลัยตัวอย่าง A", "type": "university",
     "country": "Thailand", "country_code": "TH"},
    {"key": "b", "name": "บริษัทตัวอย่าง B จำกัด", "type": "private_company",
     "country": "Thailand", "country_code": "TH"},
    {"key": "c", "name": "Sample University C", "type": "university",
     "country": "Japan", "country_code": "JP"},
]

DOCUMENTS = [
    {"key": "a", "name": "MoU ตัวอย่าง A", "doc_type": "mou", "partner": "a",
     "effective_date": date(2025, 1, 1), "expiry_date": date(2030, 12, 31), "status": "active",
     "responsible": "ผู้รับผิดชอบตัวอย่าง", "signer_our": "ผู้ลงนามฝ่ายเรา", "signer_partner": "ผู้ลงนามหน่วยงาน",
     "scope": ["การแลกเปลี่ยนนักศึกษา", "การวิจัยร่วม"]},
    {"key": "b", "name": "MoA ตัวอย่าง B", "doc_type": "moa", "partner": "b",
     "effective_date": date(2023, 1, 1), "expiry_date": date(2024, 12, 31), "status": "expired"},
    {"key": "c", "name": "MoU ตัวอย่าง C", "doc_type": "mou", "partner": "c",
     "effective_date": date(2026, 1, 1), "expiry_date": date(2031, 12, 31), "status": "active"},
]

ACTIVITIES = [
    {"name": "สัมมนาความร่วมมือ A", "activity_type": "seminar", "partner": "a", "document": "a",
     "date": date(2025, 6, 10), "status": "เสร็จสิ้น", "participants": 40},
    {"name": "พิธีลงนาม MoA ตัวอย่าง B", "activity_type": "official_event", "partner": "b", "document": "b",
     "date": date(2023, 1, 1), "status": "เสร็จสิ้น"},
    {"name": "ประชุมความร่วมมือ C", "activity_type": "collaboration_meeting", "partner": "c", "document": None,
     "date": date(2026, 3, 5), "status": "เสร็จสิ้น"},
]


def _source(label):
    return models.Source(
        source_url=f"https://pcsms-test.example.test/{label}",
        source_title="Synthetic test fixture (not an official source)",
        source_type="test_fixture", verification_status="verified", source_checked_at=CHECKED_AT,
    )


def add_sample_data(session):
    """Insert the dataset, store its PDFs and return the created rows by kind and key."""
    sample = SAMPLE_PDF.read_bytes()
    partners = {}
    for row in PARTNERS:
        partners[row["key"]] = models.Partner(
            name=row["name"], type=row["type"], country=row["country"], country_code=row["country_code"],
            description="Synthetic test record.", website_url=f"https://pcsms-test.example.test/partners/{row['key']}",
            is_published=True, sources=[_source(f"partners/{row['key']}")],
        )
    documents = {}
    for row in DOCUMENTS:
        key = f"sample/agreements/{row['key']}.pdf"
        storage.put_file(key, sample)
        documents[row["key"]] = models.Document(
            name=row["name"], doc_type=row["doc_type"], document_kind="agreement",
            file_availability="available", storage_key=key, file_name=f"{row['key']}.pdf",
            mime_type="application/pdf", size_bytes=len(sample), uploaded_at=UPLOADED_AT,
            partner=partners[row["partner"]], effective_date=row["effective_date"],
            expiry_date=row["expiry_date"], status=row["status"], responsible=row.get("responsible"),
            signer_our=row.get("signer_our"), signer_partner=row.get("signer_partner"),
            is_published=True, sources=[_source(f"documents/{row['key']}")],
            scope_items=[models.DocumentScopeItem(position=i, text=text)
                         for i, text in enumerate(row.get("scope", []))],
        )
    activities = [
        models.Activity(
            name=row["name"], activity_type=row["activity_type"], partner=partners[row["partner"]],
            mou_document=documents[row["document"]] if row["document"] else None,
            date=row["date"], date_kind="event", date_precision="day", status=row["status"],
            participants=row.get("participants"), is_published=True,
            sources=[_source(f"activities/{index}")],
        )
        for index, row in enumerate(ACTIVITIES)
    ]
    feedback = models.Feedback(
        title="ความพึงพอใจสัมมนาความร่วมมือ A", source="ผู้เข้าร่วมกิจกรรม", rating=5,
        date=date(2025, 6, 11), status="ตรวจสอบแล้ว", comment="Synthetic test comment.",
        is_published=True, partner=partners["a"], activity=activities[0],
    )
    exchange = models.ExchangeStudent(
        name="นักศึกษาตัวอย่าง", type="outbound", from_program="หลักสูตรตัวอย่าง",
        to_organization=PARTNERS[2]["name"], start_date=date(2026, 6, 1), end_date=date(2026, 9, 30),
        program="Student Exchange", status="เสร็จสิ้น", is_published=True, partner=partners["c"],
    )
    session.add_all([*partners.values(), *documents.values(), *activities, feedback, exchange])
    session.commit()
    return {"partners": partners, "documents": documents, "activities": activities}
