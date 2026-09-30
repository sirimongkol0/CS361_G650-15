"""Shared eligibility rules for public records and relationship targets."""
from sqlalchemy import func, or_
import models


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
        func.length(func.trim(models.Document.name)) > 0,
        models.Document.document_kind.is_not(None),
        models.Document.file_availability.is_not(None),
        or_(models.Document.file_availability != "available", models.Document.storage_key.is_not(None)),
        models.Document.sources.any(models.Source.verification_status == "verified"),
    )
