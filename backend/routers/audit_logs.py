from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

import database
import models
import schemas
from auth import require_role

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("/", response_model=List[schemas.AuditLogResponse])
def list_audit_logs(
    entity: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(require_role("staff", "admin")),
):
    """Newest-first change history. Read-only: there is no endpoint to edit or delete it."""
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to")
    query = db.query(models.AuditLog).options(joinedload(models.AuditLog.user))
    if entity:
        query = query.filter(models.AuditLog.entity == entity)
    if entity_id is not None:
        query = query.filter(models.AuditLog.entity_id == entity_id)
    if user_id is not None:
        query = query.filter(models.AuditLog.user_id == user_id)
    if action:
        query = query.filter(models.AuditLog.action == action)
    if date_from:
        query = query.filter(models.AuditLog.created_at >= datetime.combine(date_from, time.min, timezone.utc))
    if date_to:
        end = datetime.combine(date_to + timedelta(days=1), time.min, timezone.utc)
        query = query.filter(models.AuditLog.created_at < end)
    rows = query.order_by(models.AuditLog.created_at.desc(), models.AuditLog.id.desc()).offset(offset).limit(limit).all()
    return [
        schemas.AuditLogResponse(
            id=row.id, user_id=row.user_id, user_email=row.user.email if row.user else None,
            action=row.action, entity=row.entity, entity_id=row.entity_id,
            before=row.before, after=row.after, created_at=row.created_at,
        )
        for row in rows
    ]
