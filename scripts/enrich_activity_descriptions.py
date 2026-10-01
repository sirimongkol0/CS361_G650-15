"""Apply researched descriptions from stdin in the backend environment.

The payload must include an expectedDescription for each activity, captured
before editing. Without --apply, validate all records and roll back.
"""
import json
import sys
from datetime import datetime, timezone

import database
import models


def main():
    payload = json.load(sys.stdin)
    rows = payload["activities"]
    ids = [row["id"] for row in rows]
    if not rows or len(ids) != len(set(ids)):
        raise ValueError("Expected a nonempty set of unique activity IDs")
    results = []
    with database.SessionLocal() as session:
        activities = {
            item.id: item for item in session.query(models.Activity)
            .filter(models.Activity.id.in_(ids))
            .order_by(models.Activity.id).with_for_update().all()
        }
        if set(activities) != set(ids):
            raise ValueError("One or more activities no longer exist")
        for row in rows:
            item = activities[row["id"]]
            if (not item.is_published or item.name != row["name"]
                    or str(item.date) != row["date"]):
                raise ValueError(f"Activity identity changed: {item.id}")
            paragraphs = row["paragraphs"]
            if len(paragraphs) < 3 or any(not p.strip() for p in paragraphs):
                raise ValueError(f"Expected at least three nonempty paragraphs: {item.id}")
            description = "\n\n".join(p.strip() for p in paragraphs)
            if item.description == description:
                results.append({"id": item.id, "status": "already_updated"})
                continue
            if item.description != row["expectedDescription"]:
                raise ValueError(f"Description changed since snapshot: {item.id}")
            if len(description) <= len(item.description or ""):
                raise ValueError(f"Description was not expanded: {item.id}")
            if not row["url"].startswith("https://") or not row["locator"].strip():
                raise ValueError(f"Invalid reference: {item.id}")
            source = session.query(models.Source).filter_by(source_url=row["url"]).one_or_none()
            if source is not None and source.verification_status != "verified":
                raise ValueError(f"Existing source is not verified: {item.id}")
            if source is None:
                source = models.Source(
                    source_url=row["url"], source_title=row["title"],
                    source_publisher=row["publisher"], source_type="official_news",
                    verification_status="verified", source_checked_at=datetime.now(timezone.utc),
                    source_locator=row["locator"],
                )
                session.add(source)
            if source not in item.sources:
                item.sources.append(source)
            item.description = description
            results.append({"id": item.id, "status": "expanded", "characters": len(description)})
        session.flush()
        if "--apply" in sys.argv:
            session.commit()
        else:
            session.rollback()
    print(json.dumps({"applied": "--apply" in sys.argv, "activities": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
