from datetime import date, datetime, timezone

import models


def test_activity_exposes_verified_sources_and_date_precision(client, db_session):
    sources = [models.Source(
        source_url=f"https://official.example.test/{status}", source_type="official_news",
        source_checked_at=datetime(2026, 10, 2, tzinfo=timezone.utc),
        verification_status=status,
    ) for status in ("verified", "pending", "rejected")]
    activity = models.Activity(
        name="Seminar with reviewed sources", date=date(2026, 8, 28),
        date_kind="event", date_precision="day", is_published=True, sources=sources,
    )
    db_session.add(activity)
    db_session.commit()
    for path in (f"/api/v1/activities/{activity.id}", "/api/v1/activities/"):
        response = client.get(path)
        assert response.status_code == 200
        body = response.json()
        record = body[0] if isinstance(body, list) else body
        assert record["dateKind"] == "event"
        assert record["datePrecision"] == "day"
        assert [source["sourceUrl"] for source in record["sources"]] == [
            "https://official.example.test/verified"
        ]
