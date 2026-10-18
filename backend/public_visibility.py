"""Shared eligibility rules for public records and relationship targets."""
from datetime import datetime, timezone

from sqlalchemy import func, or_
import models


def has_verified_source(record) -> bool:
    return any(source.verification_status == "verified" for source in record.sources)


def attach_verified_source(db, record, url: str, title: str) -> models.Source:
    """Attach a staff-checked https source to a partner/document (reusing a known URL).

    Public pages list only records with a verified source; this is how staff
    provide one from the web (V3-7).
    """
    source = db.query(models.Source).filter(models.Source.source_url == url).first()
    if source is None:
        source = models.Source(source_url=url, source_title=title, source_type="staff_verified",
                               source_checked_at=datetime.now(timezone.utc))
        db.add(source)
    source.verification_status = "verified"
    source.source_checked_at = datetime.now(timezone.utc)
    if source not in record.sources:
        record.sources.append(source)
    return source


def partner_criteria():
    return (
        models.Partner.is_published.is_(True),
        func.length(func.trim(models.Partner.name)) > 0,
        func.length(func.trim(models.Partner.type)) > 0,
        func.length(func.trim(models.Partner.description)) > 0,
        func.length(func.trim(models.Partner.website_url)) > 0,
        models.Partner.country_code.is_not(None),
        models.Partner.sources.any(models.Source.verification_status == "verified"),
    )


def document_criteria():
    return (
        models.Document.is_published.is_(True),
        models.Document.is_deleted.is_(False),
        models.Document.cstu_status == "keep",
        func.length(func.trim(models.Document.name)) > 0,
        models.Document.document_kind.is_not(None),
        models.Document.file_availability.is_not(None),
        or_(models.Document.file_availability != "available", models.Document.storage_key.is_not(None)),
        models.Document.sources.any(models.Source.verification_status == "verified"),
    )
