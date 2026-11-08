"""Demo seed touch-ups: agreement names and the demo student's own exchange records."""
from datetime import date, datetime, timezone

import demo_expansion
import models


def _source(kind="demo_fixture"):
    return models.Source(source_url=f"https://cstu-demo.example.test/{kind}", source_type=kind,
                         verification_status="verified", source_checked_at=datetime.now(timezone.utc))


def test_old_demo_agreement_names_become_mou_moa_with_spaces(db_session):
    partner = models.Partner(name="ASEAN Open Source Collective")
    other = models.Partner(name="Real Partner")
    source = _source()
    db_session.add_all([
        models.Document(name="MOU พัฒนาหลักสูตรกับASEAN Open Source Collective", partner=partner, sources=[source]),
        models.Document(name="MOA ฝึกงานกับASEAN Open Source Collective", partner=partner, sources=[source]),
        # Not a demo record, or not matching its partner: left alone.
        models.Document(name="MOU วิจัยกับReal Partner", partner=other, sources=[_source("official_document")]),
        models.Document(name="MOU วิจัยกับSomeone Else", partner=partner, sources=[source]),
    ])
    db_session.commit()
    assert demo_expansion.fix_agreement_names(db_session) == 2
    db_session.commit()
    names = sorted(d.name for d in db_session.query(models.Document))
    assert names == [
        "MOU วิจัยกับReal Partner",
        "MOU วิจัยกับSomeone Else",
        "MoA ฝึกงาน กับ ASEAN Open Source Collective",
        "MoU พัฒนาหลักสูตร กับ ASEAN Open Source Collective",
    ]
    assert demo_expansion.fix_agreement_names(db_session) == 0  # idempotent


def _exchange(name, status, published=True):
    return models.ExchangeStudent(name=name, type="outbound", status=status, is_published=published,
                                  start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))


def test_student_link_waits_for_first_login_then_links_two_and_stays_put(db_session):
    inbound = _exchange("In", "กำลังดำเนินการ")
    inbound.type = "inbound"
    db_session.add_all([_exchange("A", "วางแผน", published=False), inbound, _exchange("B", "กำลังดำเนินการ"),
                        _exchange("C", "เสร็จสิ้น"), _exchange("D", "เสร็จสิ้น")])
    db_session.commit()
    assert demo_expansion.link_student_exchanges(db_session, "student@example.test") is None
    student = models.User(cognito_sub="s", email="student@example.test", role="student",
                          created_at=datetime.now(timezone.utc))
    db_session.add(student)
    db_session.commit()
    assert demo_expansion.link_student_exchanges(db_session, "student@example.test") == 2
    db_session.commit()
    mine = db_session.query(models.ExchangeStudent).filter_by(user_id=student.id).order_by(models.ExchangeStudent.id).all()
    # One current and one finished record, never unpublished or inbound, under one student name.
    assert [r.status for r in mine] == ["กำลังดำเนินการ", "เสร็จสิ้น"]
    assert {r.name for r in mine} == {"B"}
    assert demo_expansion.link_student_exchanges(db_session, "student@example.test") == 0


def test_student_link_ignores_non_student_accounts(db_session):
    db_session.add_all([_exchange("B", "กำลังดำเนินการ"),
                        models.User(cognito_sub="x", email="student@example.test", role="staff",
                                    created_at=datetime.now(timezone.utc))])
    db_session.commit()
    assert demo_expansion.link_student_exchanges(db_session, "student@example.test") is None


def test_english_programme_names_become_thai(db_session):
    rows = [_exchange("A", "เสร็จสิ้น"), _exchange("B", "เสร็จสิ้น"), _exchange("C", "เสร็จสิ้น")]
    for row, program in zip(rows, ["Student Exchange", "Internship", "Summer School"]):
        row.program = program
    db_session.add_all(rows)
    db_session.commit()
    assert demo_expansion.fix_program_names(db_session) == 2
    db_session.commit()
    assert sorted(r.program for r in db_session.query(models.ExchangeStudent)) == ["Summer School", "ฝึกงาน", "แลกเปลี่ยนนักศึกษา"]
    assert demo_expansion.fix_program_names(db_session) == 0


def test_naturalize_drops_fictional_labels_but_keeps_the_notice():
    n = demo_expansion.naturalize
    notice = demo_expansion.NOTICE
    assert n("นักศึกษาสมมติ ฟ้า ทดสอบชัย (6)") == demo_expansion.student_name("ฟ้า")
    assert n("นักศึกษาสมมติ ฟ้า เดโมสกุล (9)") == demo_expansion.student_name("ฟ้า")  # same first name, same person
    assert n("ห้องปฏิบัติการสมมติ 302") == "ห้องปฏิบัติการคอมพิวเตอร์ 302"
    assert n("ห้องปฏิบัติการสมมติของ Sakuragaoka") == "ห้องปฏิบัติการของ Sakuragaoka"
    assert n("วิทยาการคอมพิวเตอร์ (สมมติ)") == "วิทยาการคอมพิวเตอร์"
    assert n("ความคิดเห็นสมมติ #3: สัมมนา AI") == "ความคิดเห็นที่ 3 ต่อ สัมมนา AI"
    assert n(f"{notice}\n\nนักศึกษาชั้นปีที่ 2-3 จำนวนสมมติ 20 คน") == f"{notice}\n\nนักศึกษาชั้นปีที่ 2-3 จำนวน 20 คน"
    assert n("ได้ checklist สมมติสำหรับตรวจข้อมูล") == "ได้ checklist สำหรับตรวจข้อมูล"
    assert n("ได้ checklistสำหรับตรวจข้อมูล") == "ได้ checklist สำหรับตรวจข้อมูล"  # repaired
    assert n("ส่งมอบต้นแบบ dashboard สมมติ 3 ชุด") == "ส่งมอบต้นแบบ dashboard 3 ชุด"
    assert n("เอกสารสมมติ-2.pdf") == "เอกสาร-2.pdf"
    assert n(notice) == notice  # the dataset disclaimer itself is untouched
    assert n(None) is None and n("ไม่มีคำนี้") == "ไม่มีคำนี้"


def test_naturalize_demo_gives_people_names_and_is_idempotent(db_session):
    partner = models.Partner(name="Hangang", contact_name="ผู้ประสานงานสมมติ 4",
                             description=f"{demo_expansion.NOTICE}\n\nคู่ความร่วมมือสมมติเพิ่มเติมสำหรับทดสอบการค้นหา ตัวกรอง และแดชบอร์ด")
    doc = models.Document(name="MoU วิจัย กับ Hangang", partner=partner, responsible="อาจารย์ผู้รับผิดชอบสมมติ 2",
                          signer_our="ผู้ลงนามฝ่ายหลักสูตรสมมติ", signer_partner="ผู้ลงนามฝ่ายคู่ความร่วมมือสมมติ",
                          scope_items=[models.DocumentScopeItem(position=0, text="วัตถุประสงค์: ความร่วมมือสมมติด้านวิจัย")])
    activity = models.Activity(name="สัมมนา", location="หอประชุมสมมติ",
                               description="กิจกรรมสมมติหัวข้อ AI สำหรับทดสอบการแสดงผลและสถิติ")
    db_session.add_all([partner, doc, activity])
    db_session.commit()
    assert demo_expansion.naturalize_demo(db_session) == 4  # partner, document, scope item, activity
    db_session.commit()
    assert partner.contact_name in demo_expansion.CONTACT_NAMES
    assert partner.description.endswith("หน่วยงานที่ร่วมมือกับหลักสูตรด้านการฝึกงาน การวิจัย และกิจกรรมนักศึกษา")
    assert doc.responsible in demo_expansion.LECTURER_NAMES
    assert (doc.signer_our, doc.signer_partner in demo_expansion.PARTNER_SIGNER_NAMES) == (demo_expansion.SIGNER_OUR, True)
    assert doc.scope_items[0].text == "วัตถุประสงค์: ความร่วมมือด้านวิจัย"
    assert (activity.location, activity.description) == ("หอประชุมคณะ", "กิจกรรมหัวข้อ AI สำหรับนักศึกษาและอาจารย์ของหลักสูตร")
    assert demo_expansion.naturalize_demo(db_session) == 0


def test_demo_partners_get_realistic_contact_details_and_puns_are_renamed(db_session):
    partner = models.Partner(name="Dr. Lin Firewall-Tan", contact_name="ผู้ประสานงานสมมติ 9",
                             website_url="https://stakeholder-9.example.test",
                             contact_email="contact-9@example.test")
    db_session.add(partner)
    db_session.commit()
    assert demo_expansion.naturalize_demo(db_session) == 1  # one row, four fields
    db_session.commit()
    assert partner.name == "Dr. Lin Tan"
    assert (partner.contact_name, partner.contact_email) == ("Dr. Lin Tan", "lin.tan@lin-tan.test")
    assert partner.website_url == "https://lin-tan.test"
    assert demo_expansion.naturalize_demo(db_session) == 0


def test_generated_activity_and_feedback_read_like_normal_records(db_session):
    partner = models.Partner(name="มหาวิทยาลัยรุ่งอรุณวิทยา")
    activity = models.Activity(
        name="ค่าย เกมและกราฟิก #1", activity_type="engineering_camp",
        date=date(2025, 3, 10), date_kind="event", status="วางแผน", partner=partner,
        description="กิจกรรมสมมติหัวข้อ เกมและกราฟิก สำหรับทดสอบการแสดงผลและสถิติ")
    feedback = models.Feedback(
        title="ความคิดเห็นที่ 1 ต่อ ค่าย เกมและกราฟิก #1", rating=5,
        comment="เนื้อหาตรงกับงานจริง อยากให้จัดต่อเนื่องทุกภาคการศึกษา",
        date=date(2025, 3, 15), partner=partner, activity=activity)
    raw_feedback = models.Feedback(
        title="ความคิดเห็นสมมติ #2: ค่าย เกมและกราฟิก #1", rating=3,
        comment="เนื้อหาดี แต่การประชาสัมพันธ์ล่วงหน้าน้อยเกินไป",
        date=date(2025, 3, 16), partner=partner, activity=activity)
    db_session.add_all([activity, feedback, raw_feedback])
    db_session.commit()

    demo_expansion.naturalize_demo(db_session, today=date(2026, 11, 4))
    db_session.commit()

    assert activity.name == "ค่ายเกมและกราฟิก (มีนาคม 2568)"
    assert activity.status == "เสร็จสิ้น" and activity.participants is not None
    assert feedback.title in [title for title, _ in demo_expansion.FEEDBACK_VOICES[5]]
    assert feedback.comment in [comment for _, comment in demo_expansion.FEEDBACK_VOICES[5]]
    assert raw_feedback.title in [title for title, _ in demo_expansion.FEEDBACK_VOICES[3]]
    assert demo_expansion.naturalize_demo(db_session, today=date(2026, 11, 4)) == 0


def test_exchange_students_get_unique_names_and_statuses_follow_dates(db_session):
    user = models.User(cognito_sub="s", email="student@example.test", role="student",
                       created_at=datetime.now(timezone.utc))
    db_session.add(user)
    db_session.commit()
    rows = [
        models.ExchangeStudent(name="นักศึกษาสมมติ ฟ้า ทดสอบชัย (1)", type="outbound", status="เสร็จสิ้น",
                               start_date=date(2025, 6, 1), end_date=date(2025, 8, 30), user_id=user.id),
        models.ExchangeStudent(name="นักศึกษาสมมติ ฟ้า เดโมสกุล (2)", type="outbound", status="เสร็จสิ้น",
                               start_date=date(2026, 6, 1), end_date=date(2026, 10, 29), user_id=user.id),
        models.ExchangeStudent(name="นักศึกษาสมมติ ใบเฟิร์น ตัวอย่างกุล (3)", type="inbound",
                               start_date=date(2025, 8, 1), end_date=date(2025, 12, 29)),
    ]
    db_session.add_all(rows)
    db_session.commit()

    demo_expansion.naturalize_demo(db_session, today=date(2026, 11, 4))
    db_session.commit()

    assert rows[0].name == rows[1].name  # one student, two exchange records
    assert rows[2].name != rows[0].name
    assert [row.status for row in rows] == ["เสร็จสิ้น", "กำลังดำเนินการ", "เสร็จสิ้น"]
    assert rows[1].end_date == date(2026, 12, 31)  # the current exchange stays current
    assert demo_expansion.naturalize_demo(db_session, today=date(2026, 11, 4)) == 0


def test_test_outcomes_are_rewritten_as_demo_results(db_session):
    activity = models.Activity(name="ปฐมนิเทศ", participants=20)
    outcome = models.Outcome(outcome_type_id=1, title="ผู้เข้าร่วมกิจกรรม (ข้อมูลทดสอบ V4-2)",
                             value=35, activity=activity)
    db_session.add(outcome)
    db_session.commit()

    demo_expansion.naturalize_demo(db_session)
    db_session.commit()

    assert outcome.title == "ผู้เข้าร่วมปฐมนิเทศนักศึกษาแลกเปลี่ยน รุ่น 1"
    assert float(outcome.value) == 20
    assert "ข้อมูลทดสอบ" not in (outcome.description or "")


def test_demo_source_label_loses_the_word_but_other_sources_keep_theirs(db_session):
    demo = models.Source(source_url="https://cstu-demo.example.test/dataset/v1", source_type="demo_fixture",
                         source_title="ชุดข้อมูลสมมติ CSTU สำหรับสาธิต V2", source_publisher="ชุดสาธิตรายวิชา CS361 (ข้อมูลสมมติ)",
                         verification_status="verified", source_checked_at=datetime.now(timezone.utc))
    other = models.Source(source_url="https://example.test/x", source_type="official_document",
                          source_title="ข้อมูลสมมติจากหน่วยงาน", verification_status="verified",
                          source_checked_at=datetime.now(timezone.utc))
    db_session.add_all([demo, other])
    db_session.commit()
    assert demo_expansion.naturalize_demo(db_session) == 1
    assert (demo.source_title, demo.source_publisher) == (demo_expansion.SOURCE_TITLE, demo_expansion.SOURCE_PUBLISHER)
    assert (demo.source_url, demo.source_locator) == (demo_expansion.SOURCE_URL, demo_expansion.SOURCE_LOCATOR)
    assert other.source_title == "ข้อมูลสมมติจากหน่วยงาน"
    assert demo_expansion.naturalize_demo(db_session) == 0
