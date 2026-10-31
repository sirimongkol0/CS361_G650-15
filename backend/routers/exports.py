"""V4-4 (#89): CSV export endpoints for Feedback and Outcomes."""

import csv
import io
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

import auth
import database
import models


router = APIRouter(
    prefix="/imports/export",
    tags=["exports"],
)

MANAGER_ROLES = ("staff", "admin")


def _csv_safe(value):
    """Prevent spreadsheet formula execution when a CSV is opened in Excel."""
    if value is None:
        return ""

    text = str(value)
    stripped = text.lstrip()

    if stripped.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + text

    return text


def _csv_response(
    filename: str,
    headers: tuple[str, ...],
    rows: list[tuple],
) -> Response:

    output = io.StringIO(newline="")
    writer = csv.writer(output)

    writer.writerow(headers)

    for row in rows:
        writer.writerow([_csv_safe(value) for value in row])

    content = output.getvalue().encode("utf-8-sig")

    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition":
                f"attachment; filename*=UTF-8''{quote(filename)}"
        },
    )


@router.get("/feedback.csv")
def export_feedback_csv(
    source_id: int | None = None,
    respondent_type_id: int | None = None,
    partner_id: int | None = None,
    activity_id: int | None = None,
    document_id: int | None = None,
    exchange_id: int | None = None,
    status: str | None = Query(
        default=None,
        pattern="^(pending|reviewed)$",
    ),
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(
        auth.require_role(*MANAGER_ROLES)
    ),
):
    """Export Feedback records using the selected filters."""

    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail="date_from ต้องไม่อยู่หลัง date_to",
        )

    query = db.query(models.Feedback).options(
        joinedload(models.Feedback.respondent_type),
        joinedload(models.Feedback.feedback_source),
    )

    filters = (
        ("feedback_source_id", source_id),
        ("respondent_type_id", respondent_type_id),
        ("partner_id", partner_id),
        ("activity_id", activity_id),
        ("document_id", document_id),
        ("exchange_id", exchange_id),
        ("status", status),
    )

    for field, value in filters:
        if value is not None:
            query = query.filter(
                getattr(models.Feedback, field) == value
            )

    if date_from:
        query = query.filter(
            models.Feedback.date >= date_from
        )

    if date_to:
        query = query.filter(
            models.Feedback.date <= date_to
        )

    rows = query.order_by(
        models.Feedback.date.desc(),
        models.Feedback.id.desc(),
    ).all()

    headers = (
        "external_id",
        "title",
        "respondent_type_code",
        "date",
        "rating",
        "comment",
        "partner_id",
        "activity_id",
        "document_id",
        "exchange_id",
        "status",
        "feedback_source_code",
    )

    data = [
        (
            row.external_id,
            row.title,
            row.respondent_type.code
            if row.respondent_type else "",
            row.date.isoformat() if row.date else "",
            row.rating,
            row.comment,
            row.partner_id,
            row.activity_id,
            row.document_id,
            row.exchange_id,
            row.status,
            row.feedback_source.code
            if row.feedback_source else "",
        )
        for row in rows
    ]

    return _csv_response(
        "feedback-export.csv",
        headers,
        data,
    )


@router.get("/outcomes.csv")
def export_outcomes_csv(
    outcome_type_id: int | None = None,
    partner_id: int | None = None,
    activity_id: int | None = None,
    document_id: int | None = None,
    exchange_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(
        auth.require_role(*MANAGER_ROLES)
    ),
):
    """Export Outcome records using the selected filters."""

    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail="date_from ต้องไม่อยู่หลัง date_to",
        )

    query = db.query(models.Outcome).options(
        joinedload(models.Outcome.outcome_type)
    ).filter(
        models.Outcome.is_deleted.is_(False)
    )

    filters = (
        ("outcome_type_id", outcome_type_id),
        ("partner_id", partner_id),
        ("activity_id", activity_id),
        ("document_id", document_id),
        ("exchange_id", exchange_id),
    )

    for field, value in filters:
        if value is not None:
            query = query.filter(
                getattr(models.Outcome, field) == value
            )

    if date_from:
        query = query.filter(
            models.Outcome.occurred_on >= date_from
        )

    if date_to:
        query = query.filter(
            models.Outcome.occurred_on <= date_to
        )

    rows = query.order_by(
        models.Outcome.occurred_on.desc(),
        models.Outcome.id.desc(),
    ).all()

    headers = (
        "external_id",
        "outcome_type_code",
        "title",
        "description",
        "value",
        "unit",
        "occurred_on",
        "evidence_url",
        "partner_id",
        "activity_id",
        "document_id",
        "exchange_id",
    )

    data = [
        (
            row.external_id,
            row.outcome_type.code
            if row.outcome_type else "",
            row.title,
            row.description,
            row.value,
            row.unit,
            row.occurred_on.isoformat()
            if row.occurred_on else "",
            row.evidence_url,
            row.partner_id,
            row.activity_id,
            row.document_id,
            row.exchange_id,
        )
        for row in rows
    ]

    return _csv_response(
        "outcomes-export.csv",
        headers,
        data,
    )