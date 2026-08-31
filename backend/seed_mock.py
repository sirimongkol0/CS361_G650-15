#!/usr/bin/env python3
"""Seed the database with the frontend mock dataset (frontend/src/lib/mock.ts).

Mirrors the mock data 1:1 so the API can replace the frontend's temporary
mock file without changing the UI. Additive/idempotent: existing rows (matched
by name / title) are skipped, nothing is updated or deleted.

Safety: the real .env points at the production RDS. This script REFUSES to run
against any PostgreSQL database whose name is not "partner_activity_mock"
unless you pass --yes. Use --database-url to point somewhere else, e.g.:

    python seed_mock.py --database-url sqlite:///./mock_seed_check.db

Documents are seeded as metadata-only rows (placeholder storage keys); no file
bytes are uploaded to S3/local storage. Downloading a seeded mock document
returns 404 -- that is expected for mock data.
"""

import argparse
import os
import sys
from datetime import date

# Make backend modules importable no matter where the script is run from
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session

import models
from database import SessionLocal, Base, engine
from config import settings

# ---------------------------------------------------------------------------
# Mock data (ported from frontend/src/lib/mock.ts; B.E. 2568 -> 2025 CE)
# ---------------------------------------------------------------------------

PARTNERS = [
    # name, type (documented enum), country
    {"name": "มหาวิทยาลัยเชียงใหม่", "type": "university", "country": "ไทย"},
    {"name": "National Taiwan University", "type": "university", "country": "ไต้หวัน"},
    {"name": "University of Malaya", "type": "university", "country": "มาเลเซีย"},
    {"name": "บริษัท เทคโนโลยี จำกัด", "type": "private_company", "country": "ไทย"},
    {"name": "บริษัท ABC จำกัด", "type": "private_company", "country": "ไทย"},
    {"name": "Waseda University", "type": "university", "country": "ญี่ปุ่น"},
    {"name": "Chulabhorn Research Institute", "type": "nonprofit", "country": "ไทย"},
    {"name": "สมาคมผู้ประกอบการ IT ไทย", "type": "nonprofit", "country": "ไทย"},
]

# Mock documents 1..7 (MockDocument). storage_key is a placeholder; no bytes
# are uploaded (mock data only). daysLeft is derived from expiry at query time.
DOCUMENTS = [
    {"key": 1, "name": "MoU ความร่วมมือทางวิชาการ มช.", "doc_type": "mou",
     "partner": "มหาวิทยาลัยเชียงใหม่", "effective": date(2024, 1, 1), "expiry": date(2028, 12, 31),
     "responsible": "ผศ.ดร.วิชัย สอนดี", "status": "active",
     "signer_our": "รศ.ดร.ประธาน มหาวิทยาลัย", "signer_partner": "รศ.ดร.สมชาย ใจดี"},
    {"key": 2, "name": "MoA แลกเปลี่ยนนักศึกษา NTU", "doc_type": "moa",
     "partner": "National Taiwan University", "effective": date(2023, 3, 15), "expiry": date(2026, 3, 14),
     "responsible": "รศ.ดร.นงนุช ประเสริฐ", "status": "active"},
    {"key": 3, "name": "MoU ความร่วมมือ University of Malaya", "doc_type": "mou",
     "partner": "University of Malaya", "effective": date(2022, 6, 1), "expiry": date(2025, 5, 31),
     "responsible": "ดร.กิตติพงษ์ รักษา", "status": "expiring"},
    {"key": 4, "name": "MoA สหกิจศึกษา บ.เทคโนโลยี", "doc_type": "moa",
     "partner": "บริษัท เทคโนโลยี จำกัด", "effective": date(2022, 7, 1), "expiry": date(2025, 6, 30),
     "responsible": "ผศ.สุดา วงศ์ดี", "status": "expiring"},
    {"key": 5, "name": "MoU ความร่วมมือ Waseda University", "doc_type": "mou",
     "partner": "Waseda University", "effective": date(2020, 2, 1), "expiry": date(2025, 1, 31),
     "responsible": "รศ.ดร.มานะ ฝึกฝน", "status": "expired"},
    {"key": 6, "name": "MoA ฝึกงาน บ.ABC จำกัด", "doc_type": "moa",
     "partner": "บริษัท ABC จำกัด", "effective": date(2025, 8, 1), "expiry": date(2028, 7, 31),
     "responsible": "ผศ.ดร.ธนา ขยัน", "status": "draft"},
    {"key": 7, "name": "MoU ความร่วมมือ CRI", "doc_type": "mou",
     "partner": "Chulabhorn Research Institute", "effective": date(2024, 3, 1), "expiry": date(2029, 2, 28),
     "responsible": "ดร.นิภา วิจัย", "status": "active"},
]

# Detail-page content for document 1 (mock documentScope / documentTimeline)
DOCUMENT_1_SCOPE = [
    "การแลกเปลี่ยนนักศึกษาและบุคลากรระหว่างสองสถาบัน",
    "การจัดกิจกรรมและโครงการวิชาการร่วมกัน",
    "การวิจัยและพัฒนาร่วมกันในสาขาที่เกี่ยวข้อง",
    "การแลกเปลี่ยนข้อมูล ทรัพยากร และองค์ความรู้",
    "การพัฒนาหลักสูตรและโปรแกรมการเรียนรู้ร่วมกัน",
    "การสนับสนุนทุนการศึกษาและการฝึกอบรม",
]

DOCUMENT_1_TIMELINE = [
    # label, date, done, current
    ("Draft", date(2023, 11, 1), True, False),
    ("Review", date(2023, 11, 15), True, False),
    ("Signed", date(2024, 1, 1), True, False),
    ("Active", date(2024, 1, 1), True, True),
    ("Renewal", date(2028, 12, 31), False, False),
]

# Mock activities 1..8 (MockActivity) + public-dashboard open flags.
# activity_type keeps the Thai label verbatim (the frontend styles badges by it).
ACTIVITIES = [
    {"name": "อบรมเชิงปฏิบัติการ AI for Education", "partner": "National Taiwan University",
     "type": "อบรม", "date": date(2025, 8, 20), "participants": 45, "mou_doc": 2,
     "status": "เสร็จสิ้น", "is_open": True, "location": "ห้อง 301 อาคารวิจัย NTU",
     "time": "09:00 – 17:00 น."},
    {"name": "สัมมนาวิชาการนวัตกรรมการเรียนการสอน", "partner": "มหาวิทยาลัยเชียงใหม่",
     "type": "สัมมนา", "date": date(2025, 8, 15), "participants": 80, "mou_doc": 1,
     "status": "เสร็จสิ้น", "is_open": False},
    {"name": "การเยี่ยมชมบริษัทและศึกษาดูงาน", "partner": "บริษัท เทคโนโลยี จำกัด",
     "type": "การเยี่ยมเยือน", "date": date(2025, 8, 10), "participants": 25, "mou_doc": 4,
     "status": "กำลังดำเนินการ"},
    {"name": "Workshop Data Science for Business", "partner": "University of Malaya",
     "type": "อบรม", "date": date(2025, 8, 5), "participants": 30, "mou_doc": 3,
     "status": "กำลังดำเนินการ", "is_open": True},
    {"name": "โครงการวิจัยร่วม AI Healthcare", "partner": "บริษัท ABC จำกัด",
     "type": "การวิจัย", "date": date(2025, 8, 1), "participants": 15, "mou_doc": 6,
     "status": "วางแผน"},
    {"name": "งาน Open Day สัมพันธ์ภาคอุตสาหกรรม", "partner": "สมาคมผู้ประกอบการ IT ไทย",
     "type": "กิจกรรมวิชาการ", "date": date(2025, 7, 25), "participants": 120, "mou_doc": None,
     "status": "เสร็จสิ้น", "is_open": False},
    {"name": "นิทรรศการผลงานนักศึกษา Tech Expo", "partner": "บริษัท เทคโนโลยี จำกัด",
     "type": "กิจกรรมวิชาการ", "date": date(2025, 7, 20), "participants": 200, "mou_doc": 4,
     "status": "เสร็จสิ้น"},
    {"name": "ประชุมความร่วมมือวิจัยชีวภาพ", "partner": "Chulabhorn Research Institute",
     "type": "การวิจัย", "date": date(2025, 7, 15), "participants": 18, "mou_doc": 7,
     "status": "เสร็จสิ้น"},
    # studentUpcomingActivities (distinct name+date rows; location from mock)
    {"name": "Workshop Data Science", "partner": "University of Malaya",
     "type": "อบรม", "date": date(2025, 9, 5), "participants": 30, "mou_doc": None,
     "status": "วางแผน", "location": "ห้อง 301"},
    {"name": "สัมมนาวิชาการนวัตกรรม", "partner": "มหาวิทยาลัยเชียงใหม่",
     "type": "สัมมนา", "date": date(2025, 9, 12), "participants": 80, "mou_doc": None,
     "status": "วางแผน", "location": "Auditorium"},
]

# Feedback entries (mock feedbackEntries). partner/activity resolved by name.
FEEDBACKS = [
    {"title": "ความพึงพอใจการอบรม AI for Education", "source": "ผู้เข้าร่วมกิจกรรม",
     "partner": "National Taiwan University", "activity": "อบรมเชิงปฏิบัติการ AI for Education",
     "rating": 5, "date": date(2025, 8, 21), "status": "ตรวจสอบแล้ว",
     "comment": "กิจกรรมมีประโยชน์มากและทีมวิทยากรมีความเชี่ยวชาญสูง เนื้อหาตรงกับความต้องการ และกิจกรรม hands-on ทำให้เข้าใจได้ดีมาก ขอขอบคุณทีมงานทุกท่าน"},
    {"title": "ข้อเสนอแนะหลักสูตรปริญญาโท", "source": "ศิษย์เก่า",
     "partner": None, "activity": None,
     "rating": 4, "date": date(2025, 8, 18), "status": "รอดำเนินการ",
     "comment": "หลักสูตรดีมากแต่อยากให้เพิ่มวิชาที่เน้น practical skills มากกว่านี้ โดยเฉพาะด้าน DevOps และ Cloud Computing ซึ่งตลาดงานต้องการมาก"},
    {"title": "Feedback จากภาคอุตสาหกรรม", "source": "คู่ความร่วมมือ",
     "partner": "บริษัท เทคโนโลยี จำกัด", "activity": None,
     "rating": 5, "date": date(2025, 8, 15), "status": "ตรวจสอบแล้ว",
     "comment": "บัณฑิตจากหลักสูตรนี้มีคุณภาพดีมาก สามารถทำงานได้จริงตั้งแต่วันแรก ขอชื่นชมทีมอาจารย์ที่เน้นการปฏิบัติจริง"},
    {"title": "ประเมินสหกิจศึกษา ภาคเรียนที่ 1/2568", "source": "ระบบสหกิจศึกษา",
     "partner": "บริษัท ABC จำกัด", "activity": None,
     "rating": 4, "date": date(2025, 8, 12), "status": "รอดำเนินการ",
     "comment": "นักศึกษาขยันและเรียนรู้เร็ว แต่ควรพัฒนาทักษะการสื่อสารและการนำเสนองานให้มากขึ้น"},
    {"title": "ความพึงพอใจการสัมมนาวิชาการ", "source": "ผู้เข้าร่วมกิจกรรม",
     "partner": "มหาวิทยาลัยเชียงใหม่", "activity": "สัมมนาวิชาการนวัตกรรมการเรียนการสอน",
     "rating": 5, "date": date(2025, 8, 16), "status": "ตรวจสอบแล้ว",
     "comment": "เนื้อหาตรงกับความต้องการและเป็นประโยชน์ต่อการพัฒนาหลักสูตร ได้แนวคิดใหม่ ๆ กลับไปมาก"},
    {"title": "Feedback นักศึกษาแลกเปลี่ยน NTU", "source": "นักศึกษา",
     "partner": "National Taiwan University", "activity": "Student Exchange Program",
     "rating": 5, "date": date(2025, 8, 10), "status": "รับทราบ",
     "comment": "ประสบการณ์แลกเปลี่ยนครั้งนี้ดีมากเลยครับ ได้เรียนรู้วัฒนธรรมใหม่และมีโอกาสพัฒนาทักษะภาษาอังกฤษ"},
]

# Exchange students (mock exchangeStudents, pages-B). Periods expanded to ISO dates.
EXCHANGE_STUDENTS = [
    {"name": "นายสมศักดิ์ ใจดี", "type": "outbound",
     "from_program": "หลักสูตรวิทยาการคอมพิวเตอร์", "to_organization": "National Taiwan University",
     "start": date(2025, 2, 1), "end": date(2025, 5, 31),
     "program": "Student Exchange", "status": "เสร็จสิ้น"},
    {"name": "นางสาวปวีณา เพ็ชรดี", "type": "outbound",
     "from_program": "หลักสูตรวิทยาการคอมพิวเตอร์", "to_organization": "University of Malaya",
     "start": date(2025, 6, 1), "end": date(2025, 8, 31),
     "program": "Student Exchange", "status": "กำลังดำเนินการ"},
    {"name": "นายธนวัฒน์ พรสวรรค์", "type": "outbound",
     "from_program": "หลักสูตรวิศวกรรมซอฟต์แวร์", "to_organization": "Waseda University",
     "start": date(2025, 9, 1), "end": date(2025, 12, 31),
     "program": "Internship", "status": "กำลังสมัคร"},
    {"name": "Miss Li Wei", "type": "inbound",
     "from_program": "National Taiwan University", "to_organization": "หลักสูตรวิทยาการคอมพิวเตอร์",
     "start": date(2025, 3, 1), "end": date(2025, 6, 30),
     "program": "Student Exchange", "status": "เสร็จสิ้น"},
    {"name": "Mr. Ahmad Faiz", "type": "inbound",
     "from_program": "University of Malaya", "to_organization": "หลักสูตรวิทยาการคอมพิวเตอร์",
     "start": date(2025, 7, 1), "end": date(2025, 10, 31),
     "program": "Research Exchange", "status": "กำลังดำเนินการ"},
    {"name": "นางสาวกัลยา รักษ์ดี", "type": "outbound",
     "from_program": "หลักสูตรวิทยาการคอมพิวเตอร์", "to_organization": "Chulabhorn Research Institute",
     "start": date(2025, 8, 1), "end": date(2025, 9, 30),
     "program": "Research Internship", "status": "วางแผน"},
    {"name": "Mr. Takeshi Tanaka", "type": "inbound",
     "from_program": "Waseda University", "to_organization": "หลักสูตรวิศวกรรมซอฟต์แวร์",
     "start": date(2025, 10, 1), "end": date(2025, 12, 31),
     "program": "Student Exchange", "status": "กำลังสมัคร"},
]

# Settings page profile (mock adminProfile)
ADMIN_PROFILE = {
    "first_name": "Admin", "last_name": "System",
    "email": "admin@university.ac.th", "phone": "+66 2 123 4567",
    "position": "ผู้ดูแลระบบ", "department": "สำนักงานหลักสูตร",
}


def _database_name(url: str) -> str:
    """Extract the database name from a DATABASE_URL ('' for sqlite files)."""
    if url.startswith("sqlite"):
        return ""
    return url.rsplit("/", 1)[-1].split("?", 1)[0]


def seed(session: Session) -> None:
    partners_by_name = {p.name: p for p in session.query(models.Partner).all()}
    activities_by_name = {a.name: a for a in session.query(models.Activity).all()}
    docs_by_name = {d.name: d for d in session.query(models.Document).all()}

    # --- Partners ---
    inserted = {"partners": 0, "documents": 0, "activities": 0,
                "feedbacks": 0, "exchange_students": 0}
    for pd in PARTNERS:
        if pd["name"] not in partners_by_name:
            partner = models.Partner(name=pd["name"], type=pd["type"],
                                     country=pd["country"], is_published=True)
            session.add(partner)
            session.flush()
            partners_by_name[partner.name] = partner
            inserted["partners"] += 1

    # --- Documents (metadata only -- no file bytes for mock data) ---
    for dd in DOCUMENTS:
        if dd["name"] in docs_by_name:
            continue
        doc = models.Document(
            name=dd["name"],
            storage_key=f"mock/agreements/mock-doc-{dd['key']}.pdf",  # placeholder, bytes not uploaded
            mime_type="application/pdf",
            size_bytes=None,
            is_published=True,
            doc_type=dd["doc_type"],
            partner_id=partners_by_name[dd["partner"]].id if dd.get("partner") else None,
            effective_date=dd.get("effective"),
            expiry_date=dd.get("expiry"),
            responsible=dd.get("responsible"),
            status=dd.get("status"),
            signer_our=dd.get("signer_our"),
            signer_partner=dd.get("signer_partner"),
        )
        session.add(doc)
        session.flush()
        docs_by_name[doc.name] = doc
        inserted["documents"] += 1

    # Detail-page children of mock document 1 (scope bullets + lifecycle timeline)
    doc1 = docs_by_name[DOCUMENTS[0]["name"]]
    if not doc1.scope_items:
        for pos, text in enumerate(DOCUMENT_1_SCOPE):
            session.add(models.DocumentScopeItem(document_id=doc1.id, position=pos, text=text))
    if not doc1.timeline_steps:
        for pos, (label, d, done, current) in enumerate(DOCUMENT_1_TIMELINE):
            session.add(models.DocumentTimelineStep(
                document_id=doc1.id, position=pos, label=label, date=d,
                done=done, current=current))

    # --- Activities ---
    for ad in ACTIVITIES:
        exists = session.query(models.Activity).filter(
            models.Activity.name == ad["name"],
            models.Activity.date == ad["date"],
        ).first()
        if exists:
            continue
        activity = models.Activity(
            name=ad["name"],
            date=ad["date"],
            is_published=True,
            partner_id=partners_by_name[ad["partner"]].id if ad.get("partner") else None,
            activity_type=ad.get("type"),
            participants=ad.get("participants"),
            location=ad.get("location"),
            time=ad.get("time"),
            status=ad.get("status"),
            is_open=ad.get("is_open"),
            mou_document_id=docs_by_name[
                next(d["name"] for d in DOCUMENTS if d["key"] == ad["mou_doc"])
            ].id if ad.get("mou_doc") else None,
        )
        session.add(activity)
        session.flush()
        activities_by_name[activity.name] = activity
        inserted["activities"] += 1

    # --- Feedback ---
    for fd in FEEDBACKS:
        if session.query(models.Feedback).filter(models.Feedback.title == fd["title"]).first():
            continue
        session.add(models.Feedback(
            title=fd["title"],
            source=fd.get("source"),
            rating=fd.get("rating"),
            date=fd.get("date"),
            status=fd.get("status"),
            comment=fd.get("comment"),
            is_published=True,
            partner_id=partners_by_name[fd["partner"]].id if fd.get("partner") else None,
            activity_id=activities_by_name[fd["activity"]].id if fd.get("activity") and fd["activity"] in activities_by_name else None,
        ))
        inserted["feedbacks"] += 1

    # --- Exchange students ---
    for es in EXCHANGE_STUDENTS:
        if session.query(models.ExchangeStudent).filter(
                models.ExchangeStudent.name == es["name"]).first():
            continue
        # outbound: destination partner; inbound: source partner
        org = es["to_organization"] if es["type"] == "outbound" else es["from_program"]
        session.add(models.ExchangeStudent(
            name=es["name"],
            type=es["type"],
            from_program=es["from_program"],
            to_organization=es["to_organization"],
            start_date=es["start"],
            end_date=es["end"],
            program=es["program"],
            status=es["status"],
            is_published=True,
            partner_id=partners_by_name[org].id if org in partners_by_name else None,
        ))
        inserted["exchange_students"] += 1

    # --- Admin profile (single row; insert only if the table is empty) ---
    if session.query(models.AdminProfile).count() == 0:
        session.add(models.AdminProfile(**ADMIN_PROFILE))

    session.commit()

    print("Seed summary (frontend mock dataset):")
    for key, count in inserted.items():
        print(f"  inserted {key}: {count}")
    print(f"  totals: partners={session.query(models.Partner).count()}, "
          f"documents={session.query(models.Document).count()}, "
          f"activities={session.query(models.Activity).count()}, "
          f"feedbacks={session.query(models.Feedback).count()}, "
          f"exchange_students={session.query(models.ExchangeStudent).count()}, "
          f"admin_profiles={session.query(models.AdminProfile).count()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the DB with the frontend mock dataset.")
    parser.add_argument("--database-url", default=None,
                        help="Override DATABASE_URL (e.g. sqlite:///./mock.db)")
    parser.add_argument("--reset", action="store_true",
                        help="Drop and recreate all tables before seeding")
    parser.add_argument("--yes", action="store_true",
                        help="Skip the production-database safety check")
    args = parser.parse_args()

    target_url = args.database_url or settings.DATABASE_URL
    db_name = _database_name(target_url)

    # Guard against pointing at the real RDS by accident: only sqlite files and
    # a database literally named "partner_activity_mock" are allowed without --yes.
    if not args.yes and not target_url.startswith("sqlite") and db_name != "partner_activity_mock":
        sys.exit(
            f"Refusing to seed '{db_name}' (only sqlite or 'partner_activity_mock' "
            f"are allowed without --yes)."
        )

    if args.database_url:
        # Rebuild engine against the requested URL
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        global engine, SessionLocal
        connect_args = {"check_same_thread": False} if target_url.startswith("sqlite") else {}
        engine = create_engine(target_url, connect_args=connect_args)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    if args.reset:
        print("Dropping and recreating all tables (--reset)...")
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        seed(session)
    finally:
        session.close()


if __name__ == "__main__":
    main()
