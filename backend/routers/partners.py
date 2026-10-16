from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Literal, Optional

import audit
import auth
import database
import models
import schemas
from public_visibility import partner_criteria

router = APIRouter(prefix="/partners", tags=["partners"])


def _optional_user(
    credentials=Depends(auth._bearer_scheme),
    db: Session = Depends(database.get_db),
) -> Optional[models.User]:
    """ดึงข้อมูลผู้ใช้งานถ้ามี Token หากไม่มีจะส่งคืน None (สำหรับ Public)"""
    if not credentials:
        return None
    try:
        claims = auth.decode_token(credentials.credentials, "access")
        if db.get(models.RevokedToken, claims["jti"]) is not None:
            return None
        user = db.query(models.User).filter(models.User.cognito_sub == claims["sub"]).first()
        if user and user.is_active:
            return user
    except Exception:
        pass
    return None


def _response(partner: models.Partner, current_user: Optional[models.User] = None):
    result = schemas.PartnerResponse.model_validate(partner)
    # หากไม่ได้ระบุให้เปิดเผย และไม่ใช่ Staff/Admin/Owner ให้ปิดซ่อนข้อมูลผู้ติดต่อ
    is_privileged = current_user and (
        current_user.role in ("staff", "admin") or partner.owner_user_id == current_user.id
    )
    if not partner.contact_is_public and not is_privileged:
        result.contactName = None
        result.contactEmail = None

    if hasattr(partner, "sources") and partner.sources:
        result.sources = [
            schemas.SourceResponse.model_validate(source)
            for source in partner.sources
            if source.verification_status == "verified"
        ]
    return result


def _validate_organization(db: Session, organization_id: Optional[int]) -> None:
    if organization_id is None:
        return
    organization = db.query(models.Partner).filter(
        models.Partner.id == organization_id,
        models.Partner.is_deleted == False,
    ).first()
    if organization is None:
        raise HTTPException(status_code=400, detail="Referenced organization does not exist")


@router.get("/", response_model=List[schemas.PartnerResponse])
def list_partners(
    search: Optional[str] = None,
    partner_type: Optional[str] = None,
    country: Optional[str] = None,
    scope_level: Optional[Literal["program", "faculty", "university"]] = None,
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(_optional_user),
):
    """รายการ Partner ตามสิทธิ์:
    - public/student: เห็นเฉพาะที่ is_published=True และผ่าน partner_criteria()
    - coordinator: เห็นรายการเผยแพร่ + รายการฉบับร่างที่ตนเองเป็นเจ้าของ (owner_user_id)
    - staff/admin: เห็นทั้งหมด
    """
    query = db.query(models.Partner).options(
        selectinload(models.Partner.sources)
    ).filter(models.Partner.is_deleted == False)

    # การกรองตามสิทธิ์ (Visibility)
    if not current_user or current_user.role in ("public", "student"):
        query = query.filter(*partner_criteria())
    elif current_user.role == "coordinator":
        query = query.filter(
            (models.Partner.is_published == True) | (models.Partner.owner_user_id == current_user.id)
        )
    # staff และ admin เห็นทั้งหมดโดยอัตโนมัติ

    if search and search.strip():
        query = query.filter(models.Partner.name.ilike(f"%{search.strip()}%"))
    if partner_type:
        query = query.filter(models.Partner.type == partner_type)
    if country:
        query = query.filter(models.Partner.country == country)
    if scope_level:
        query = query.filter(models.Partner.scope_level == scope_level)

    partners = query.order_by(models.Partner.id.asc()).all()
    return [_response(p, current_user) for p in partners]


@router.get(
    "/{partner_id}",
    response_model=schemas.PartnerResponse,
    responses={404: {"model": schemas.ErrorResponse}},
)
def get_partner(
    partner_id: int,
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(_optional_user),
):
    """ดึงข้อมูล Partner ตาม ID"""
    query = db.query(models.Partner).options(
        selectinload(models.Partner.sources)
    ).filter(models.Partner.id == partner_id, models.Partner.is_deleted == False)

    if not current_user or current_user.role in ("public", "student"):
        query = query.filter(*partner_criteria())
    elif current_user.role == "coordinator":
        query = query.filter(
            (models.Partner.is_published == True) | (models.Partner.owner_user_id == current_user.id)
        )

    partner = query.first()
    if partner is None:
        raise HTTPException(status_code=404, detail="Partner not found")

    return _response(partner, current_user)


@router.get("/{partner_id}/logo", responses={404: {"model": schemas.ErrorResponse}})
def get_partner_logo(partner_id: int, request: Request, db: Session = Depends(database.get_db)):
    """Serve รูป Logo ของ Partner"""
    logo = db.query(models.PartnerLogo).join(
        models.Partner, models.Partner.id == models.PartnerLogo.partner_id
    ).filter(
        models.PartnerLogo.partner_id == partner_id,
        models.Partner.is_deleted == False,
        *partner_criteria(),
    ).first()

    if logo is None:
        raise HTTPException(status_code=404, detail="Logo not found")

    etag = f'"{partner_id}-{int(logo.updated_at.timestamp())}"'
    headers = {"Cache-Control": "no-cache", "ETag": etag}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=logo.data, media_type=logo.mime_type, headers=headers)


@router.post(
    "/",
    response_model=schemas.PartnerResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": schemas.ErrorResponse},
        401: {"model": schemas.ErrorResponse},
        403: {"model": schemas.ErrorResponse},
    },
)
def create_partner(
    body: schemas.PartnerCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    """สร้าง Partner/ผู้ประสานงานใหม่ (สิทธิ์: coordinator, staff, admin)"""
    if user.role == "coordinator" and body.is_published:
        raise HTTPException(status_code=403, detail="Only staff and admin can publish partners")

    # ตรวจสอบชื่อซ้ำ (Name uniqueness validation)
    existing = db.query(models.Partner).filter(
        models.Partner.name == body.name,
        models.Partner.is_deleted == False,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Partner name already exists")

    # ตรวจสอบการผูกองค์กรกรณีเป็นผู้ประสานงาน
    _validate_organization(db, body.organization_id)

    partner = models.Partner(
        name=body.name,
        description=body.description,
        logo_url=body.logo_url,
        type=body.type,
        country=body.country,
        country_code=body.country_code,
        website_url=body.website_url,
        contact_name=body.contact_name,
        contact_email=body.contact_email,
        contact_is_public=body.contact_is_public,
        scope_level=body.scope_level,
        is_published=body.is_published,
        organization_id=body.organization_id,
        owner_user_id=user.id,  # บันทึกผู้รับผิดชอบ
        is_deleted=False,
    )
    db.add(partner)
    db.flush()  # เพื่อสร้าง partner.id

    audit.record(db, user, "create", "partners", partner.id, after=audit.snapshot(partner))
    db.commit()
    db.refresh(partner)
    return _response(partner, user)


@router.put(
    "/{partner_id}",
    response_model=schemas.PartnerResponse,
    responses={
        400: {"model": schemas.ErrorResponse},
        401: {"model": schemas.ErrorResponse},
        403: {"model": schemas.ErrorResponse},
        404: {"model": schemas.ErrorResponse},
    },
)
def update_partner(
    partner_id: int,
    body: schemas.PartnerUpdate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("coordinator", "staff", "admin")),
):
    """แก้ไขข้อมูล Partner (Coordinator แก้ได้เฉพาะรายการของตนเอง)"""
    partner = db.query(models.Partner).filter(
        models.Partner.id == partner_id,
        models.Partner.is_deleted == False,
    ).first()

    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    # เช็กสิทธิ์เฉพาะรายการที่รับผิดชอบสำหรับ Coordinator
    if user.role == "coordinator" and partner.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this record")

    # ตรวจสอบชื่อซ้ำหากมีการเปลี่ยนชื่อ
    if body.name and body.name != partner.name:
        existing = db.query(models.Partner).filter(
            models.Partner.name == body.name,
            models.Partner.id != partner_id,
            models.Partner.is_deleted == False,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Partner name already exists")

    update_data = body.model_dump(exclude_unset=True)
    if user.role == "coordinator" and "is_published" in update_data:
        raise HTTPException(status_code=403, detail="Only staff and admin can publish partners")
    if "organization_id" in update_data:
        _validate_organization(db, update_data["organization_id"])

    before_snapshot = audit.snapshot(partner)

    # อัปเดตข้อมูลเฉพาะฟิลด์ที่ส่งมา
    for key, value in update_data.items():
        setattr(partner, key, value)

    audit.record(db, user, "update", "partners", partner.id, before=before_snapshot, after=audit.snapshot(partner))
    db.commit()
    db.refresh(partner)
    return _response(partner, user)


@router.delete(
    "/{partner_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": schemas.ErrorResponse},
        403: {"model": schemas.ErrorResponse},
        404: {"model": schemas.ErrorResponse},
    },
)
def delete_partner(
    partner_id: int,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(auth.require_role("staff", "admin")),
):
    """ลบ Partner แบบ Soft Delete (สิทธิ์เฉพาะ staff และ admin)"""
    partner = db.query(models.Partner).filter(
        models.Partner.id == partner_id,
        models.Partner.is_deleted == False,
    ).first()

    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    before_snapshot = audit.snapshot(partner)

    # ทำ Soft Delete
    partner.is_deleted = True
    partner.deleted_at = auth.utcnow()

    audit.record(db, user, "delete", "partners", partner.id, before=before_snapshot, after=audit.snapshot(partner))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
