"""Apply the reviewed scope research to matching agreements that have no scope.

Run in the backend environment with the JSON dataset on stdin. Without --apply,
only validate and report. Existing nonempty scopes are never replaced.
"""
import json
import sys
from datetime import datetime, timezone

import database
import models


def main():
    payload = json.load(sys.stdin)
    results = []
    with database.SessionLocal() as session:
        for row in payload["documents"]:
            doc = session.query(models.Document).filter_by(name=row["name"]).with_for_update().one()
            if str(doc.effective_date) != row["effectiveDate"]:
                raise ValueError(f"Agreement date mismatch: {doc.id}")
            if doc.scope_items:
                results.append({"id": doc.id, "status": "already_has_scope"})
                continue
            if not row["items"] or any(not text.strip() for text in row["items"]):
                raise ValueError(f"Empty scope: {doc.id}")
            source = session.query(models.Source).filter_by(source_url=row["url"]).one_or_none()
            if source is not None and source.verification_status != "verified":
                raise ValueError(f"Existing source is not verified: {doc.id}")
            if source is None:
                source = models.Source(
                    source_url=row["url"], source_title=row["title"],
                    source_publisher=row["publisher"], source_type="official_news",
                    verification_status="verified", source_checked_at=datetime.now(timezone.utc),
                    source_locator=payload["method"] + "; " + row["locator"],
                )
                session.add(source)
            else:
                # Keep the original citation locator and append the new research note.
                source.source_locator = (source.source_locator or "") + "; " + payload["method"] + "; " + row["locator"]
                source.source_checked_at = datetime.now(timezone.utc)
            if source not in doc.sources:
                doc.sources.append(source)
            doc.scope_items = [models.DocumentScopeItem(position=i, text=text)
                               for i, text in enumerate(row["items"])]
            results.append({"id": doc.id, "status": "filled", "items": len(row["items"])})
        if "--apply" in sys.argv:
            session.commit()
        else:
            session.rollback()
    print(json.dumps({"applied": "--apply" in sys.argv, "documents": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
