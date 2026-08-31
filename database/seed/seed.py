#!/usr/bin/env python3
"""
Idempotent seed script for CS361_G650-15 database.
Uses SQLAlchemy ORM — compatible with both SQLite (dev) and PostgreSQL (RDS/prod).

Seeds REAL Thammasat University stakeholder data (sourced from public TU websites,
Aug 2026): international partner universities, government/industry agreements,
exchange calls, and MoU/MoA-style PDF documents uploaded through the storage
backend (local disk OR S3 depending on STORAGE_BACKEND env var).

Replaces the earlier fictional dataset (TechCorp, Global Solutions Inc, ...) so
the demo exercises the same problem domain as the real project: scattered,
hard-to-track partnership information.

Data provenance (public sources):
- OIA Thammasat  : MoU templates, agreement procedure, exchange program calls,
                   Akureyri/NTU exploration news
                   https://oia.tu.ac.th/mou-collaboration-page/
- TBS            : partner universities table (WU Wien, NHH, St. Gallen, NUS, NTU...)
                   http://inter.tbs.tu.ac.th/index.php/partner-universities/
- Faculty of Econ: partner universities list (UT Austin, RSM Erasmus, Nagoya...)
                   https://www.econ.tu.ac.th/en/exchange-program/outgoing-exchange-students/partner
- Naewna         : TU has 171 active international MoUs (2025 report); One Health
                   Lecture Series 2025 (Hokkaido U.), Beijing Forum 2025 (Peking U.)
                   https://www.naewna.com/local/938886
- TU Law Lex     : MoA signing Bank of Thailand x Faculty of Law on 19 Aug 2026
                   https://tulex.law.tu.ac.th/

Notes:
- Activity/document dates marked "(approx.)" are stand-ins where the source gave
  only month/year granularity -- flagged honestly instead of silently invented.
- Documents are generated placeholder PDFs (correct metadata; not scanned copies).
"""

import os
import sys

# Ensure backend/ is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from datetime import date
from sqlalchemy.orm import Session

from database import engine, Base
from models import Partner, Activity, Document
import storage


# ---------------------------------------------------------------------------
# Minimal dependency-free PDF builder (single page, Helvetica, ASCII text).
# Metadata-correct placeholder documents for the demo -- not official scans.
# ---------------------------------------------------------------------------

def _pdf_escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def simple_pdf(title: str, lines) -> bytes:
    """Return bytes of a valid single-page PDF with title + body lines."""
    ops = ["BT /F1 16 Tf", f"72 760 Td ({_pdf_escape(title)}) Tj", "ET"]
    y = 730
    for line in lines:
        ops.append(f"BT /F1 11 Tf")
        ops.append(f"72 {y} Td ({_pdf_escape(line)}) Tj ET")
        y -= 18
    stream = "\n".join(ops).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream),
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref_pos = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += (
        b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
        % (len(objects) + 1, xref_pos)
    )
    return bytes(out)


# ---------------------------------------------------------------------------
# Seed data: real Thammasat stakeholders
# ---------------------------------------------------------------------------

PARTNERS_DATA = [
    {
        "name": "Bank of Thailand",
        "type": "government",
        "country": "Thailand",
        "website_url": "https://www.bot.or.th",
        "description": ("ธนาคารกลางของประเทศไทย ลงนามบันทึกข้อตกลงความร่วมมือทางวิชาการ "
                        "(MoA) กับคณะนิติศาสตร์ มธ. เมื่อ 19 ส.ค. 2569 -- ร่วมพัฒนารายวิชา/หลักสูตร "
                        "ด้านการเงินการธนาคาร พร้อมโอกาสฝึกงาน สหกิจศึกษา ศึกษาดูงาน และ workshop"),
        "is_published": True,
    },
    {
        "name": "National University of Singapore (NUS)",
        "type": "university",
        "country": "Singapore",
        "website_url": "https://www.nus.edu.sg",
        "description": "คู่ความร่วมมือแลกเปลี่ยนนักศึกษาระดับคณะ (Thammasat Business School)",
        "is_published": True,
    },
    {
        "name": "Nanyang Technological University (NTU)",
        "type": "university",
        "country": "Singapore",
        "website_url": "https://www.ntu.edu.sg",
        "description": ("คู่ความร่วมมือแลกเปลี่ยนนักศึกษา; 2569 มธ.หารือขยายความร่วมมือทางวิชาการ "
                        "เพิ่มเติมกับ NTU Singapore"),
        "is_published": True,
    },
    {
        "name": "University of St. Gallen",
        "type": "university",
        "country": "Switzerland",
        "website_url": "https://www.unisg.ch",
        "description": "Business school ชั้นนำของยุโรป เป็นคู่แลกเปลี่ยนทั้ง TBS และคณะเศรษฐศาสตร์",
        "is_published": True,
    },
    {
        "name": "WU Vienna University of Economics and Business",
        "type": "university",
        "country": "Austria",
        "website_url": "https://www.wu.ac.at",
        "description": "คู่ความร่วมมือแลกเปลี่ยนนักศึกษาระดับคณะ (Thammasat Business School)",
        "is_published": True,
    },
    {
        "name": "Norwegian School of Economics (NHH)",
        "type": "university",
        "country": "Norway",
        "website_url": "https://www.nhh.no",
        "description": "คู่ความร่วมมือแลกเปลี่ยนนักศึกษาระดับคณะ (TBS และคณะเศรษฐศาสตร์)",
        "is_published": True,
    },
    {
        "name": "The University of Texas at Austin",
        "type": "university",
        "country": "United States",
        "website_url": "https://www.utexas.edu",
        "description": "คู่ความร่วมมือแลกเปลี่ยนนักศึกษาคณะเศรษฐศาสตร์ มธ.",
        "is_published": True,
    },
    {
        "name": "Rotterdam School of Management, Erasmus University",
        "type": "university",
        "country": "Netherlands",
        "website_url": "https://www.rsm.nl",
        "description": "คู่ความร่วมมือแลกเปลี่ยนนักศึกษาคณะเศรษฐศาสตร์ มธ.",
        "is_published": True,
    },
    {
        "name": "Nagoya University",
        "type": "university",
        "country": "Japan",
        "website_url": "https://www.nagoya-u.ac.jp",
        "description": ("คู่ความร่วมมือแลกเปลี่ยนนักศึกษา (Graduate School of International "
                        "Development ผ่านคณะเศรษฐศาสตร์; BJM ผ่าน School of Informatics)"),
        "is_published": True,
    },
    {
        "name": "Hokkaido University",
        "type": "university",
        "country": "Japan",
        "website_url": "https://www.global.hokudai.ac.jp",
        "description": ("พันธมิตรความร่วมมือของ มธ. ในญี่ปุ่น ร่วมจัดประชุมวิชาการ "
                        "One Health Lecture Series 2025"),
        "is_published": True,
    },
    {
        "name": "Peking University",
        "type": "university",
        "country": "China",
        "website_url": "https://www.pku.edu.cn",
        "description": ("ผู้เชิญ มธ. ร่วม Beijing Forum 2025 เพื่อแลกเปลี่ยนมุมมองและ"
                        "เสริมสร้างความร่วมมือทางวิชาการในภูมิภาคเอเชีย"),
        "is_published": True,
    },
    # Draft partner -- mirrors the OIA news "Thammasat and University of Akureyri
    # Explore Academic Collaboration" (still exploring => not yet published).
    {
        "name": "University of Akureyri",
        "type": "university",
        "country": "Iceland",
        "website_url": "https://www.unak.is",
        "description": "DRAFT: อยู่ระหว่างสำรวจความร่วมมือทางวิชาการกับ มธ. (ยังไม่ลงนาม)",
        "is_published": False,
    },
]

ACTIVITIES_DATA = [
    {
        "name": "MoA Signing Ceremony: Bank of Thailand x Faculty of Law",
        "date": date(2026, 8, 19),
        "activity_type": "academic_event",
        "description": ("พิธีลงนาม MoA ณ ตำหนักวังบางขุนพรหม -- ความร่วมมือด้านการเงินการธนาคาร, "
                        "การพัฒนารายวิชา, ฝึกงาน สหกิจศึกษา ศึกษาดูงาน และการอบรมเชิงปฏิบัติการ"),
        "is_published": True,
        "partner_name": "Bank of Thailand",
    },
    {
        "name": "Exchange Programs AY2026 Call (start January 2027)",
        "date": date(2026, 9, 1),  # approx.: source gives AY/start window only
        "activity_type": "exchange",
        "description": ("[วันที่โดยประมาณ] OIA เปิดรับสมัคร Exchange Programs with Partner Universities "
                        "with Exchange Student Scholarships สำหรับ AY2026 เริ่มต้นภาคเรียน Jan 2027"),
        "is_published": True,
        "partner_name": None,  # university-wide call -> standalone
    },
    {
        "name": "One Health Lecture Series 2025",
        "date": date(2025, 8, 15),  # approx.: source gives year + host universities only
        "activity_type": "academic_event",
        "description": ("ประชุมวิชาการร่วมกับมหาวิทยาลัยพันธมิตรญี่ปุ่น (Hokkaido University, "
                        "Rakuno Gakuen University) ภายหลังการหารือความร่วมมือปี 2568"),
        "is_published": True,
        "partner_name": "Hokkaido University",
    },
    {
        "name": "Beijing Forum 2025",
        "date": date(2025, 11, 1),  # approx.: source confirms forum + invitation only
        "activity_type": "academic_event",
        "description": ("คณะผู้บริหาร มธ. เข้าร่วม Beijing Forum 2025 เป็นครั้งแรก "
                        "แลกเปลี่ยนมุมมองด้านวิทยาศาสตร์ เทคโนโลยี และ AI กับ Peking University"),
        "is_published": True,
        "partner_name": "Peking University",
    },
    {
        "name": "Cultural Tours: Exploring Global Cross-Cultural Experiences",
        "date": date(2026, 7, 1),  # approx.: OIA headline, exact date not stated
        "activity_type": "workshop",
        "description": "กิจกรรม cross-cultural experiences สำหรับนักศึกษา จัดโดย OIA (standalone)",
        "is_published": True,
        "partner_name": None,
    },
    # Draft activity -- published list stays clean while admins prepare content.
    {
        "name": "Delegation Visit: Expanding Academic Ties with NTU Singapore",
        "date": date(2026, 10, 1),  # approx. -- follow-up meeting being scheduled
        "activity_type": "academic_event",
        "is_published": False,
        "partner_name": "Nanyang Technological University (NTU)",
        "description": "DRAFT: เตรียมต้อนรับและหารือขยายความร่วมมือทางวิชาการกับ NTU Singapore",
    },
]

DOCUMENTS_DATA = [
    # (name, doc_type, partner_name, effective, expiry, filename, pdf_title, pdf_lines)
    {
        "name": "TU General MOU Template (ENG)",
        "doc_type": "template",
        "partner_name": None,
        "effective_date": None,
        "expiry_date": None,
        "file_name": "tu-general-mou-template-eng.pdf",
        "pdf_title": "TU General MOU Template (English)",
        "pdf_lines": [
            "Official template published by the Office of International Affairs (OIA).",
            "Source: https://oia.tu.ac.th/mou-collaboration/tu-general-agreement-template/",
            "",
            "PLACEHOLDER DOCUMENT -- generated by the CS361 demo seed script.",
            "Metadata (doc_type=mou/template) is real; replace this file with",
            "the signed/scanned original through the document upload API.",
        ],
    },
    {
        "name": "TU General MOU Template (TH)",
        "doc_type": "template",
        "partner_name": None,
        "effective_date": None,
        "expiry_date": None,
        "file_name": "tu-general-mou-template-th.pdf",
        "pdf_title": "TU General MOU Template (Thai)",
        "pdf_lines": [
            "Template ทางการของสำนักงานกิจการนานาชาติ (OIA) ฉบับภาษาไทย",
            "Source: https://oia.tu.ac.th/mou-collaboration/tu-general-mou-template-th/",
            "",
            "PLACEHOLDER DOCUMENT -- generated by the CS361 demo seed script.",
        ],
    },
    {
        "name": "TU Specific Agreement Template",
        "doc_type": "template",
        "partner_name": None,
        "effective_date": None,
        "expiry_date": None,
        "file_name": "tu-specific-agreement-template.pdf",
        "pdf_title": "TU Specific Agreement Template",
        "pdf_lines": [
            "Template for specific (scoped) agreements -- activity-level MoA.",
            "Source: https://oia.tu.ac.th/mou-collaboration/tu-specific-agreement-template/",
            "",
            "PLACEHOLDER DOCUMENT -- generated by the CS361 demo seed script.",
        ],
    },
    {
        "name": "Agreement Procedure (OIA)",
        "doc_type": "template",
        "partner_name": None,
        "effective_date": None,
        "expiry_date": None,
        "file_name": "oia-agreement-procedure.pdf",
        "pdf_title": "Agreement Procedure - Office of International Affairs",
        "pdf_lines": [
            "Step-by-step procedure for establishing international agreements:",
            "proposal -> negotiation -> legal review -> signing -> lifecycle tracking.",
            "Contact: Miss Jutasri Wongchawalit (jutasriw@tu.ac.th), +66 2 696 6982",
            "Source: https://oia.tu.ac.th/mou-collaboration/agreement-procedure/",
            "",
            "PLACEHOLDER DOCUMENT -- generated by the CS361 demo seed script.",
        ],
    },
    {
        "name": "MOA: Bank of Thailand x Faculty of Law (signed 19 Aug 2026)",
        "doc_type": "moa",
        "partner_name": "Bank of Thailand",
        "effective_date": date(2026, 8, 19),
        "expiry_date": None,  # term length not disclosed publicly
        "file_name": "moa-bot-faculty-of-law-2026.pdf",
        "pdf_title": "MOA: Bank of Thailand x Faculty of Law, Thammasat University",
        "pdf_lines": [
            "Signed: Wednesday 19 August 2026 (B.E. 2569) at Bang Khun Phrom Palace.",
            "Signatories: Ms. Wirekha Santapan (Assistant Governor, BOT) x",
            "Assoc. Prof. Dr. Supreeya Kaewla-iad (Dean, Faculty of Law, TU).",
            "Scope: joint course/programme development in banking & finance;",
            "internships, cooperative education, study visits, workshops.",
            "Source: https://tulex.law.tu.ac.th/ (news item, Aug 2026).",
            "",
            "PLACEHOLDER DOCUMENT -- metadata real; swap in the signed scan.",
        ],
    },
]


def seed():
    print("Creating tables (if not exist)...")
    Base.metadata.create_all(bind=engine)

    session = Session(bind=engine)

    # --- Partners ---
    print("\nSeeding partners (real Thammasat stakeholders)...")
    partner_count = 0
    for pd in PARTNERS_DATA:
        existing = session.query(Partner).filter(Partner.name == pd["name"]).first()
        if not existing:
            session.add(Partner(**pd))
            partner_count += 1
    session.commit()

    partners_by_name = {p.name: p.id for p in session.query(Partner).all()}
    total_partners = len(partners_by_name)

    # --- Activities ---
    print("Seeding activities...")
    activity_count = 0
    for ad in ACTIVITIES_DATA:
        existing = session.query(Activity).filter(Activity.name == ad["name"]).first()
        if not existing:
            kwargs = {
                "name": ad["name"],
                "date": ad["date"],
                "description": ad.get("description"),
                "is_published": ad["is_published"],
                "activity_type": ad.get("activity_type"),
                "partner_id": partners_by_name.get(ad["partner_name"])
                if ad["partner_name"]
                else None,
            }
            session.add(Activity(**kwargs))
            activity_count += 1
    session.commit()

    # --- Documents (generate PDF bytes -> upload through storage backend) ---
    print(f"Seeding documents (uploading PDFs via '{storage._get_backend_name()}' backend)...")
    doc_count = 0
    for dd in DOCUMENTS_DATA:
        existing = session.query(Document).filter(Document.name == dd["name"]).first()
        if existing:
            continue
        pdf_bytes = simple_pdf(dd["pdf_title"], dd["pdf_lines"])
        key = f"agreements/{dd['file_name']}"
        storage.put_file(key, pdf_bytes)  # respects STORAGE_BACKEND (local | s3)
        session.add(
            Document(
                name=dd["name"],
                storage_key=key,
                mime_type="application/pdf",
                size_bytes=len(pdf_bytes),
                is_published=True,
                doc_type=dd["doc_type"],
                partner_id=partners_by_name.get(dd["partner_name"]) if dd["partner_name"] else None,
                effective_date=dd["effective_date"],
                expiry_date=dd["expiry_date"],
            )
        )
        doc_count += 1
        print(f"   uploaded: {key} ({len(pdf_bytes)} bytes)")
    session.commit()

    total_activities = session.query(Activity).count()
    total_documents = session.query(Document).count()
    published_partners = session.query(Partner).filter(Partner.is_published == True).count()  # noqa: E712
    published_activities = session.query(Activity).filter(Activity.is_published == True).count()  # noqa: E712
    standalone = session.query(Activity).filter(Activity.partner_id == None).count()  # noqa: E711

    # --- Summary ---
    divider = "=" * 44
    print(f"\n{divider}")
    print("SEED SUMMARY (real Thammasat stakeholder data)")
    print(divider)
    print(f"   Inserted:      {partner_count} partner(s), {activity_count} activity(ies), {doc_count} document(s)")
    print(f"   Total:         {total_partners} partners, {total_activities} activities, {total_documents} documents")
    print(f"   Published:     {published_partners} partners, {published_activities} activities")
    print(f"   Draft:         {total_partners - published_partners} partners, {total_activities - published_activities} activities")
    print(f"   Standalone:    {standalone} activity(ies) with NULL partner_id")

    session.close()


if __name__ == "__main__":
    seed()
