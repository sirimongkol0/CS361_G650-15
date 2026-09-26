from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import List, Optional

from database import get_db
import models
import schemas

router = APIRouter(
    prefix="/api/partners", 
    tags=["Partners & Stakeholders"],
)

# /api/stakeholders เพื่อรองรับทั้ง 2 Endpoints
stakeholders_router = APIRouter(
    prefix="/api/stakeholders",
    tags=["Partners & Stakeholders"],
)


@router.get("/", response_model=List[schemas.PartnerResponse])
def list_published_partners(db: Session = Depends(get_db)):
    """List all published partners."""
    partners = db.query(models.Partner).filter(
        models.Partner.is_published.is_(True)
    ).all()
    return partners

@router.get("", response_model=schemas.PartnerListResponse,)
@stakeholders_router.get("", response_model=schemas.PartnerListResponse)
def get_partners(
    search: Optional[str] = Query(None, description="ค้นหาจากชื่อหน่วยงาน หรือรายละเอียด"),
    category: Optional[str] = Query(None, description="กรองตามประเภทหน่วยงาน"),
    country: Optional[str] = Query(None, description="กรองตามประเทศ"),
    page: int = Query(1, ge=1, description="หมายเลขหน้า"),
    size: int = Query(20, ge=1, le=100, description="จำนวนรายการต่อหน้า"),
    db: Session = Depends(get_db)
):
    
    """
    เรียกดูรายการหน่วยงานคู่ความร่วมมือและผู้ประสานงานจาก DB จริง
    - กรองเฉพาะรายการที่เผยแพร่แล้ว (is_published = True) ตามเกณฑ์ V1/V2
    - ค้นหาชื่อ/รายละเอียด และกรองประเภท/ประเทศได้
    - ซ่อนข้อมูลผู้ประสานงานที่ไม่ได้รับอนุญาต (is_public = False)
    """
    # 1. Base Query: เฉพาะรายการที่เผยแพร่แล้ว
    query = db.query(models.Partner).options(
        joinedload(models.Partner.contacts)
    ).filter(models.Partner.is_published == True)

    # 2. Apply Search Filter (ค้นหาแบบ Case-insensitive)
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Partner.name.ilike(search_term),
                models.Partner.description.ilike(search_term)
            )
        )

    # 3. Apply Category Filter
    if category and category.strip():
        query = query.filter(models.Partner.category == category.strip())

    # 4. Apply Country Filter
    if country and country.strip():
        query = query.filter(models.Partner.country == country.strip())

    # 5. Count Total Matching Items
    total = query.count()

    # 6. Pagination
    offset = (page - 1) * size
    partners = query.order_by(models.Partner.id.asc()).offset(offset).limit(size).all()

    # 7. Privacy Filter: กรองผู้ประสานงานเฉพาะคนที่อนุญาตให้เผยแพร่ (is_public == True)
    result_items = []
    for partner in partners:
        public_contacts = [
            c for c in (partner.contacts or [])
            if getattr(c, "is_public", True)
        ]
        
        partner_dict = {
            "id": partner.id,
            "name": partner.name,
            "category": partner.category,
            "country": partner.country,
            "description": partner.description,
            "website_url": getattr(partner, "website_url", getattr(partner, "website", None)),
            "logo_url": partner.logo_url,
            "is_published": partner.is_published,
            "created_at": getattr(partner, "created_at", None),
            "updated_at": getattr(partner, "updated_at", None),
            "contacts": public_contacts
        }
        result_items.append(partner_dict)

    return {
        "items": result_items,
        "total": total,
        "page": page,
        "size": size
    }


@router.get("/{partner_id}", response_model=schemas.PartnerDetailResponse)
@stakeholders_router.get("/{partner_id}", response_model=schemas.PartnerDetailResponse)
def get_partner_detail(
    partner_id: int,
    db: Session = Depends(get_db)
):
    """
    เรียกดูรายละเอียดหน่วยงานคู่ความร่วมมือรายตัว
    - คืนค่า 404 Not Found หากไม่พบ ID หรือเป็นรายการที่ยังไม่เผยแพร่
    - ซ่อนข้อมูลผู้ประสานงานที่ไม่ได้รับอนุญาต (is_public = False)
    """
    partner = db.query(models.Partner).options(
        joinedload(models.Partner.contacts)
    ).filter(
        models.Partner.id == partner_id,
        models.Partner.is_published == True
    ).first()

    # 404 Not Found กรณีไม่พบข้อมูล หรือรายการยังไม่เผยแพร่
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ไม่พบข้อมูลหน่วยงานรหัส {partner_id} หรือรายการยังไม่ถูกเผยแพร่"
        )

    # Privacy Filter: กรองผู้ประสานงานเฉพาะคนที่อนุญาตให้เผยแพร่
    public_contacts = [
        c for c in (partner.contacts or [])
        if getattr(c, "is_public", True)
    ]

    return {
        "id": partner.id,
        "name": partner.name,
        "category": partner.category,
        "country": partner.country,
        "description": partner.description,
        "website_url": getattr(partner, "website_url", getattr(partner, "website", None)),
        "logo_url": partner.logo_url,
        "is_published": partner.is_published,
        "created_at": getattr(partner, "created_at", None),
        "updated_at": getattr(partner, "updated_at", None),
        "contacts": public_contacts
    }


