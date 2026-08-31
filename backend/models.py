from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base


class Partner(Base):
    __tablename__ = "partners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    is_published = Column(Boolean, default=False)
    # --- real-world stakeholder metadata (all nullable -> backwards compatible) ---
    type = Column(String, nullable=True)            # university | government | private_company | nonprofit | alumni_network
    country = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    contact_name = Column(String, nullable=True)    # coordinator / liaison
    contact_email = Column(String, nullable=True)

    activities = relationship("Activity", back_populates="partner")
    documents = relationship("Document", back_populates="partner")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    # Key inside the storage backend (S3 object key or local relative path).
    # The file bytes themselves live in S3/local disk -- never in the database.
    storage_key = Column(String, unique=True)
    mime_type = Column(String, default="application/pdf")
    size_bytes = Column(Integer)
    is_published = Column(Boolean, default=False)
    # --- agreement lifecycle metadata (all nullable -> backwards compatible) ---
    doc_type = Column(String, nullable=True)        # mou | moa | template | announcement
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)
    effective_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    # --- frontend mock (pages-C) coverage: all nullable -> backwards compatible ---
    responsible = Column(String, nullable=True)     # MockDocument.responsible / documentInfoRows
    status = Column(String, nullable=True)          # active | expiring | expired | draft
    signer_our = Column(String, nullable=True)      # documentInfoRows "ผู้ลงนาม (ฝ่ายเรา)"
    signer_partner = Column(String, nullable=True)  # documentInfoRows "ผู้ลงนาม (หน่วยงาน)"

    partner = relationship("Partner", back_populates="documents")
    # Mock-coverage children (document detail page)
    scope_items = relationship(
        "DocumentScopeItem", back_populates="document",
        order_by="DocumentScopeItem.position", cascade="all, delete-orphan",
    )
    timeline_steps = relationship(
        "DocumentTimelineStep", back_populates="document",
        order_by="DocumentTimelineStep.position", cascade="all, delete-orphan",
    )


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    date = Column(Date, index=True)
    description = Column(String, nullable=True)
    is_published = Column(Boolean, default=False)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)
    # --- activity classification (nullable -> backwards compatible) ---
    activity_type = Column(String, nullable=True)   # exchange | internship | cooperative_education | academic_event | workshop
    # --- frontend mock (pages-C) coverage: all nullable -> backwards compatible ---
    end_date = Column(Date, nullable=True)          # period end (mock shows ranges like "Feb-May 2568")
    participants = Column(Integer, nullable=True)   # MockActivity.participants
    location = Column(String, nullable=True)        # StudentUpcomingActivity.location / activityInfoRows
    time = Column(String, nullable=True)            # display string, e.g. "09:00 - 17:00" (activityInfoRows)
    status = Column(String, nullable=True)          # mock status label, stored verbatim (Thai), e.g. "เสร็จสิ้น"
    is_open = Column(Boolean, nullable=True)        # PublicActivity.open (open for registration)
    # MoU/MoA backing this activity (MockActivity.mou / mouDocId) -> documents.id
    mou_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)

    partner = relationship("Partner", back_populates="activities")
    mou_document = relationship("Document", foreign_keys=[mou_document_id])


class Feedback(Base):
    """Feedback entries (mock FeedbackEntry / teacherRecentFeedback / adminFeedbackDevelopment)."""

    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    source = Column(String, nullable=True)          # participant | alumni | partner | student | coop_system
    rating = Column(Integer, nullable=True)         # 1..5
    date = Column(Date, nullable=True, index=True)
    status = Column(String, nullable=True)          # mock status label (Thai), e.g. "ตรวจสอบแล้ว"
    comment = Column(String, nullable=True)         # free-text comment
    is_published = Column(Boolean, default=False)
    # Optional links back to the partner / activity the feedback is about
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)
    activity_id = Column(Integer, ForeignKey("activities.id"), nullable=True)

    partner = relationship("Partner")
    activity = relationship("Activity")


class ExchangeStudent(Base):
    """Exchange / internship student records (mock ExchangeStudent, pages-B)."""

    __tablename__ = "exchange_students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(String, nullable=True)            # outbound | inbound (mock field `type`)
    from_program = Column(String, nullable=True)    # mock field `from` (home program)
    to_organization = Column(String, nullable=True) # mock field `to` (destination)
    start_date = Column(Date, nullable=True)        # period start (mock shows a display string)
    end_date = Column(Date, nullable=True)          # period end
    program = Column(String, nullable=True)         # Student Exchange | Internship | ...
    status = Column(String, nullable=True)          # mock status label (Thai), e.g. "เสร็จสิ้น"
    is_published = Column(Boolean, default=False)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)
    activity_id = Column(Integer, ForeignKey("activities.id"), nullable=True)

    partner = relationship("Partner")
    activity = relationship("Activity")


class DocumentScopeItem(Base):
    """One cooperation-scope bullet of an agreement (mock documentScope)."""

    __tablename__ = "document_scope_items"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    position = Column(Integer, default=0)           # display order
    text = Column(String, nullable=False)

    document = relationship(
        "Document", back_populates="scope_items"
    )


class DocumentTimelineStep(Base):
    """Agreement lifecycle step (mock documentTimeline: Draft -> Review -> Signed -> Active -> Renewal)."""

    __tablename__ = "document_timeline_steps"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    position = Column(Integer, default=0)           # display order
    label = Column(String)                          # Draft | Review | Signed | Active | Renewal
    date = Column(Date, nullable=True)
    done = Column(Boolean, default=False)
    current = Column(Boolean, default=False)

    document = relationship(
        "Document", back_populates="timeline_steps"
    )


class AdminProfile(Base):
    """Admin/staff profile shown on the Settings page (mock adminProfile)."""

    __tablename__ = "admin_profiles"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    position = Column(String, nullable=True)
    department = Column(String, nullable=True)
