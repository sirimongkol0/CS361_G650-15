"""V4-4 (#89): staff/admin import preview, commit, rollback and CSV exports."""

import csv
import io
import os
import uuid
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

import audit
import auth
import database
import models
import storage
from config import settings
from imports_service import FEEDBACK_COLUMNS, OUTCOME_COLUMNS, process_import_batch

router = APIRouter(prefix="/imports", tags=["imports"])
MANAGER_ROLES = ("staff", "admin")


def _batch_payload(batch: models.ImportBatch, *, include_preview: bool = False) -> dict:
    payload = {
        "id": batch.id,
        "kind": batch.kind,
        "sourceCode": batch.feedback_source.code if batch.feedback_source else None,
        "fileName": batch.file_name,
        "status": batch.status,
        "totalRows": batch.total_rows,
        "validRows": batch.valid_rows,
        "invalidRows": batch.invalid_rows,
        "errors": batch.errors or [],
        "createdAt": batch.created_at.isoformat() if batch.created_at else None,
        "committedAt": batch.committed_at.isoformat() if batch.committed_at else None,
        "rolledBackAt": batch.rolled_back_at.isoformat() if batch.rolled_back_at else None,
    }
    if include_preview:
        payload["previewData"] = batch.preview_data or []
    return payload


def _template_response(kind: str, format: str, sample: bool) -> Response:
    columns = FEEDBACK_COLUMNS if kind == "feedback" else OUTCOME_COLUMNS
    if format == "csv":
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(columns)
        if sample:
            if kind == "feedback":
                writer.writerow(["DEMO-FB-001", "ข้อมูลตัวอย่างสมมติ", "student", "2026-01-15", 5,
                                 "ข้อความสมมติสำหรับทดสอบเท่านั้น", "", 1, "", ""])
            else:
                writer.writerow(["DEMO-OUT-001", "participants", "ผลลัพธ์ตัวอย่างสมมติ",
                                 "ข้อมูลสมมติ ห้ามใช้เป็นข้อมูลจริง", 12, "คน", "2026-01-15", "",
                                 "", 1, "", ""])
        filename = f"{kind}-{'synthetic-example' if sample else 'template'}.csv"
        return Response(
            content=output.getvalue().encode("utf-8-sig"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    try:
        from openpyxl import Workbook
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="เซิร์ฟเวอร์ยังไม่ได้ติดตั้ง openpyxl") from exc
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Import"
    sheet.append(list(columns))
    if sample:
        if kind == "feedback":
            sheet.append(["DEMO-FB-001", "ข้อมูลตัวอย่างสมมติ", "student", "2026-01-15", 5,
                          "ข้อความสมมติสำหรับทดสอบเท่านั้น", None, 1, None, None])
        else:
            sheet.append(["DEMO-OUT-001", "participants", "ผลลัพธ์ตัวอย่างสมมติ",
                          "ข้อมูลสมมติ ห้ามใช้เป็นข้อมูลจริง", 12, "คน", "2026-01-15", None,
                          None, 1, None, None])
    output = io.BytesIO()
    workbook.save(output)
    filename = f"{kind}-{'synthetic-example' if sample else 'template'}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/templates/{kind}")
def download_import_template(
    kind: str,
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    sample: bool = False,
    _user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    if kind not in ("feedback", "outcome"):
        raise HTTPException(status_code=404, detail="ไม่พบประเภทไฟล์นำเข้า")
    return _template_response(kind, format, sample)


@router.get("/")
def list_import_batches(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    batches = db.query(models.ImportBatch).options(joinedload(models.ImportBatch.feedback_source)).order_by(
        models.ImportBatch.created_at.desc(), models.ImportBatch.id.desc()
    ).limit(limit).all()
    return [_batch_payload(batch) for batch in batches]


@router.post("/", status_code=202)
def upload_import_file(
    background_tasks: BackgroundTasks,
    kind: str = Query(..., pattern="^(feedback|outcome)$"),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    filename = os.path.basename(file.filename or "").strip()
    extension = os.path.splitext(filename.lower())[1]
    if extension not in (".csv", ".xlsx"):
        raise HTTPException(status_code=415, detail="รองรับเฉพาะไฟล์ CSV และ XLSX")
    max_bytes = settings.MAX_UPLOAD_BYTES
    data = file.file.read(max_bytes + 1)
    if not data:
        raise HTTPException(status_code=422, detail="ไฟล์ไม่มีข้อมูล")
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"ไฟล์มีขนาดเกิน {max_bytes} ไบต์")

    source = db.query(models.FeedbackSource).filter_by(code="coop_system", is_active=True).first()
    if source is None:
        raise HTTPException(status_code=503, detail="ยังไม่ได้ตั้งค่าแหล่งข้อมูลระบบสหกิจศึกษา")

    safe_name = filename.replace("\\", "_").replace("/", "_")[:180] or f"import{extension}"
    key = f"imports/{uuid.uuid4().hex}/{safe_name}"
    try:
        storage.put_file(key, data)
    except Exception as exc:
        # S3 clients may raise botocore exceptions rather than StorageError.
        raise HTTPException(status_code=502, detail="ไม่สามารถจัดเก็บไฟล์นำเข้าได้") from exc

    batch = models.ImportBatch(
        kind=kind,
        feedback_source_id=source.id,
        file_name=safe_name,
        storage_key=key,
        status="processing",
        total_rows=0,
        valid_rows=0,
        invalid_rows=0,
        errors=[],
        preview_data=[],
        created_by_user_id=user.id,
        created_at=auth.utcnow(),
    )
    db.add(batch)
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage.delete_file(key)
        raise
    db.refresh(batch)
    background_tasks.add_task(process_import_batch, batch.id)
    return _batch_payload(batch)


@router.get("/{batch_id}")
def get_import_batch(
    batch_id: int,
    db: Session = Depends(database.get_db),
    _user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    batch = db.query(models.ImportBatch).options(joinedload(models.ImportBatch.feedback_source)).filter_by(
        id=batch_id
    ).first()
    if batch is None:
        raise HTTPException(status_code=404, detail="ไม่พบชุดนำเข้า")
    return _batch_payload(batch, include_preview=True)


@router.post("/{batch_id}/commit")
def commit_import_batch(
    batch_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    batch = db.query(models.ImportBatch).options(joinedload(models.ImportBatch.feedback_source)).filter_by(
        id=batch_id
    ).with_for_update(of=models.ImportBatch).first()
    if batch is None:
        raise HTTPException(status_code=404, detail="ไม่พบชุดนำเข้า")
    if batch.status != "previewed":
        raise HTTPException(status_code=409, detail="ชุดนำเข้าต้องอยู่ในสถานะ previewed ก่อนยืนยัน")
    preview = batch.preview_data or []
    if not preview:
        raise HTTPException(status_code=409, detail="ไม่มีแถวที่ผ่านการตรวจสอบ จึงไม่สามารถยืนยันได้")

    before = {"status": batch.status, "valid_rows": batch.valid_rows, "invalid_rows": batch.invalid_rows}
    try:
        if batch.kind == "feedback":
            for item in preview:
                duplicate = db.query(models.Feedback.id).filter_by(
                    feedback_source_id=batch.feedback_source_id,
                    external_id=item["external_id"],
                ).first()
                if duplicate:
                    raise HTTPException(status_code=409, detail=f"external_id {item['external_id']} ถูกนำเข้าไปแล้ว")
                db.add(models.Feedback(
                    title=item["title"],
                    source=None,
                    rating=item.get("rating"),
                    date=date.fromisoformat(item["date"]) if item.get("date") else None,
                    status="pending",
                    comment=item.get("comment"),
                    is_published=False,
                    partner_id=item.get("partner_id"),
                    activity_id=item.get("activity_id"),
                    document_id=item.get("document_id"),
                    exchange_id=item.get("exchange_id"),
                    is_legacy=False,
                    respondent_type_id=item["respondent_type_id"],
                    feedback_source_id=batch.feedback_source_id,
                    submitted_by_user_id=None,
                    import_batch_id=batch.id,
                    external_id=item["external_id"],
                ))
        elif batch.kind == "outcome":
            for item in preview:
                duplicate = db.query(models.Outcome.id).filter_by(external_id=item["external_id"]).first()
                if duplicate:
                    raise HTTPException(status_code=409, detail=f"external_id {item['external_id']} ถูกนำเข้าไปแล้ว")
                db.add(models.Outcome(
                    outcome_type_id=item["outcome_type_id"],
                    title=item["title"],
                    description=item.get("description"),
                    value=item.get("value"),
                    unit=item.get("unit"),
                    occurred_on=date.fromisoformat(item["occurred_on"]) if item.get("occurred_on") else None,
                    evidence_url=item.get("evidence_url"),
                    partner_id=item.get("partner_id"),
                    activity_id=item.get("activity_id"),
                    document_id=item.get("document_id"),
                    exchange_id=item.get("exchange_id"),
                    owner_user_id=user.id,
                    import_batch_id=batch.id,
                    external_id=item["external_id"],
                    is_published=False,
                    is_deleted=False,
                    created_at=auth.utcnow(),
                ))
        else:
            raise HTTPException(status_code=409, detail="ประเภทชุดนำเข้าไม่ถูกต้อง")

        batch.status = "committed"
        batch.committed_at = auth.utcnow()
        # The rows now live in their destination tables; discard the duplicate
        # preview copy so free-text comments are not retained twice.
        batch.preview_data = []
        audit.record(db, user, "commit_import", "import_batches", batch.id,
                     before=before, after={"status": batch.status, "imported_rows": len(preview), "kind": batch.kind})
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="พบข้อมูลซ้ำหรือข้อมูลอ้างอิงเปลี่ยนแปลง กรุณาอัปโหลดและตรวจสอบไฟล์ใหม่") from exc
    except Exception:
        db.rollback()
        raise
    db.refresh(batch)
    return _batch_payload(batch)


@router.post("/{batch_id}/rollback")
def rollback_import_batch(
    batch_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role(*MANAGER_ROLES)),
):
    batch = db.query(models.ImportBatch).filter_by(id=batch_id).with_for_update().first()
    if batch is None:
        raise HTTPException(status_code=404, detail="ไม่พบชุดนำเข้า")
    if batch.status == "rolled_back":
        return _batch_payload(batch)
    if batch.status not in ("previewed", "committed"):
        raise HTTPException(status_code=409, detail="ยกเลิกได้เฉพาะชุดที่ตรวจสอบแล้วหรือยืนยันแล้ว")

    before = {"status": batch.status, "valid_rows": batch.valid_rows, "invalid_rows": batch.invalid_rows}
    deleted_rows = 0
    if batch.status == "committed":
        if batch.kind == "feedback":
            deleted_rows = db.query(models.Feedback).filter_by(import_batch_id=batch.id).delete(synchronize_session=False)
        elif batch.kind == "outcome":
            deleted_rows = db.query(models.Outcome).filter_by(import_batch_id=batch.id).delete(synchronize_session=False)
    batch.status = "rolled_back"
    batch.rolled_back_at = auth.utcnow()
    batch.preview_data = []
    audit.record(db, user, "rollback_import", "import_batches", batch.id,
                 before=before, after={"status": batch.status, "deleted_rows": deleted_rows, "kind": batch.kind})
    db.commit()
    db.refresh(batch)
    return _batch_payload(batch)
