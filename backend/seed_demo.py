"""Seed an isolated, persistent fictional CSTU demo. Never target real data.

Run through docker-compose.demo.yml. No record is deleted or overwritten.
All identities, contact details, citations and agreements are fictional.
"""
from datetime import date, datetime, timezone
from pathlib import Path
import hashlib
import json

from sqlalchemy import text

from database import Base, SessionLocal, engine
from migrate_v2 import migrate
import models
import storage
import demo_expansion
from demo_content import PARTNER_DETAILS, DOCUMENT_DETAILS, partner_description, activity_description

VERSION = "cstu-fictional-v2"
PARTNERS = [
    ("มหาวิทยาลัยรุ่งอรุณวิทยา", "university", "Thailand", "TH"),
    ("Sakuragaoka Institute of Technology", "university", "Japan", "JP"),
    ("บริษัท โค้ดช่างฝีมือ จำกัด (CodeCraft Studio)", "private_company", "Thailand", "TH"),
    ("บริษัท สะพานข้อมูล อนาไลติกส์ จำกัด", "private_company", "Thailand", "TH"),
    ("สถาบันวิจัยนวัตกรรมดิจิทัลแม่โขง", "government", "Thailand", "TH"),
    ("สมาคมนักพัฒนาซอฟต์แวร์สยาม", "network", "Thailand", "TH"),
    ("คุณภูมิ ไบต์ทอง (ศิษย์เก่ารุ่น 12)", "alumni", "Thailand", "TH"),
    ("คุณพลอย เทสต์สุข (ศิษย์เก่ารุ่น 15)", "alumni", "Thailand", "TH"),
    ("ดร.ปัญญา ประดิษฐ์กุล", "expert", "Thailand", "TH"),
    ("Dr. Lin Firewall-Tan", "expert", "Singapore", "SG"),
    ("Asia Pacific Learning Alliance (APLA)", "international_organization", "Singapore", "SG"),
    ("บริษัท ม่านหมอก ซอฟต์แวร์ จำกัด", "private_company", "Thailand", "TH"),
]
# name, partner index, type, status, start, end, file state, published
DOCUMENTS = [
    ("MoU แลกเปลี่ยนนักศึกษา รุ่งอรุณวิทยา", 0, "mou", "active", "2025-01-01", "2028-12-31", "available", True),
    ("MoU วิจัยร่วม NLP กับ Sakuragaoka", 1, "mou", "expiring", "2024-01-01", "2026-11-30", "available", True),
    ("MoA ฝึกงานนักพัฒนา CodeCraft Studio", 2, "moa", "active", "2026-01-01", "2029-12-31", "available", True),
    ("MoA โครงการ Dashboard สะพานข้อมูล (รุ่นแรก)", 3, "moa", "expired", "2022-01-01", "2024-12-31", "available", True),
    ("MoU คุณภาพข้อมูลกับสถาบันแม่โขง", 4, "mou", "active", "2025-01-01", "2028-12-31", "metadata_only", True),
    ("MoU เครือข่ายสมาคมนักพัฒนาสยาม", 5, "mou", "active", "2026-01-01", "2028-12-31", "unavailable", True),
    ("MoU ม่านหมอก (ฉบับร่างภายใน)", 11, "mou", "draft", None, None, "available", False),
    ("แบบฟอร์มเตรียมข้อตกลงความร่วมมือ", 0, "template", None, None, None, "available", True),
]
# name, partner index, optional document index, date, type, status, participants
ACTIVITIES = [
    ("ปฐมนิเทศนักศึกษาแลกเปลี่ยน รุ่งอรุณ รุ่น 1", 0, 0, "2026-08-10", "exchange", "เสร็จสิ้น", 20),
    ("บุกแล็บ NLP ที่ Sakuragaoka", 1, 1, "2026-07-15", "academic_visit", "เสร็จสิ้น", 12),
    ("Bootcamp ก่อนฝึกงาน CodeCraft", 2, 2, "2026-09-12", "student_workshop_competition", "เสร็จสิ้น", 35),
    ("Demo Day โครงการสะพานข้อมูล", 3, 3, "2024-06-20", "collaboration_meeting", "เสร็จสิ้น", 15),
    ("อบรม Data Quality & Research Ethics", 4, 4, "2026-06-08", "seminar", "เสร็จสิ้น", 45),
    ("วงคุยสมาคมนักพัฒนาซอฟต์แวร์สยาม", 5, None, "2026-05-22", "collaboration_meeting", "เสร็จสิ้น", 18),
    ("รุ่นพี่เล่า: เส้นทางสายซอฟต์แวร์", 6, None, "2026-08-25", "seminar", "เสร็จสิ้น", 80),
    ("ศิษย์เก่ารีวิวหลักสูตร: Testing ต้องมา", 7, None, "2026-09-05", "collaboration_meeting", "เสร็จสิ้น", 10),
    ("AI Talk: โมเดลเก่งแค่ไหนต้องวัดให้เป็น", 8, None, "2026-10-20", "seminar", "วางแผน", None),
    ("Security Talk: ออกแบบสิทธิ์ไม่ให้รั่ว", 9, None, "2026-11-12", "seminar", "วางแผน", None),
    ("APLA Learning Summit 2026", 10, None, "2026-12-01", "international_conference", "วางแผน", None),
    ("Check-in กลางฝึกงาน CodeCraft", 2, 2, "2026-10-01", "collaboration_meeting", "กำลังดำเนินการ", 35),
    ("ประชุมลับเตรียมความร่วมมือม่านหมอก", 11, 6, "2026-10-15", "collaboration_meeting", "วางแผน", None),
    ("เปิดรับสมัครแลกเปลี่ยน รุ่งอรุณ รุ่น 2", 0, 0, "2026-10-10", "exchange", "วางแผน", None),
    ("กิจกรรมศิษย์เก่าในตำนาน (ไม่ทราบวัน)", 6, None, None, "student_activity", None, None),
]


def enrich(db, partners, documents, activities):
    manifest = json.loads((Path(__file__).parent / 'fixtures/demo-documents/manifest.json').read_text(encoding='utf-8'))
    for i, partner in enumerate(partners):
        partner.description = partner_description(i)
        partner.contact_name = PARTNER_DETAILS[i][3]
    for i, document in enumerate(documents):
        document.responsible = PARTNER_DETAILS[DOCUMENTS[i][1]][3]
        document.scope_items = [models.DocumentScopeItem(position=position, text=f'{title}: {detail}')
                                for position, (title, detail) in enumerate(DOCUMENT_DETAILS[i])]
        if str(i) in manifest:
            item = manifest[str(i)]
            data = (Path(__file__).parent / 'fixtures/demo-documents' / item['file']).read_bytes()
            if hashlib.sha256(data).hexdigest() != item['sha256']:
                raise RuntimeError('Packaged demo PDF hash mismatch')
            key = f"cstu-demo/v2/{item['sha256']}/{item['file']}"
            storage.put_file(key, data)
            document.storage_key = key
            document.size_bytes = len(data)
            document.file_name = f'เอกสารสมมติ-{i + 1}.pdf'
    for i, activity in enumerate(activities):
        activity.description = activity_description(i)
        activity.location = 'ห้องเรียนและพื้นที่กิจกรรมสมมติของหลักสูตร' if i != 1 else 'ห้องปฏิบัติการสมมติของ Sakuragaoka'
        activity.time = '09:00 - 16:00' if activity.date_kind == 'event' else None
    db.flush()


def seed():
    if engine.url.get_backend_name() != "postgresql" or engine.url.database != "cstu_demo":
        raise RuntimeError("Demo seeding only accepts the dedicated cstu_demo PostgreSQL database")
    if storage._get_backend_name() != "local":
        raise RuntimeError("Demo requires its own local storage volume")
    migrate(engine)
    Base.metadata.create_all(engine)
    pdf = (Path(__file__).parent / "fixtures/v2-sample.pdf").read_bytes()
    with SessionLocal() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(36120261003)"))
        db.execute(text("CREATE TABLE IF NOT EXISTS demo_seed_metadata (version TEXT PRIMARY KEY)"))
        version = db.execute(text("SELECT version FROM demo_seed_metadata")).scalar()
        counts = [db.query(m).count() for m in (models.Partner, models.Document, models.Activity)]
        expected = [len(PARTNERS), len(DOCUMENTS), len(ACTIVITIES)]
        if version == demo_expansion.VERSION:
            print(f"Demo already prepared (v3): {counts}; no records changed")
            return
        if version:
            if version not in ['cstu-fictional-v1', VERSION] or counts != expected:
                raise RuntimeError("Existing demo differs; refusing to overwrite records")
            if version == 'cstu-fictional-v1':
                groups = []
                for model, specs in [(models.Partner, PARTNERS), (models.Document, DOCUMENTS), (models.Activity, ACTIVITIES)]:
                    records = []
                    for spec in specs:
                        record = db.query(model).filter_by(name=spec[0]).one()
                        if not record.sources or any(source.source_type != 'demo_fixture' for source in record.sources):
                            raise RuntimeError('Upgrade only accepts fictional demo records')
                        records.append(record)
                    groups.append(records)
                enrich(db, *groups)
                print(f'Enriched existing fictional demo, preserving IDs and counts: {counts}')
            expand(db)
            return
        if any(counts) or db.query(models.Source).count():
            raise RuntimeError("First demo preparation requires an empty dedicated database")
        source = models.Source(
            source_url="https://cstu-demo.example.test/dataset/v1",
            source_title="ชุดข้อมูลสมมติ CSTU สำหรับสาธิต V2",
            source_publisher="ชุดสาธิตรายวิชา CS361 (ข้อมูลสมมติ)",
            source_type="demo_fixture", verification_status="verified",
            source_checked_at=datetime(2026, 10, 2, tzinfo=timezone.utc),
            source_locator="ตรวจความสอดคล้องของชุดสาธิต ไม่ใช่การรับรองข้อเท็จจริงหรือความร่วมมือจริง",
        )
        partners = []
        for i, (name, kind, country, code) in enumerate(PARTNERS):
            partner = models.Partner(
                name=name, type=kind, country=country, country_code=code,
                description="ข้อมูลสมมติสำหรับสาธิตความสัมพันธ์กับหลักสูตรวิทยาการคอมพิวเตอร์ ไม่ใช่บุคคลหรือหน่วยงานจริง",
                website_url=f"https://stakeholder-{i + 1}.example.test",
                contact_name=f"ผู้ประสานงานสมมติ {i + 1}",
                contact_email=f"contact-{i + 1}@example.test",
                contact_is_public=i % 3 != 0, is_published=i != 11,
                scope_level="program", sources=[source],
            )
            db.add(partner)
            partners.append(partner)
        documents = []
        for i, (name, p, kind, status, start, end, availability, published) in enumerate(DOCUMENTS):
            key = f"demo-v1/agreement-{i + 1}.pdf" if availability == "available" else None
            if key:
                storage.put_file(key, pdf)
            document = models.Document(
                name=name, partner=partners[p], doc_type=kind,
                document_kind="template" if kind == "template" else "agreement",
                status=status, effective_date=date.fromisoformat(start) if start else None,
                expiry_date=date.fromisoformat(end) if end else None,
                file_availability=availability, storage_key=key,
                file_name=f"เอกสารสมมติ-{i + 1}.pdf" if key else None,
                mime_type="application/pdf" if key else None, size_bytes=len(pdf) if key else None,
                responsible="ผู้รับผิดชอบสมมติ", signer_our="ผู้ลงนามฝ่ายหลักสูตรสมมติ",
                signer_partner="ผู้ลงนามฝ่ายคู่ความร่วมมือสมมติ", scope_level="program",
                is_published=published, sources=[source],
                scope_items=[models.DocumentScopeItem(position=0, text="สาธิตความร่วมมือด้านการศึกษาและการพัฒนานักศึกษา")],
            )
            db.add(document)
            documents.append(document)
        activities = []
        for i, (name, p, doc, when, kind, status, participants) in enumerate(ACTIVITIES):
            activity = models.Activity(
                name=name, partner=partners[p], mou_document=documents[doc] if doc is not None else None,
                date=date.fromisoformat(when) if when else None,
                date_kind="application_open" if i == 13 else "event" if when else None,
                date_precision="day" if when else None, activity_type=kind,
                description="กิจกรรมสมมติสำหรับสาธิตระบบ ไม่ใช่กิจกรรมที่เกิดขึ้นจริง ข้อมูลผู้เข้าร่วมและสถานะเป็นตัวอย่าง",
                status=status, participants=participants, is_open=True if i == 13 else None,
                location="สถานที่สมมติ", is_published=i != 12, scope_level="program", sources=[source],
            )
            db.add(activity)
            activities.append(activity)
        db.flush()
        enrich(db, partners, documents, activities)
        db.execute(text("INSERT INTO demo_seed_metadata(version) VALUES (:version)"), {"version": VERSION})
        print(f"Prepared fictional demo: {expected}; real CSTU records untouched")
        expand(db)


def expand(db):
    """Add the v3 fictional records on top of a complete base demo, then commit."""
    source = db.query(models.Source).filter_by(source_type="demo_fixture").one()
    if db.query(models.Feedback).count() or db.query(models.ExchangeStudent).count():
        raise RuntimeError("Expansion expects no feedback/exchange rows; refusing to add duplicates")
    added = demo_expansion.expand(db, source)
    db.execute(text("UPDATE demo_seed_metadata SET version=:version"), {"version": demo_expansion.VERSION})
    db.commit()
    print(f"Expanded fictional demo with partners/documents/activities {added}, 45 feedbacks, 30 exchange students")


if __name__ == "__main__":
    seed()
