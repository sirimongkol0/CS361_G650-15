from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Text,
    false,
    true,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Table,
)
from sqlalchemy.orm import relationship
from database import Base


partner_sources = Table(
    "partner_sources", Base.metadata,
    Column("partner_id", Integer, ForeignKey("partners.id", ondelete="CASCADE"), primary_key=True),
    Column("source_id", Integer, ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True),
)
activity_sources = Table(
    "activity_sources", Base.metadata,
    Column("activity_id", Integer, ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True),
    Column("source_id", Integer, ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True),
)
document_sources = Table(
    "document_sources", Base.metadata,
    Column("document_id", Integer, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("source_id", Integer, ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True),
)

# Shared by partners/documents/activities; the constraint name is per table.
SCOPE_LEVELS = ("program", "faculty", "university")
SCOPE_LEVEL_CHECK = "scope_level IS NULL OR scope_level IN ('program', 'faculty', 'university')"


class Source(Base):
    """A dated, reviewable citation used to support a published record."""

    __tablename__ = "sources"
    __table_args__ = (
        CheckConstraint("source_url LIKE 'https://%'", name="ck_sources_https_url"),
        CheckConstraint(
            "verification_status IN ('pending', 'verified', 'rejected')",
            name="ck_sources_verification_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_url = Column(Text, nullable=False, unique=True)
    source_title = Column(String, nullable=True)
    source_publisher = Column(String, nullable=True)
    source_type = Column(String, nullable=False)
    source_checked_at = Column(DateTime(timezone=True), nullable=False)
    source_locator = Column(Text, nullable=True)
    verification_status = Column(String, nullable=False, default="pending", server_default="pending")

    partners = relationship("Partner", secondary=partner_sources, back_populates="sources")
    activities = relationship("Activity", secondary=activity_sources, back_populates="sources")
    documents = relationship("Document", secondary=document_sources, back_populates="sources")


class Partner(Base):
    __tablename__ = "partners"
    __table_args__ = (
        CheckConstraint(
            "country_code IS NULL OR (length(country_code) = 2 AND country_code = upper(country_code))",
            name="ck_partners_country_code_iso2",
        ),
        CheckConstraint(SCOPE_LEVEL_CHECK, name="ck_partners_scope_level"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(Text, nullable=True)
    is_published = Column(Boolean, default=False, server_default=false(), nullable=False)
    # --- real-world stakeholder metadata (all nullable -> backwards compatible) ---
    # Allowed values: docs/api/v2-field-contract.md (labels in frontend/src/lib/labels.ts)
    type = Column(String, nullable=True)            # university | government | private_company | network | vocational | healthcare | international_organization
    country = Column(String, nullable=True)         # English short name, one spelling per country_code
    country_code = Column(String(2), nullable=True)
    website_url = Column(Text, nullable=True)
    contact_name = Column(String, nullable=True)    # coordinator / liaison
    contact_email = Column(String, nullable=True)
    # Contact publication requires explicit approval, independently of the partner.
    contact_is_public = Column(Boolean, default=False, server_default=false(), nullable=False)
    # Cooperation level: program | faculty | university; NULL = not yet classified.
    scope_level = Column(String, nullable=True)

    activities = relationship("Activity", back_populates="partner", passive_deletes=True)
    documents = relationship("Document", back_populates="partner", passive_deletes=True)
    sources = relationship("Source", secondary=partner_sources, back_populates="partners")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    __table_args__ = (
        CheckConstraint("size_bytes IS NULL OR size_bytes >= 0", name="ck_documents_size_nonnegative"),
        CheckConstraint(
            "expiry_date IS NULL OR effective_date IS NULL OR expiry_date >= effective_date",
            name="ck_documents_date_order",
        ),
        CheckConstraint(
            "document_kind IS NULL OR document_kind IN ('agreement', 'template', 'procedure', 'announcement', 'other')",
            name="ck_documents_kind",
        ),
        CheckConstraint(
            "file_availability IS NULL OR file_availability IN ('available', 'metadata_only', 'unavailable')",
            name="ck_documents_file_availability",
        ),
        CheckConstraint(
            "file_availability IS NULL OR file_availability != 'available' OR storage_key IS NOT NULL",
            name="ck_documents_available_file_has_storage_key",
        ),
        CheckConstraint(SCOPE_LEVEL_CHECK, name="ck_documents_scope_level"),
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
    document_kind = Column(String, nullable=True)   # agreement | template | procedure | announcement | other
    file_availability = Column(String, nullable=True)  # available | metadata_only | unavailable
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    effective_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    # --- agreement detail fields: all nullable -> backwards compatible ---
    responsible = Column(String, nullable=True)     # person responsible for the agreement
    status = Column(String, nullable=True)          # active | expiring | expired | draft (must agree with expiry_date)
    signer_our = Column(String, nullable=True)      # "ผู้ลงนาม (ฝ่ายเรา)"
    signer_partner = Column(String, nullable=True)  # "ผู้ลงนาม (หน่วยงาน)"
    scope_level = Column(String, nullable=True)     # program | faculty | university (NULL = not yet classified)

    partner = relationship("Partner", back_populates="documents")
    sources = relationship("Source", secondary=document_sources, back_populates="documents")
    # Document detail children
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
        CheckConstraint(
            "date_kind IS NULL OR date_kind IN ('event', 'announcement', 'deadline', 'application_open', 'application_close', 'period_start', 'period_end')",
            name="ck_activities_date_kind",
        ),
        CheckConstraint(
            "date_precision IS NULL OR date_precision IN ('day', 'month', 'year', 'approximate')",
            name="ck_activities_date_precision",
        ),
        CheckConstraint(
            "date IS NOT NULL OR (date_kind IS NULL AND date_precision IS NULL)",
            name="ck_activities_date_semantics_require_date",
        ),
        CheckConstraint(SCOPE_LEVEL_CHECK, name="ck_activities_scope_level"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    date = Column(Date, index=True, nullable=True)
    description = Column(Text, nullable=True)
    is_published = Column(Boolean, default=False, server_default=false(), nullable=False)
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    # --- activity classification (nullable -> backwards compatible) ---
    activity_type = Column(String, nullable=True)   # official_event | collaboration_meeting | exchange | seminar | ... (see field contract)
    date_kind = Column(String, nullable=True)       # event | announcement | deadline | application_open | application_close | period_start | period_end
    date_precision = Column(String, nullable=True)  # day | month | year | approximate
    # --- activity detail fields: all nullable -> backwards compatible ---
    end_date = Column(Date, nullable=True)          # period end for multi-day activities
    participants = Column(Integer, nullable=True)   # participant count
    location = Column(String, nullable=True)        # venue
    time = Column(String, nullable=True)            # display string, e.g. "09:00 - 17:00"
    status = Column(String, nullable=True)          # Thai display label: วางแผน | กำลังดำเนินการ | เสร็จสิ้น
    is_open = Column(Boolean, nullable=True)        # open for registration
    scope_level = Column(String, nullable=True)     # program | faculty | university (NULL = not yet classified)
    # MoU/MoA backing this activity -> documents.id
    mou_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)

    partner = relationship("Partner", back_populates="activities")
    mou_document = relationship(
        "Document", back_populates="mou_activities", foreign_keys=[mou_document_id]
    )
    sources = relationship("Source", secondary=activity_sources, back_populates="activities")


class Feedback(Base):
    """Feedback entries shown on the Feedback page and dashboards."""

    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="ck_feedbacks_rating_range"),
    )

    title = Column(String, unique=True, index=True, nullable=False)
    source = Column(String, nullable=True)          # participant | alumni | partner | student | coop_system
    rating = Column(Integer, nullable=True)         # 1..5
    date = Column(Date, nullable=True, index=True)
    status = Column(String, nullable=True)          # Thai status label, e.g. "ตรวจสอบแล้ว"
    comment = Column(String, nullable=True)         # free-text comment
    is_published = Column(Boolean, default=False, nullable=False)
    # Optional links back to the partner / activity the feedback is about
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)

    partner = relationship("Partner")
    activity = relationship("Activity")


class ExchangeStudent(Base):
    """Exchange / internship student records."""

    __tablename__ = "exchange_students"

    id = Column(Integer, primary_key=True, index=True)
    __table_args__ = (
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="ck_exchange_students_date_order",
        ),
    )

    name = Column(String, index=True, nullable=False)
    type = Column(String, nullable=True)            # outbound | inbound
    from_program = Column(String, nullable=True)    # home program (outbound) or partner (inbound)
    to_organization = Column(String, nullable=True) # destination
    start_date = Column(Date, nullable=True)        # period start
    end_date = Column(Date, nullable=True)          # period end
    program = Column(String, nullable=True)         # Student Exchange | Internship | ...
    status = Column(String, nullable=True)          # Thai status label, e.g. "เสร็จสิ้น"
    is_published = Column(Boolean, default=False, nullable=False)
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)

    partner = relationship("Partner")
    activity = relationship("Activity")


class DocumentScopeItem(Base):
    """One cooperation-scope bullet of an agreement."""

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
    """Admin/staff profile shown on the Settings page."""

    __tablename__ = "admin_profiles"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=True)
    phone = Column(String, nullable=True)
    position = Column(String, nullable=True)
    department = Column(String, nullable=True)


class PartnerLogo(Base):
    """Partner logo image stored in the database (one per partner), served by GET /partners/{id}/logo.
    Kept in its own table so the partners table schema is unchanged."""
    __tablename__ = "partner_logos"

    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="CASCADE"), primary_key=True)
    mime_type = Column(String, nullable=False)
    data = Column(LargeBinary, nullable=False)
    source_url = Column(Text, nullable=True)  # where the image was downloaded from
    updated_at = Column(DateTime(timezone=True), nullable=False)


# V3 roles, lowest to highest privilege. Cognito group names use the same values.
ROLES = ("public", "student", "coordinator", "staff", "admin")


class User(Base):
    """Local account record for a Cognito user.

    Passwords never reach this table: Cognito stores and checks them. The row
    links the Cognito identity (``sub``) to application data and lets the
    backend disable an account without touching Cognito.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('public', 'student', 'coordinator', 'staff', 'admin')",
            name="ck_users_role",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    cognito_sub = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    # Mirrors the user's Cognito group; refreshed from each verified token.
    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, server_default=true(), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)


class RevokedToken(Base):
    """Access tokens ended by logout before their natural expiry.

    Cognito's sign-out only stops tokens at Cognito itself, so the backend
    keeps the token ``jti`` until it would have expired anyway.
    """

    __tablename__ = "revoked_tokens"

    jti = Column(String, primary_key=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
