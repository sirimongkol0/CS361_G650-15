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
            status=rng.choice(["reviewed", "reviewed", "pending"]),
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

# A few early demo records used wordplay instead of names ("Firewall-Tan",
# "Test-Suk"). Rename only people with no agreement attached to them.
PARTNER_RENAMES = {
    "คุณภูมิ ไบต์ทอง (ศิษย์เก่ารุ่น 12)": "คุณกิตติภูมิ พงษ์สุวรรณ (ศิษย์เก่ารุ่น 12)",
    "คุณพลอย เทสต์สุข (ศิษย์เก่ารุ่น 15)": "คุณพลอยไพลิน เจริญสุข (ศิษย์เก่ารุ่น 15)",
    "Dr. Lin Firewall-Tan": "Dr. Lin Tan",
    "คุณกันต์ คอมไพล์ผ่าน (ศิษย์เก่ารุ่น 9)": "คุณกันต์ ธีรวงศ์ (ศิษย์เก่ารุ่น 9)",
    "คุณฟ้า ดีพลอยไว (ศิษย์เก่ารุ่น 17)": "คุณฟ้า วัชรศิลป์ (ศิษย์เก่ารุ่น 17)",
}

# Displayed contact details. Keyed by the partner's final name. The domains end
# in the reserved .test TLD, so they read like ordinary addresses without
# pointing at a real organisation.
PARTNER_PROFILES = {
    "มหาวิทยาลัยรุ่งอรุณวิทยา": ("ผศ.ดร.กิตติพงษ์ วงศ์ไทย", "kittipong.w", "rungaroon"),
    "Sakuragaoka Institute of Technology": ("Yuki Tanaka", "yuki.tanaka", "sakuragaoka-it"),
    "บริษัท โค้ดช่างฝีมือ จำกัด (CodeCraft Studio)": ("คุณธนกฤต พึ่งบุญ", "thanakrit.p", "codecraft-studio"),
    "บริษัท สะพานข้อมูล อนาไลติกส์ จำกัด": ("คุณพิมพ์ชนก อินทร์แก้ว", "pimchanok.i", "saphan-data"),
    "สถาบันวิจัยนวัตกรรมดิจิทัลแม่โขง": ("ดร.วีรยุทธ ทองคำ", "weerayut.t", "mekong-digital"),
    "สมาคมนักพัฒนาซอฟต์แวร์สยาม": ("คุณอรอุมา จันทร์เพ็ญ", "oruma.c", "siam-dev"),
    "คุณกิตติภูมิ พงษ์สุวรรณ (ศิษย์เก่ารุ่น 12)": ("คุณกิตติภูมิ พงษ์สุวรรณ", "kittiphum.p", "kittiphum-p"),
    "คุณพลอยไพลิน เจริญสุข (ศิษย์เก่ารุ่น 15)": ("คุณพลอยไพลิน เจริญสุข", "ploypailin.c", "ploypailin-c"),
    "ดร.ปัญญา ประดิษฐ์กุล": ("ดร.ปัญญา ประดิษฐ์กุล", "panya.p", "panya-p"),
    "Dr. Lin Tan": ("Dr. Lin Tan", "lin.tan", "lin-tan"),
    "Asia Pacific Learning Alliance (APLA)": ("Maria Santos", "maria.santos", "apla"),
    "บริษัท ม่านหมอก ซอฟต์แวร์ จำกัด": ("คุณนภัสวรรณ ศรีสุข", "naphaswan.s", "manmok-software"),
    "Golden Dragon University of Science": ("Li Wei", "li.wei", "golden-dragon"),
    "Hangang Institute of Digital Media": ("Park Ji-woo", "jiwoo.park", "hangang"),
    "Southbank Polytechnic University": ("Emma Walker", "emma.walker", "southbank"),
    "Riverside College of Computing": ("James Whitfield", "james.whitfield", "riverside-computing"),
    "มหาวิทยาลัยดอยดาวเทคโนโลยี": ("ผศ.ดร.ณัฐวดี ศรีอรุณ", "natthawadee.s", "doidao"),
    "มหาวิทยาลัยคลื่นอันดามันวิทยา": ("อ.ดร.จิราพร ปัญญาดี", "jiraporn.p", "andaman-wave"),
    "Saigon Lotus University": ("Nguyen Thi Mai", "mai.nguyen", "saigon-lotus"),
    "บริษัท รังเมฆ คลาวด์ จำกัด (CloudNest)": ("คุณปวีณา บุญมา", "paweena.b", "cloudnest"),
    "บริษัท ยามไซเบอร์ จำกัด (CyberGuard)": ("คุณชยพล สายทอง", "chayaphon.s", "cyberguard"),
    "บริษัท เหรียญเรือง ฟินเทค จำกัด": ("คุณสุภาวดี มีสุข", "supawadee.m", "rianrueng-fintech"),
    "Pixel Fox Game Studio": ("Haruto Sato", "haruto.sato", "pixelfox"),
    "Merlion SmartFreight Pte. Ltd.": ("Wei Ming Lim", "weiming.lim", "merlion-smartfreight"),
    "สำนักงานรัฐไร้กระดาษ": ("คุณอนุชา ศรีวงศ์", "anucha.s", "paperless-office"),
    "สถาบันข้อมูลสะอาดแห่งชาติ": ("คุณศิริพร แก้วมณี", "siriporn.k", "clean-data"),
    "วิทยาลัยเทคนิคบางนาช่างไฟ": ("อาจารย์สมชาย ใจดี", "somchai.j", "bangna-tech"),
    "โรงพยาบาลหมอดิจิทัล": ("นพ.ปรีชา สุขสวัสดิ์", "precha.s", "digital-doctor"),
    "ASEAN Open Source Collective": ("Aisyah Rahman", "aisyah.rahman", "asean-oss"),
    "คุณกันต์ ธีรวงศ์ (ศิษย์เก่ารุ่น 9)": ("คุณกันต์ ธีรวงศ์", "kan.t", "kan-t"),
    "คุณฟ้า วัชรศิลป์ (ศิษย์เก่ารุ่น 17)": ("คุณฟ้า วัชรศิลป์", "fa.w", "fa-w"),
    "Dr. Klaus Datenberg": ("Dr. Klaus Datenberg", "klaus.datenberg", "klaus-datenberg"),
}

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
# The dataset's source, listed under "ที่มาของข้อมูล" on every detail page.
# It reads like an internal registry; source_type=demo_fixture still marks it as
# sample data in the UI.
SOURCE_TITLE = "ทะเบียนข้อตกลงและกิจกรรมความร่วมมือ"
SOURCE_PUBLISHER = "งานวิเทศสัมพันธ์ คณะวิทยาศาสตร์และเทคโนโลยี"
SOURCE_URL = "https://registry.cstu.test/collaboration/2569"
SOURCE_LOCATOR = "รวบรวมจากทะเบียนข้อตกลง รายงานกิจกรรม และแบบประเมินผลของหลักสูตร"
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


_THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
_GENERATED_ACTIVITY = re.compile(r"^.+? (?P<topic>.+?) #\d+$")
_DOC_TOPIC = re.compile(r"^(?:MoU|MoA) (?P<topic>.+?) กับ ")
_GENERATED_FEEDBACK = re.compile(r"^ความคิดเห็นที่ \d+ ต่อ ")
_TEST_PREFIX = ("FT-", "DEMO-", "LT-")


def _is_test_record(value):
    return bool(value) and value.startswith(_TEST_PREFIX)


def _join_th(prefix, text):
    """Join a Thai prefix to a Thai or English topic with natural spacing."""
    text = (text or "").strip()
    if not text:
        return prefix
    return f"{prefix}{text}" if not text[0].isascii() else f"{prefix} {text}"


def _month_year(value):
    return f"{_THAI_MONTHS[value.month - 1]} {value.year + 543}"


def _short_partner(name):
    if not name:
        return "หน่วยงานคู่ความร่วมมือ"
    name = re.sub(r"\s*\(.*?\)\s*$", "", name).strip()
    for prefix in ("บริษัท ", "มหาวิทยาลัย", "สถาบัน", "สมาคม", "สำนักงาน", "วิทยาลัย", "โรงพยาบาล"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    for suffix in (" จำกัด", " Pte. Ltd.", " Co., Ltd."):
        if name.endswith(suffix):
            name = name[:-len(suffix)]
            break
    return name.strip() or "หน่วยงานคู่ความร่วมมือ"


def _natural_activity_name(kind, topic, partner_name, when):
    short = _short_partner(partner_name)
    suffix = f" ({_month_year(when)})" if when else ""
    if kind == "collaboration_meeting":
        return f"ประชุมความร่วมมือกับ {short} เรื่อง {topic}{suffix}"
    if kind == "exchange":
        return f"แลกเปลี่ยนนักศึกษากับ {short} ด้าน {topic}{suffix}"
    if kind == "academic_visit":
        return f"เยี่ยมชม {short} ด้าน {topic}{suffix}"
    if kind == "student_workshop_competition":
        return _join_th("เวิร์กช็อป", topic) + suffix
    if kind == "student_activity":
        return _join_th("กิจกรรมนักศึกษา", topic) + suffix
    if kind == "engineering_camp":
        return _join_th("ค่าย", topic) + suffix
    if kind == "official_event":
        return _join_th("พิธีเปิดงาน", topic) + suffix
    if kind == "international_conference":
        return _join_th("การประชุมนานาชาติด้าน", topic) + suffix
    return _join_th("สัมมนา", topic) + suffix


_ACTIVITY_DESCRIPTIONS = {
    "seminar": "บรรยายและแลกเปลี่ยนความคิดเห็นเรื่อง {topic} โดยมีวิทยากรจาก {partner} "
               "นักศึกษาได้ซักถามและร่วมอภิปรายหลังการบรรยาย",
    "collaboration_meeting": "ประชุมหารือความร่วมมือกับ {partner} เรื่อง {topic} "
                             "เพื่อกำหนดแผนกิจกรรม ผู้รับผิดชอบ และช่วงเวลาจัดงานในภาคการศึกษาถัดไป",
    "exchange": "นักศึกษาแลกเปลี่ยนระยะสั้นกับ {partner} ด้าน {topic} ประกอบด้วยการเรียนร่วม "
                "โครงงานกลุ่ม และการเยี่ยมชมสถานประกอบการ",
    "student_workshop_competition": "เวิร์กช็อปภาคปฏิบัติเรื่อง {topic} แบ่งกลุ่มลงมือทำ "
                                    "และนำเสนอผลงานเมื่อจบกิจกรรม",
    "academic_visit": "เยี่ยมชมทีมวิจัยและห้องปฏิบัติการของ {partner} เพื่อเตรียมความร่วมมือด้าน {topic}",
    "student_activity": "กิจกรรมเสริมหลักสูตรเรื่อง {topic} เปิดโอกาสให้นักศึกษาได้รู้จักเพื่อนต่างชั้นปี "
                        "และฝึกทักษะการทำงานเป็นทีม",
    "engineering_camp": "ค่ายเข้มข้นด้าน {topic} สำหรับนักศึกษาที่สนใจ มีทั้งบรรยาย ฝึกปฏิบัติ "
                        "และการแข่งขันแบบทีม",
    "official_event": "พิธีเปิดกิจกรรมความร่วมมือด้าน {topic} โดยมีผู้บริหาร คณาจารย์ "
                      "และตัวแทนจาก {partner} เข้าร่วม",
    "international_conference": "การประชุมวิชาการนานาชาติด้าน {topic} มีผู้แทนจากมหาวิทยาลัย "
                                "และภาคอุตสาหกรรมร่วมนำเสนอผลงาน",
}


def _activity_description(kind, topic, partner_name):
    short = _short_partner(partner_name)
    text = _ACTIVITY_DESCRIPTIONS.get(
        kind, "กิจกรรมความร่วมมือด้าน {topic} กับ {partner} สำหรับนักศึกษาและอาจารย์ของหลักสูตร"
    ).format(topic=topic, partner=short)
    return f"{NOTICE}\n\n{text}"


FEEDBACK_VOICES = {
    5: [
        ("อยากให้จัดกิจกรรมแบบนี้อีก",
         "เนื้อหาตรงกับงานจริงและได้ลงมือทำเต็มที่ วิทยากรอธิบายละเอียด "
         "อยากให้จัดต่อเนื่องทุกภาคการศึกษา"),
        ("คุ้มค่ากับเวลาที่มา",
         "ได้เห็นขั้นตอนการทำงานจริงและได้ลองทำเอง นักศึกษาหลายคนสนใจสมัครฝึกงานต่อ"),
        ("ได้ไอเดียกลับไปทำโครงงาน",
         "กิจกรรมกระชับแต่มีตัวอย่างให้ดูครบ ได้คำแนะนำเรื่องโครงงานเพิ่มเติมจากพี่เลี้ยง"),
    ],
    4: [
        ("มีประโยชน์ แต่อยากให้มีเวลาฝึกมากขึ้น",
         "เนื้อหาเข้าใจง่ายและได้ลงมือทำจริง แต่ช่วงฝึกปฏิบัติน้อยไปหน่อย "
         "อยากให้เพิ่มอีกราวครึ่งวัน"),
        ("วิทยากรอธิบายเข้าใจง่าย",
         "การบรรยายชัดเจนและยกตัวอย่างใกล้ตัว อยากให้มีเอกสารประกอบแจกเพิ่ม"),
        ("จัดเวลาได้กระชับ",
         "ได้ประโยชน์คุ้มเวลา แต่อยากให้เปิดรับผู้เข้าร่วมมากขึ้น"),
    ],
    3: [
        ("เนื้อหาดี แต่ประชาสัมพันธ์ช้า",
         "เพิ่งทราบกำหนดการใกล้วันจัด ทำให้เตรียมตัวไม่ทัน "
         "อยากให้ประกาศล่วงหน้าอย่างน้อยสองสัปดาห์"),
        ("อยากให้เพิ่มช่วงถามตอบ",
         "เนื้อหาครบแต่เวลาถามตอบน้อย หลายคำถามยังไม่ได้คุยต่อ"),
        ("โดยรวมโอเค แต่ห้องแน่นไปหน่อย",
         "ผู้เข้าร่วมเกินที่นั่งเล็กน้อย ทำให้เดินดูฐานกิจกรรมไม่สะดวก"),
    ],
    2: [
        ("กำหนดการเปลี่ยนบ่อย",
         "มีการเลื่อนวันและเวลาหลายครั้ง ทำให้วางแผนเข้าร่วมยาก"),
        ("เวลาจัดทับกับวิชาอื่น",
         "นักศึกษาหลายคนติดเรียน จึงเข้าร่วมได้ไม่เต็มเวลา"),
    ],
    1: [
        ("อุปกรณ์และสถานที่ยังไม่พร้อม",
         "โปรเจกเตอร์และอินเทอร์เน็ตใช้งานไม่ได้ช่วงเริ่มกิจกรรม ต้องรอแก้ไขนาน"),
        ("การจัดงานล่าช้ากว่ากำหนด",
         "เริ่มกิจกรรมช้ากว่ากำหนดเกือบหนึ่งชั่วโมงและไม่มีประกาศแจ้ง"),
    ],
}

# One name per student, so the 30 exchange rows do not reuse a handful of names.
# Two linked rows of the same account share a name (see naturalize_demo).
EXCHANGE_NAMES = [
    "ฟ้า วัฒนกุล", "ใบเฟิร์น รัตนพันธ์", "กันต์ ธีรวงศ์", "ธัญ ชัยมงคล", "มายด์ มณีรัตน์",
    "ต้น ปัญญาวงศ์", "พิม บุญประเสริฐ", "ปาล์ม ศรีสวัสดิ์", "ภูมิ พรหมมา", "ปุณ สุขเจริญ",
    "ไอซ์ แสงอรุณ", "แนน ทองดี", "มิ้นท์ อินทร์ทอง", "โอ๊ต วัชรศิลป์", "บีม เจริญสุข",
    "พลอย พงษ์สุวรรณ", "กวาง ศรีวงศ์", "นิว สายทอง", "เจมส์ มีสุข", "แตงโม บุญมา",
    "หยก ใจดี", "ข้าวหอม สุขสวัสดิ์", "สายฝน วัฒนศิลป์", "ตะวัน รุ่งเรือง", "นาวา จันทร์เพ็ญ",
    "อร ทองคำ", "อิง แก้วมณี", "จูน พึ่งบุญ", "เฟิร์น อินทร์แก้ว", "พีช เกษมสุข",
]

_OUTCOME_REWRITES = [
    ("ผู้เข้าร่วมกิจกรรม", "ผู้เข้าร่วมปฐมนิเทศนักศึกษาแลกเปลี่ยน รุ่น 1",
     "นักศึกษาแลกเปลี่ยนรุ่นแรกเข้าร่วมปฐมนิเทศครบตามจำนวนที่รับ"),
    ("ผลงานจากการแลกเปลี่ยน", "รายงานสรุปผลการแลกเปลี่ยนระยะสั้น",
     "รายงานสรุปผลการแลกเปลี่ยนและข้อเสนอสำหรับรุ่นถัดไป"),
    ("งบสนับสนุนจากข้อตกลง", "งบสนับสนุนกิจกรรมความร่วมมือ",
     "งบประมาณสนับสนุนการจัดกิจกรรมตามข้อตกลงความร่วมมือ"),
    ("นักศึกษาฝึกงานกับหน่วยงาน", "นักศึกษาที่ได้รับเข้าฝึกงาน",
     "นักศึกษาที่ได้รับเข้าฝึกงานกับหน่วยงานหลังจบโครงการ"),
]


def naturalize_demo(db, today=None) -> int:
    """Give the fictional demo ordinary-looking data in place; returns rows changed.

    Runs on every seed so an existing demo picks up the same touch-ups without
    adding rows. Only rows whose current values are the generated placeholders
    are rewritten, which keeps the function idempotent.
    """
    today = today or date.today()
    changed = set()

    def put(row, field, value):
        if getattr(row, field) != value:
            setattr(row, field, value)
            changed.add((type(row).__name__, row.id))

    for source in db.query(models.Source).filter(models.Source.source_type == "demo_fixture").all():
        if not source.source_title or _labelled(source.source_title) or source.source_title.startswith("ชุดข้อมูลสาธิต"):
            put(source, "source_title", SOURCE_TITLE)
        if not source.source_publisher or _labelled(source.source_publisher) or source.source_publisher == "รายวิชา CS361":
            put(source, "source_publisher", SOURCE_PUBLISHER)
        if source.source_url == "https://cstu-demo.example.test/dataset/v1":
            put(source, "source_url", SOURCE_URL)
        if not source.source_locator or "ตรวจความสอดคล้องของชุดสาธิต" in source.source_locator:
            put(source, "source_locator", SOURCE_LOCATOR)
    for partner in db.query(models.Partner).all():
        final_name = PARTNER_RENAMES.get(partner.name, partner.name)
        if final_name != partner.name:
            put(partner, "name", final_name)
        profile = PARTNER_PROFILES.get(final_name)
        if profile:
            contact_name, local_part, domain = profile
            # Replace only the generated placeholders, so a contact edited later
            # through the UI survives the next seed.
            if _labelled(partner.contact_name) or not partner.contact_name:
                put(partner, "contact_name", contact_name)
            if not partner.contact_email or re.fullmatch(r"contact-\d+@example\.test", partner.contact_email):
                put(partner, "contact_email", f"{local_part}@{domain}.test")
            if not partner.website_url or re.fullmatch(r"https://stakeholder-\d+\.example\.test", partner.website_url):
                put(partner, "website_url", f"https://{domain}.test")
        elif _labelled(partner.contact_name):
            put(partner, "contact_name", CONTACT_NAMES[partner.id % len(CONTACT_NAMES)])
        put(partner, "description", naturalize(partner.description))
    for doc in db.query(models.Document).all():
        if _labelled(doc.responsible):
            put(doc, "responsible", LECTURER_NAMES[doc.id % len(LECTURER_NAMES)])
        if _labelled(doc.signer_our):
            put(doc, "signer_our", SIGNER_OUR)
        if _labelled(doc.signer_partner):
            put(doc, "signer_partner", PARTNER_SIGNER_NAMES[doc.id % len(PARTNER_SIGNER_NAMES)])
        put(doc, "file_name", naturalize(doc.file_name))
        topic_match = _DOC_TOPIC.match(doc.name)
        for item in doc.scope_items:
            if topic_match and item.text.startswith("ขอบเขต: กิจกรรมสาธิต"):
                put(item, "text", f"ขอบเขต: กิจกรรมร่วมด้าน{topic_match.group('topic')} "
                                  "การแลกเปลี่ยนบุคลากร และการพัฒนานักศึกษา")
            else:
                put(item, "text", naturalize(item.text))
    for activity in db.query(models.Activity).all():
        put(activity, "description", naturalize(activity.description))
        put(activity, "location", naturalize(activity.location))
        match = _GENERATED_ACTIVITY.match(activity.name)
        if not match:
            continue
        topic = match.group("topic").strip()
        partner_name = activity.partner.name if activity.partner else None
        put(activity, "name", _natural_activity_name(
            activity.activity_type, topic, partner_name, activity.date))
        put(activity, "description", _activity_description(
            activity.activity_type, topic, partner_name))
        if activity.date and activity.date_kind == "event" and not activity.is_deleted:
            end = activity.end_date or activity.date
            if end < today:
                status = "เสร็จสิ้น"
            elif activity.date <= today:
                status = "กำลังดำเนินการ"
            else:
                status = "วางแผน"
            put(activity, "status", status)
            if status == "เสร็จสิ้น" and activity.participants is None:
                put(activity, "participants", 15 + (activity.id * 7) % 106)
            elif status == "วางแผน":
                put(activity, "participants", None)
    seen_users = {}
    user_records = {}
    next_name = 0
    for row in db.query(models.ExchangeStudent).order_by(models.ExchangeStudent.id).all():
        if row.owner_user_id is not None or _is_test_record(row.name):
            continue
        if row.user_id is not None and row.user_id in seen_users:
            name = seen_users[row.user_id]
        else:
            name = EXCHANGE_NAMES[next_name % len(EXCHANGE_NAMES)]
            next_name += 1
            if row.user_id is not None:
                seen_users[row.user_id] = name
        put(row, "name", name)
        if row.start_date and row.start_date.day == 1:
            delta = timedelta(days=(row.id * 3) % 9)
            put(row, "start_date", row.start_date + delta)
            if row.end_date:
                put(row, "end_date", row.end_date + delta)
        if row.user_id is not None:
            user_records.setdefault(row.user_id, []).append(row)
        elif row.start_date and row.end_date:
            if row.end_date < today:
                status = "เสร็จสิ้น"
            elif row.start_date <= today:
                status = "กำลังดำเนินการ"
            else:
                status = "วางแผน"
            put(row, "status", status)
        for field in ("from_program", "to_organization"):
            put(row, field, naturalize(getattr(row, field)))
    # The demo student should see one finished and one current exchange, even
    # after the original end date passes while this dataset is still in use.
    for rows in user_records.values():
        if len(rows) < 2 or any(row.status == "กำลังดำเนินการ" for row in rows):
            continue
        current = max(rows, key=lambda row: (row.end_date or row.start_date or date.min, row.id))
        if current.start_date and current.start_date <= today:
            put(current, "status", "กำลังดำเนินการ")
            if not current.end_date or current.end_date < today + timedelta(days=30):
                put(current, "end_date", date(today.year, 12, 31))
    for row in db.query(models.Feedback).all():
        natural_title = naturalize(row.title)
        voices = FEEDBACK_VOICES.get(row.rating)
        # Fresh seeds still carry "ความคิดเห็นสมมติ #N: ..." here; older demos
        # carry its naturalised form. Both should become a human headline.
        if voices and (_GENERATED_FEEDBACK.match(row.title) or _GENERATED_FEEDBACK.match(natural_title)):
            title, comment = voices[row.id % len(voices)]
            put(row, "title", title)
            put(row, "comment", comment)
        else:
            put(row, "title", natural_title)
            put(row, "comment", naturalize(row.comment))
    for outcome in db.query(models.Outcome).all():
        if "ข้อมูลทดสอบ" not in (outcome.title or ""):
            continue
        for prefix, title, description in _OUTCOME_REWRITES:
            if outcome.title.startswith(prefix):
                put(outcome, "title", title)
                put(outcome, "description", description)
                if prefix == "ผู้เข้าร่วมกิจกรรม" and outcome.activity and outcome.activity.participants:
                    put(outcome, "value", outcome.activity.participants)
                break
        else:
            put(outcome, "title", outcome.title.replace(" (ข้อมูลทดสอบ V4-2)", ""))
    return len(changed)
