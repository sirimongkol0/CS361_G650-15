"""Link the verified Erasmus+ seminar to OPS MHESI; pass --apply to commit.

Run with the backend's database environment. References are the organizers'
post-event reports published on 31 August 2026.
"""
import json
import sys
from datetime import date, datetime, timezone

import database
import models


PARTNER_NAME = "สำนักงานปลัดกระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม"
ACTIVITY_NAME = "สัมมนา Erasmus+ Thailand 2026 การเสริมสร้างศักยภาพการอุดมศึกษา"
REFERENCES = [
    (
        "https://ops.go.th/en/inter-news-announcement/inter-news/item/15358-erasmus-thailand-2026-cbhe",
        "อว. จับมือ มธ. และสหภาพยุโรป จัดสัมมนา Erasmus+ Thailand 2026",
        PARTNER_NAME,
        "ข่าววันที่ 31 สิงหาคม 2569 ระบุผู้จัดร่วม วันที่และสถานที่จัดงาน และผู้เข้าร่วมมากกว่า 100 คน",
    ),
    (
        "https://fph.tu.ac.th/en/08312026-1/",
        "Thammasat University Co-Hosts Erasmus+ Thailand 2026",
        "คณะสาธารณสุขศาสตร์ มหาวิทยาลัยธรรมศาสตร์",
        "ข่าวสรุปหลังงาน ระบุการร่วมจัดวันที่ 28 สิงหาคม 2026 และรายละเอียดการเสวนาและสร้างเครือข่าย",
    ),
]


def main():
    with database.SessionLocal() as session:
        activity = session.query(models.Activity).filter_by(name=ACTIVITY_NAME).with_for_update().one()
        if activity.date != date(2026, 8, 28):
            raise ValueError("Unexpected event date")
        candidates = session.query(models.Partner).filter(
            models.Partner.name.contains("สำนักงานปลัด"),
            models.Partner.name.contains("อุดมศึกษา"),
        ).all()
        if len(candidates) > 1:
            raise ValueError("Multiple OPS MHESI records; review before linking")
        partner = candidates[0] if candidates else models.Partner(
            name=PARTNER_NAME, type="government", country="Thailand", country_code="TH",
            website_url="https://www.ops.go.th/", is_published=True,
            description="หน่วยงานภาครัฐด้านการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม โดยกองการต่างประเทศร่วมจัดสัมมนา Erasmus+ Thailand 2026 กับมหาวิทยาลัยธรรมศาสตร์และคณะผู้แทนสหภาพยุโรปประจำประเทศไทย",
        )
        if not candidates:
            session.add(partner)
        if activity.partner is not None and activity.partner is not partner:
            raise ValueError("Activity already linked to another partner")
        for url, title, publisher, locator in REFERENCES:
            source = session.query(models.Source).filter_by(source_url=url).one_or_none()
            if source is not None and source.verification_status != "verified":
                raise ValueError("Source exists but is not verified")
            if source is None:
                source = models.Source(
                    source_url=url, source_title=title, source_publisher=publisher,
                    source_type="official_news", source_checked_at=datetime.now(timezone.utc),
                    verification_status="verified", source_locator=locator,
                )
                session.add(source)
            if source not in partner.sources:
                partner.sources.append(source)
            if source not in activity.sources:
                activity.sources.append(source)
        activity.partner = partner
        activity.description = (
            "สัมมนาเพื่อเตรียมสถาบันอุดมศึกษาไทยในการพัฒนาข้อเสนอโครงการ Erasmus+ ประเภท Capacity Building in Higher Education (CBHE)\n\n"
            "ผู้จัดร่วม: กองการต่างประเทศ สำนักงานปลัดกระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม; มหาวิทยาลัยธรรมศาสตร์; คณะผู้แทนสหภาพยุโรปประจำประเทศไทย\n\n"
            "กิจกรรมประกอบด้วยการบรรยาย การเสวนาประสบการณ์โครงการ CBHE การพัฒนาข้อเสนอโครงการ และการสร้างเครือข่ายความร่วมมือ มีผู้เข้าร่วมมากกว่า 100 คนจากสถาบันอุดมศึกษาทั่วประเทศ"
        )
        activity.status = "เสร็จสิ้น"
        activity.date_kind = "event"
        activity.date_precision = "day"
        activity.is_open = False
        # The sources give a lower bound (>100), not an exact headcount.
        session.flush()
        result = {"activityId": activity.id, "partnerId": partner.id,
                  "partnerName": partner.name, "sources": len(activity.sources),
                  "applied": "--apply" in sys.argv}
        if result["applied"]:
            session.commit()
        else:
            session.rollback()
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
