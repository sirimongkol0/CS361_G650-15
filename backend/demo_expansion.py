"""Additional fictional records layered on top of the base CSTU demo (v3).

Deterministic: the same records are produced on every run. New documents carry
no files (metadata_only / unavailable) so the S3 demo bucket needs no uploads.
"""
from datetime import date, timedelta
import random
import re

from sqlalchemy import or_

import models
from demo_content import NOTICE

VERSION = "cstu-fictional-v3"
AGREEMENT_LABEL = {"mou": "MoU", "moa": "MoA"}
# Fictional records the demo student account sees as its own (GET /exchange/mine).
STUDENT_EXCHANGES = 2
# Exchange programme names; v3 demos used the English ones.
PROGRAM_NAMES = {"Student Exchange": "แลกเปลี่ยนนักศึกษา", "Internship": "ฝึกงาน"}

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
            name=f"{AGREEMENT_LABEL[doc_type]} {topic} กับ {partner.name}", partner=partner,
            doc_type=doc_type, document_kind="agreement", status=_status_for(start, end, today),
            effective_date=start, expiry_date=end,
            file_availability="metadata_only" if i % 4 else "unavailable",
            responsible=f"อาจารย์ผู้รับผิดชอบสมมติ {i + 1}",
            signer_our="ผู้ลงนามฝ่ายหลักสูตรสมมติ", signer_partner="ผู้ลงนามฝ่ายคู่ความร่วมมือสมมติ",
            scope_level=partner.scope_level, is_published=partner.is_published,
            cstu_status="keep" if partner.is_published else "review", sources=[source],
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
        program = PROGRAM_NAMES["Student Exchange" if partner.type == "university" else "Internship"]
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


_OLD_NAME = re.compile(r"^(MOU|MOA) (.+?)กับ(\S.*)$")


def fix_agreement_names(db) -> int:
    """Rename v3 demo agreements from 'MOU topicกับPartner' to 'MoU topic กับ Partner'.

    Only fictional demo records whose name still ends with their partner's name change.
    """
    renamed = 0
    old = db.query(models.Document).filter(or_(models.Document.name.like("MOU %"), models.Document.name.like("MOA %")))
    for doc in old.all():
        match = _OLD_NAME.match(doc.name)
        demo = doc.sources and all(source.source_type == "demo_fixture" for source in doc.sources)
        if not (match and demo and doc.partner and match.group(3) == doc.partner.name):
            continue
        doc.name = f"{AGREEMENT_LABEL[match.group(1).lower()]} {match.group(2)} กับ {doc.partner.name}"
        renamed += 1
    return renamed


def fix_program_names(db) -> int:
    """Rename the English demo programme names on exchange records to Thai."""
    renamed = 0
    for english, thai in PROGRAM_NAMES.items():
        renamed += db.query(models.ExchangeStudent).filter(models.ExchangeStudent.program == english).update(
            {models.ExchangeStudent.program: thai}, synchronize_session=False)
    return renamed


def link_student_exchanges(db, email: str):
    """Give the demo student account its own exchange records (exchange_students.user_id).

    The users row exists only after that account's first login, so this returns
    None until then; 0 when the account already has records. Picks a current or
    planned record and a finished one, so the student sees both states, and
    gives them the same student name.
    """
    user = db.query(models.User).filter(models.User.email == email, models.User.role == "student").first()
    if user is None:
        return None
    if db.query(models.ExchangeStudent).filter(models.ExchangeStudent.user_id == user.id).count():
        return 0
    free = db.query(models.ExchangeStudent).filter(
        models.ExchangeStudent.user_id.is_(None), models.ExchangeStudent.is_published.is_(True),
        # A CSTU student goes out on exchange; inbound records are other universities' students.
        models.ExchangeStudent.type == "outbound",
    ).order_by(models.ExchangeStudent.id)
    picks = [free.filter(models.ExchangeStudent.status != "เสร็จสิ้น").first(),
             free.filter(models.ExchangeStudent.status == "เสร็จสิ้น").first()]
    picks = [row for row in picks if row is not None][:STUDENT_EXCHANGES]
    for row in picks:
        row.user_id = user.id
        row.name = picks[0].name  # one student who went on two exchanges
    return len(picks)


# --- Natural-looking names --------------------------------------------------
# The generators above label every person and place "สมมติ" (fictional). The
# web shows those values, so the touch-up below swaps them for ordinary-looking
# (still invented) names. The NOTICE line at the start of descriptions stays:
# it is what marks the whole dataset as fictional, and the demo UI hides it.

CONTACT_NAMES = [
    "คุณนภัสวรรณ ศรีสุข", "คุณกิตติพงษ์ วงศ์ไทย", "คุณศิริพร แก้วมณี", "คุณธนกฤต พึ่งบุญ",
    "คุณพิมพ์ชนก อินทร์แก้ว", "คุณวีรยุทธ ทองคำ", "คุณอรอุมา จันทร์เพ็ญ", "คุณณัฐพล รุ่งเรือง",
    "คุณปวีณา บุญมา", "คุณชยพล สายทอง", "คุณสุภาวดี มีสุข", "คุณอนุชา ศรีวงศ์",
]
LECTURER_NAMES = [
    "ผศ.ดร.วรวุฒิ ศักดิ์เจริญ", "อ.ดร.กมลชนก ทองประเสริฐ", "ผศ.ปิยะพงษ์ แสงทอง", "อ.ดร.สุนิสา วัฒนกุล",
    "รศ.ดร.ธีรวัฒน์ ชัยมงคล", "อ.ณัฐวดี ศรีอรุณ", "ผศ.ดร.ภาณุพงศ์ อินทรสุวรรณ", "อ.ดร.จิราพร ปัญญาดี",
]
SIGNER_OUR = "รศ.ดร.ประภาพร อินทรสุวรรณ"
PARTNER_SIGNER_NAMES = ["คุณสมเกียรติ ธนากร", "คุณรัชนี พงษ์พานิช", "คุณประเสริฐ วงศ์สวัสดิ์", "คุณมาลัย เกษมสุข"]
# Students get a surname picked by their first name, so one student's records agree.
SURNAMES = ["ศรีวงศ์", "วัฒนกุล", "ทองสกุล", "ชัยมงคล", "เจริญศักดิ์", "พรหมมา", "แสงอรุณ", "บุญประเสริฐ",
            "รัตนพันธ์", "สุขเจริญ", "อินทร์ทอง", "ปัญญาวงศ์", "ศรีสวัสดิ์", "มณีรัตน์", "ทองดี"]
# Surnames an earlier version of the rules gave every student.
_OLD_SURNAMES = ("ศรีวงศ์", "วัฒนกุล", "ทองสกุล", "ชัยมงคล", "เจริญศักดิ์")


def student_name(first: str) -> str:
    return f"{first} {SURNAMES[sum(map(ord, first)) % len(SURNAMES)]}"
PLACES = {
    "สถานที่สมมติของคู่ความร่วมมือ": "สำนักงานของหน่วยงานคู่ความร่วมมือ",
    "ห้องประชุมสมมติ อาคาร 1": "ห้องประชุม 1 อาคารเรียนรวม",
    "หอประชุมสมมติ": "หอประชุมคณะ",
    "ออนไลน์ (สมมติ)": "ออนไลน์",
    "ห้องปฏิบัติการสมมติ 302": "ห้องปฏิบัติการคอมพิวเตอร์ 302",
}
_PHRASES = [
    (re.compile(r"นักศึกษาสมมติ (\S+) \S+ \(\d+\)"), lambda m: student_name(m.group(1))),
    # Titles are unique, so the entry number stays.
    (re.compile(r"ความคิดเห็นสมมติ #(\d+): "), lambda m: f"ความคิดเห็นที่ {m.group(1)} ต่อ "),
    (re.compile(r"คู่ความร่วมมือสมมติเพิ่มเติมสำหรับทดสอบการค้นหา ตัวกรอง และแดชบอร์ด"),
     "หน่วยงานที่ร่วมมือกับหลักสูตรด้านการฝึกงาน การวิจัย และกิจกรรมนักศึกษา"),
    (re.compile(r"กิจกรรมสมมติหัวข้อ (.+?) สำหรับทดสอบการแสดงผลและสถิติ"),
     lambda m: f"กิจกรรมหัวข้อ {m.group(1)} สำหรับนักศึกษาและอาจารย์ของหลักสูตร"),
    (re.compile(r"\s?\(สมมติ\)"), ""),
    (re.compile(r" สมมติ(?=\S)"), " "),  # between two words: keep one space
    (re.compile(r"\s?สมมติ"), ""),
]
# Text an earlier version of the rules joined together.
_REPAIRS = {"checklistสำหรับ": "checklist สำหรับ"}


def naturalize(text):
    """Drop the 'สมมติ' labels from demo text, keeping the NOTICE prefix."""
    if text:
        for broken, fixed in _REPAIRS.items():
            text = text.replace(broken, fixed)
    if not text or "สมมติ" not in text.replace(NOTICE, ""):
        return text
    head = NOTICE if text.startswith(NOTICE) else ""
    body = text[len(head):]
    if body.strip() in PLACES:
        return head + PLACES[body.strip()]
    for pattern, replacement in _PHRASES:
        body = pattern.sub(replacement, body)
    return head + body


def _labelled(value):
    return bool(value) and "สมมติ" in value


def naturalize_demo(db) -> int:
    """Rewrite the demo's 'สมมติ' names and text in place; returns rows changed."""
    changed = set()

    def put(row, field, value):
        if getattr(row, field) != value:
            setattr(row, field, value)
            changed.add((type(row).__name__, row.id))

    for partner in db.query(models.Partner).all():
        if _labelled(partner.contact_name):
            put(partner, "contact_name", CONTACT_NAMES[partner.id % len(CONTACT_NAMES)])
        put(partner, "description", naturalize(partner.description))
    for doc in db.query(models.Document).all():
        if _labelled(doc.responsible):
            put(doc, "responsible", LECTURER_NAMES[doc.id % len(LECTURER_NAMES)])
        if _labelled(doc.signer_our):
            put(doc, "signer_our", SIGNER_OUR)
        if _labelled(doc.signer_partner):
            put(doc, "signer_partner", PARTNER_SIGNER_NAMES[doc.id % len(PARTNER_SIGNER_NAMES)])
        for item in doc.scope_items:
            put(item, "text", naturalize(item.text))
    for activity in db.query(models.Activity).all():
        put(activity, "description", naturalize(activity.description))
        put(activity, "location", naturalize(activity.location))
    for row in db.query(models.ExchangeStudent).all():
        for field in ("name", "from_program", "to_organization"):
            put(row, field, naturalize(getattr(row, field)))
        first, _, last = row.name.partition(" ")
        if last in _OLD_SURNAMES:  # renamed before the wider surname list
            put(row, "name", student_name(first))
    for row in db.query(models.Feedback).all():
        put(row, "title", naturalize(row.title))
        put(row, "comment", naturalize(row.comment))
    return len(changed)
