"""Additional fictional records layered on top of the base CSTU demo (v3).

Deterministic: the same records are produced on every run. New documents carry
no files (metadata_only / unavailable) so the S3 demo bucket needs no uploads.
"""
from datetime import date, timedelta
import random

import models
from demo_content import NOTICE

VERSION = "cstu-fictional-v3"

# name, type, country, country code
PARTNERS = [
    ("Golden Dragon University of Science", "university", "China", "CN"),
    ("Hangang Institute of Digital Media", "university", "South Korea", "KR"),
    ("Southbank Polytechnic University", "university", "Australia", "AU"),
    ("Riverside College of Computing", "university", "United Kingdom", "GB"),
    ("มหาวิทยาลัยดอยดาวเทคโนโลยี", "university", "Thailand", "TH"),
    ("มหาวิทยาลัยคลื่นอันดามันวิทยา", "university", "Thailand", "TH"),
    ("Saigon Lotus University", "university", "Vietnam", "VN"),
    ("บริษัท รังเมฆ คลาวด์ จำกัด (CloudNest)", "private_company", "Thailand", "TH"),
    ("บริษัท ยามไซเบอร์ จำกัด (CyberGuard)", "private_company", "Thailand", "TH"),
    ("บริษัท เหรียญเรือง ฟินเทค จำกัด", "private_company", "Thailand", "TH"),
    ("Pixel Fox Game Studio", "private_company", "Japan", "JP"),
    ("Merlion SmartFreight Pte. Ltd.", "private_company", "Singapore", "SG"),
    ("สำนักงานรัฐไร้กระดาษ", "government", "Thailand", "TH"),
    ("สถาบันข้อมูลสะอาดแห่งชาติ", "government", "Thailand", "TH"),
    ("วิทยาลัยเทคนิคบางนาช่างไฟ", "vocational", "Thailand", "TH"),
    ("โรงพยาบาลหมอดิจิทัล", "healthcare", "Thailand", "TH"),
    ("ASEAN Open Source Collective", "network", "Malaysia", "MY"),
    ("คุณกันต์ คอมไพล์ผ่าน (ศิษย์เก่ารุ่น 9)", "alumni", "United States", "US"),
    ("คุณฟ้า ดีพลอยไว (ศิษย์เก่ารุ่น 17)", "alumni", "Thailand", "TH"),
    ("Dr. Klaus Datenberg", "expert", "Germany", "DE"),
]

DOC_TOPICS = ["แลกเปลี่ยนนักศึกษา", "วิจัยร่วม", "ฝึกงาน", "สหกิจศึกษา", "พัฒนาหลักสูตร", "อบรมวิทยากร"]
ACTIVITY_KINDS = [
    ("seminar", "สัมมนา"), ("collaboration_meeting", "ประชุมความร่วมมือ"), ("exchange", "แลกเปลี่ยน"),
    ("student_workshop_competition", "เวิร์กช็อป"), ("academic_visit", "เยี่ยมชมทางวิชาการ"),
    ("student_activity", "กิจกรรมนักศึกษา"), ("engineering_camp", "ค่าย"), ("official_event", "พิธีการ"),
    ("international_conference", "ประชุมนานาชาติ"),
]
ACTIVITY_TOPICS = ["Cloud", "AI", "ความปลอดภัยไซเบอร์", "Data Science", "UX/UI", "DevOps", "เกมและกราฟิก",
                   "IoT", "Blockchain", "ซอฟต์แวร์ทดสอบ"]
LOCATIONS = ["ห้องประชุมสมมติ อาคาร 1", "ห้องปฏิบัติการสมมติ 302", "หอประชุมสมมติ", "ออนไลน์ (สมมติ)",
             "สถานที่สมมติของคู่ความร่วมมือ"]
FEEDBACK_SOURCES = ["participant", "alumni", "partner", "student", "coop_system"]
FEEDBACK_COMMENTS = {
    5: "เนื้อหาตรงกับงานจริง อยากให้จัดต่อเนื่องทุกภาคการศึกษา",
    4: "ได้ประโยชน์มาก แต่เวลาฝึกปฏิบัติยังน้อยไป",
    3: "เนื้อหาดี แต่การประชาสัมพันธ์ล่วงหน้าน้อยเกินไป",
    2: "กำหนดการเปลี่ยนบ่อย ทำให้วางแผนเข้าร่วมยาก",
    1: "สถานที่และอุปกรณ์ไม่พร้อม ควรตรวจก่อนวันจัด",
}
FIRST = ["ณัฐ", "ปุณ", "ธัญ", "กันต์", "พิม", "ภูมิ", "มายด์", "ต้น", "ใบเฟิร์น", "ปาล์ม", "ฟ้า", "ไอซ์"]
LAST = ["สมมติวงศ์", "ตัวอย่างกุล", "เดโมสกุล", "ทดสอบชัย", "จำลองศักดิ์"]


def _status_for(start, end, today):
    if end < today:
        return "expired"
    return "expiring" if end <= today + timedelta(days=180) else "active"


def expand(db, source, today=date(2026, 10, 2)):
    """Add the v3 records. Caller holds the advisory lock and commits."""
    rng = random.Random(361)
    base_partners = db.query(models.Partner).order_by(models.Partner.id).all()

    partners = []
    for i, (name, kind, country, code) in enumerate(PARTNERS, start=13):
        partner = models.Partner(
            name=name, type=kind, country=country, country_code=code,
            description=f"{NOTICE}\n\nคู่ความร่วมมือสมมติเพิ่มเติมสำหรับทดสอบการค้นหา ตัวกรอง และแดชบอร์ด",
            website_url=f"https://stakeholder-{i}.example.test",
            contact_name=f"ผู้ประสานงานสมมติ {i}", contact_email=f"contact-{i}@example.test",
            contact_is_public=i % 3 != 0, is_published=i % 10 != 0,
            scope_level=["program", "faculty", "university"][i % 3], sources=[source],
        )
        db.add(partner)
        partners.append(partner)
    all_partners = base_partners + partners

    documents = []
    for i, partner in enumerate(p for p in partners if p.type not in ("alumni", "expert")):
        start = date(2021 + i % 5, 1 + i % 12, 1)
        end = start.replace(year=start.year + 3) - timedelta(days=1)
        doc_type = "moa" if partner.type == "private_company" else "mou"
        topic = DOC_TOPICS[i % len(DOC_TOPICS)]
        document = models.Document(
            name=f"{doc_type.upper()} {topic}กับ{partner.name}", partner=partner,
            doc_type=doc_type, document_kind="agreement", status=_status_for(start, end, today),
            effective_date=start, expiry_date=end,
            file_availability="metadata_only" if i % 4 else "unavailable",
            responsible=f"อาจารย์ผู้รับผิดชอบสมมติ {i + 1}",
            signer_our="ผู้ลงนามฝ่ายหลักสูตรสมมติ", signer_partner="ผู้ลงนามฝ่ายคู่ความร่วมมือสมมติ",
            scope_level=partner.scope_level, is_published=partner.is_published, sources=[source],
            scope_items=[
                models.DocumentScopeItem(position=0, text=f"วัตถุประสงค์: ความร่วมมือสมมติด้าน{topic}"),
                models.DocumentScopeItem(position=1, text="ขอบเขต: กิจกรรมสาธิต ไม่ใช่ข้อตกลงจริง"),
            ],
        )
        db.add(document)
        documents.append(document)

    activities = []
    for i in range(90):
        partner = rng.choice(all_partners)
        kind, kind_label = rng.choice(ACTIVITY_KINDS)
        topic = rng.choice(ACTIVITY_TOPICS)
        when = date(2025, 1, 1) + timedelta(days=rng.randrange(0, 730))
        status = "เสร็จสิ้น" if when < today - timedelta(days=14) else "กำลังดำเนินการ" if when <= today else "วางแผน"
        linked = [d for d in documents if d.partner is partner and d.effective_date <= when <= d.expiry_date]
        activity = models.Activity(
            name=f"{kind_label} {topic} #{i + 1}", partner=partner,
            mou_document=linked[0] if linked and rng.random() < 0.7 else None,
            date=when, date_kind="event", date_precision="day",
            end_date=when + timedelta(days=rng.choice([0, 0, 0, 1, 2, 4])),
            activity_type=kind,
            description=f"{NOTICE}\n\nกิจกรรมสมมติหัวข้อ {topic} สำหรับทดสอบการแสดงผลและสถิติ",
            status=status, participants=rng.randint(8, 150) if status == "เสร็จสิ้น" else None,
            location=rng.choice(LOCATIONS), time=rng.choice(["09:00 - 12:00", "13:00 - 16:00", "09:00 - 16:00"]),
            is_open=True if status == "วางแผน" and rng.random() < 0.5 else None,
            is_published=partner.is_published and rng.random() > 0.05,
            scope_level=partner.scope_level, sources=[source],
        )
        db.add(activity)
        activities.append(activity)
    db.flush()

    done = [a for a in activities if a.status == "เสร็จสิ้น"]
    for i in range(45):
        activity = rng.choice(done)
        rating = rng.choices([5, 4, 3, 2, 1], weights=[35, 35, 18, 8, 4])[0]
        db.add(models.Feedback(
            title=f"ความคิดเห็นสมมติ #{i + 1}: {activity.name}",
            source=rng.choice(FEEDBACK_SOURCES), rating=rating,
            date=activity.date + timedelta(days=rng.randint(1, 10)),
            status=rng.choice(["ตรวจสอบแล้ว", "ตรวจสอบแล้ว", "รอตรวจสอบ"]),
            comment=FEEDBACK_COMMENTS[rating], is_published=rng.random() > 0.2,
            partner=activity.partner, activity=activity,
        ))

    abroad = [p for p in all_partners if p.type in ("university", "private_company")]
    for i in range(30):
        partner = rng.choice(abroad)
        direction = "inbound" if i % 4 == 0 else "outbound"
        program = "Student Exchange" if partner.type == "university" else "Internship"
        start = date(2025, rng.choice([1, 6, 8]), 1) + timedelta(days=365 * (i % 2))
        end = start + timedelta(days=rng.choice([30, 90, 120, 150]))
        db.add(models.ExchangeStudent(
            name=f"นักศึกษาสมมติ {rng.choice(FIRST)} {rng.choice(LAST)} ({i + 1})",
            type=direction,
            from_program="วิทยาการคอมพิวเตอร์ (สมมติ)" if direction == "outbound" else partner.name,
            to_organization=partner.name if direction == "outbound" else "วิทยาการคอมพิวเตอร์ (สมมติ)",
            start_date=start, end_date=end, program=program,
            status="เสร็จสิ้น" if end < today else "กำลังดำเนินการ" if start <= today else "วางแผน",
            is_published=rng.random() > 0.3, partner=partner,
        ))
    db.flush()
    return [len(partners), len(documents), len(activities)]
