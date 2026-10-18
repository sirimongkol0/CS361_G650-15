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
