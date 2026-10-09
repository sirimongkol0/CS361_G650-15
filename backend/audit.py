"""Audit log helper (V3-5): call ``record`` from every endpoint that writes data.

    before = audit.snapshot(partner)
    partner.name = body.name
    audit.record(db, user, "update", "partners", partner.id, before=before, after=audit.snapshot(partner))
    db.commit()   # the change and its audit row are saved together

``record`` only adds the row to the session; the caller's commit saves both, and
a rollback discards both, so history always matches the data.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterable, Optional

from sqlalchemy import inspect
from sqlalchemy.orm import Session

import auth
import models

REDACTED = "[redacted]"
# Field names that must never be stored, matched as substrings (case-insensitive).
SECRET_MARKERS = ("password", "token", "secret", "jti")


def _is_secret(key: str) -> bool:
    lowered = key.lower()
    return any(marker in lowered for marker in SECRET_MARKERS)


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): (REDACTED if _is_secret(str(k)) else _json_safe(v)) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bytes):
        return f"<{len(value)} bytes>"
    return value


def snapshot(obj: Any, exclude: Iterable[str] = ()) -> dict:
    """JSON-safe dict of a model row's column values (secrets redacted)."""
    skip = set(exclude)
    columns = inspect(obj).mapper.column_attrs
    return _json_safe({c.key: getattr(obj, c.key) for c in columns if c.key not in skip})


def record(
    db: Session,
    user: Optional[models.User],
    action: str,
    entity: str,
    entity_id: Optional[int] = None,
    *,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
) -> models.AuditLog:
    """Add an audit row to ``db`` (not committed). ``user`` is the signed-in user from ``require_role``."""
    if not action or not entity:
        raise ValueError("audit.record needs a non-empty action and entity")
    row = models.AuditLog(
        user_id=user.id if user is not None else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before=_json_safe(before) if before is not None else None,
        after=_json_safe(after) if after is not None else None,
        created_at=auth.utcnow(),
    )
    db.add(row)
    return row
