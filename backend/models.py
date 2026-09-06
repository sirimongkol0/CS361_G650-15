from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Text,
    false,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from database import Base


class Partner(Base):
    __tablename__ = "partners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(Text, nullable=True)
    is_published = Column(Boolean, default=False, server_default=false(), nullable=False)
    # --- real-world stakeholder metadata (all nullable -> backwards compatible) ---
    type = Column(String, nullable=True)            # university | government | private_company | nonprofit | alumni_network
    country = Column(String, nullable=True)
    website_url = Column(Text, nullable=True)
    contact_name = Column(String, nullable=True)    # coordinator / liaison
    contact_email = Column(String, nullable=True)

    activities = relationship("Activity", back_populates="partner", passive_deletes=True)
    documents = relationship("Document", back_populates="partner", passive_deletes=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    __table_args__ = (
        CheckConstraint("size_bytes IS NULL OR size_bytes >= 0", name="ck_documents_size_nonnegative"),
        CheckConstraint(
            "expiry_date IS NULL OR effective_date IS NULL OR expiry_date >= effective_date",
            name="ck_documents_date_order",
        ),
    )

    name = Column(String, index=True, nullable=False)
    # Key inside the storage backend (S3 object key or local relative path).
    # The file bytes themselves live in S3/local disk -- never in the database.
    storage_key = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    uploaded_at = Column(DateTime, nullable=True)
    mime_type = Column(String, nullable=True)
    size_bytes = Column(Integer)
    is_published = Column(Boolean, default=False, server_default=false(), nullable=False)
    # --- agreement lifecycle metadata (all nullable -> backwards compatible) ---
    doc_type = Column(String, nullable=True)        # mou | moa | template | announcement
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
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
    mou_activities = relationship(
        "Activity", back_populates="mou_document", passive_deletes=True,
        foreign_keys="Activity.mou_document_id",
    )


class Activity(Base):
    __tablename__ = "activities"

    __table_args__ = (
        CheckConstraint("participants IS NULL OR participants >= 0", name="ck_activities_participants_nonnegative"),
        CheckConstraint(
            "end_date IS NULL OR end_date >= date",
            name="ck_activities_date_order",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    date = Column(Date, index=True, nullable=True)
    description = Column(Text, nullable=True)
    is_published = Column(Boolean, default=False, server_default=false(), nullable=False)
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
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
    mou_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)

    partner = relationship("Partner", back_populates="activities")
    mou_document = relationship(
        "Document", back_populates="mou_activities", foreign_keys=[mou_document_id]
    )


class Feedback(Base):
    """Feedback entries (mock FeedbackEntry / teacherRecentFeedback / adminFeedbackDevelopment)."""

    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="ck_feedbacks_rating_range"),
    )

    title = Column(String, unique=True, index=True, nullable=False)
    source = Column(String, nullable=True)          # participant | alumni | partner | student | coop_system
    rating = Column(Integer, nullable=True)         # 1..5
    date = Column(Date, nullable=True, index=True)
    status = Column(String, nullable=True)          # mock status label (Thai), e.g. "ตรวจสอบแล้ว"
    comment = Column(String, nullable=True)         # free-text comment
    is_published = Column(Boolean, default=False, nullable=False)
    # Optional links back to the partner / activity the feedback is about
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)

    partner = relationship("Partner")
    activity = relationship("Activity")


class ExchangeStudent(Base):
    """Exchange / internship student records (mock ExchangeStudent, pages-B)."""

    __tablename__ = "exchange_students"

    id = Column(Integer, primary_key=True, index=True)
    __table_args__ = (
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="ck_exchange_students_date_order",
        ),
    )

    name = Column(String, index=True, nullable=False)
    type = Column(String, nullable=True)            # outbound | inbound (mock field `type`)
    from_program = Column(String, nullable=True)    # mock field `from` (home program)
    to_organization = Column(String, nullable=True) # mock field `to` (destination)
    start_date = Column(Date, nullable=True)        # period start (mock shows a display string)
    end_date = Column(Date, nullable=True)          # period end
    program = Column(String, nullable=True)         # Student Exchange | Internship | ...
    status = Column(String, nullable=True)          # mock status label (Thai), e.g. "เสร็จสิ้น"
    is_published = Column(Boolean, default=False, nullable=False)
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)

    partner = relationship("Partner")
    activity = relationship("Activity")


class DocumentScopeItem(Base):
    """One cooperation-scope bullet of an agreement (mock documentScope)."""

    __tablename__ = "document_scope_items"

    id = Column(Integer, primary_key=True, index=True)
    __table_args__ = (
        CheckConstraint("position >= 0", name="ck_document_scope_position_nonnegative"),
    )

    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)
    position = Column(Integer, nullable=True)  # display order
    text = Column(Text, nullable=False)

    document = relationship(
        "Document", back_populates="scope_items"
    )


class AdminProfile(Base):
    """Admin/staff profile shown on the Settings page (mock adminProfile)."""

    __tablename__ = "admin_profiles"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=True)
    phone = Column(String, nullable=True)
    position = Column(String, nullable=True)
    department = Column(String, nullable=True)
