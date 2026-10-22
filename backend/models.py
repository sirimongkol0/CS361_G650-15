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
    JSON,
    LargeBinary,
    String,
    Numeric,
    Table,
    UniqueConstraint,
    event,
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
# V3-3: relevance to the CSTU program; only "keep" rows can appear publicly.
CSTU_STATUSES = ("keep", "review", "out_of_scope")  # คงไว้ | รอทบทวน | นอกขอบเขต


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
    # Allowed values: university | government | private_company | network | vocational | healthcare | international_organization | alumni | expert | coordinator
    type = Column(String, nullable=True)            
    country = Column(String, nullable=True)         # English short name, one spelling per country_code
    country_code = Column(String(2), nullable=True)
    website_url = Column(Text, nullable=True)
    contact_name = Column(String, nullable=True)    # coordinator / liaison
    contact_email = Column(String, nullable=True)
    # Contact publication requires explicit approval, independently of the partner.
    contact_is_public = Column(Boolean, default=False, server_default=false(), nullable=False)
    # Cooperation level: program | faculty | university; NULL = not yet classified.
    scope_level = Column(String, nullable=True)

    # --- [V3-2] Fields เพิ่มเติมสำหรับ Stakeholder/Coordinator & RBAC & Soft Delete ---
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, server_default=false(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_user_id])
    organization = relationship("Partner", remote_side=[id], foreign_keys=[organization_id], backref="coordinators")
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
        CheckConstraint("cstu_status IN ('keep', 'review', 'out_of_scope')", name="ck_documents_cstu_status"),
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
    status = Column(String, nullable=True)          # draft | approved | active | expiring | expired | cancelled (see routers/documents.py)
    signer_our = Column(String, nullable=True)      # "ผู้ลงนาม (ฝ่ายเรา)"
    signer_partner = Column(String, nullable=True)  # "ผู้ลงนาม (หน่วยงาน)"
    scope_level = Column(String, nullable=True)     # program | faculty | university (NULL = not yet classified)
    # --- [V3-3] CSTU relevance review, ownership and soft delete ---
    cstu_status = Column(String, default="review", server_default="review", nullable=False)  # keep | review | out_of_scope
    cstu_evidence = Column(Text, nullable=True)     # evidence / source for the relevance decision
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, server_default=false(), nullable=False)

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
    owner_user_id = Column(Integer, nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, server_default=false(), nullable=False)

    partner = relationship("Partner", back_populates="activities")
    mou_document = relationship(
        "Document", back_populates="mou_activities", foreign_keys=[mou_document_id]
    )
    sources = relationship("Source", secondary=activity_sources, back_populates="activities")


FEEDBACK_STATUSES = ("pending", "reviewed")

# V4: an Outcome or Feedback refers to at least one partner, agreement, activity or exchange.
CONTEXT_PRESENT = (
    "partner_id IS NOT NULL OR document_id IS NOT NULL "
    "OR activity_id IS NOT NULL OR exchange_id IS NOT NULL"
)


class Feedback(Base):
    """Feedback from a stakeholder, linked to the context it is about."""

    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating >= 1 AND rating <= 5)", name="ck_feedbacks_rating_range"),
        CheckConstraint("status IN ('pending', 'reviewed')", name="ck_feedbacks_status"),
        # Rows from before V4 may have no context; they are flagged instead of rejected.
        CheckConstraint(f"is_legacy OR {CONTEXT_PRESENT}", name="ck_feedbacks_context"),
        # Re-importing the same external record from the same source is rejected.
        UniqueConstraint("feedback_source_id", "external_id", name="uq_feedbacks_source_external_id"),
    )

    title = Column(String, index=True, nullable=False)
    source = Column(String, nullable=True)          # pre-V4 free text; superseded by respondent_type/feedback_source
    rating = Column(Integer, nullable=True)         # 1..5
    date = Column(Date, nullable=True, index=True)
    # pending | reviewed (รอตรวจสอบ | ตรวจสอบแล้ว); publication is is_published.
    status = Column(String, default="pending", server_default="pending", nullable=False)
    comment = Column(String, nullable=True)         # free-text comment
    is_published = Column(Boolean, default=False, nullable=False)
    # --- V4 context: at least one is set (see ck_feedbacks_context) ---
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    exchange_id = Column(Integer, ForeignKey("exchange_students.id", ondelete="SET NULL"), nullable=True, index=True)
    is_legacy = Column(Boolean, default=False, server_default=false(), nullable=False)
    # --- V4 who sent it and through which channel ---
    respondent_type_id = Column(Integer, ForeignKey("respondent_types.id"), nullable=True, index=True)
    feedback_source_id = Column(Integer, ForeignKey("feedback_sources.id"), nullable=True, index=True)
    # NULL for imported rows: external respondents have no account.
    submitted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    import_batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    external_id = Column(String, nullable=True)

    # V3-7: staff/coordinator reply. Kept off the public response.
    reply = Column(String, nullable=True)
    replied_at = Column(DateTime(timezone=True), nullable=True)
    replied_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    partner = relationship("Partner")
    activity = relationship("Activity")
    document = relationship("Document")
    exchange = relationship("ExchangeStudent")
    respondent_type = relationship("RespondentType")
    feedback_source = relationship("FeedbackSource")
    import_batch = relationship("ImportBatch")


class Outcome(Base):
    """Measurable or evidenced result of a collaboration (participants, publications, funding...)."""

    __tablename__ = "outcomes"
    __table_args__ = (
        CheckConstraint(CONTEXT_PRESENT, name="ck_outcomes_context"),
        CheckConstraint("length(title) > 0", name="ck_outcomes_title_nonempty"),
    )

    id = Column(Integer, primary_key=True, index=True)
    outcome_type_id = Column(Integer, ForeignKey("outcome_types.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    value = Column(Numeric(14, 2), nullable=True)   # e.g. 35 (people), 50000 (baht)
    unit = Column(String, nullable=True)            # defaults to the type's unit when NULL
    occurred_on = Column(Date, nullable=True, index=True)
    evidence_url = Column(String, nullable=True)
    evidence_storage_key = Column(String, nullable=True)  # S3/local key, like documents.storage_key
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True, index=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    exchange_id = Column(Integer, ForeignKey("exchange_students.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    import_batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    is_published = Column(Boolean, default=False, server_default=false(), nullable=False)
    is_deleted = Column(Boolean, default=False, server_default=false(), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)

    outcome_type = relationship("OutcomeType")
    partner = relationship("Partner")
    activity = relationship("Activity")
    document = relationship("Document")
    exchange = relationship("ExchangeStudent")
    import_batch = relationship("ImportBatch")


class _LookupMixin:
    """Admin-extensible type list: rows are data, so new types need no code change."""

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)  # stable key used by imports and the API
    name_th = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, server_default=true(), nullable=False)
    sort_order = Column(Integer, default=0, server_default="0", nullable=False)


class OutcomeType(_LookupMixin, Base):
    __tablename__ = "outcome_types"

    unit = Column(String, nullable=True)  # default unit, e.g. "คน", "บาท"


class RespondentType(_LookupMixin, Base):
    """Who gave the feedback (student, alumni, partner ...)."""

    __tablename__ = "respondent_types"


class FeedbackSource(_LookupMixin, Base):
    """Channel the feedback came through (web form, file import, co-op system ...)."""

    __tablename__ = "feedback_sources"


# Initial rows, inserted whenever a lookup table is created (create_all or migrate_v4).
LOOKUP_SEEDS = {
    "outcome_types": [
        {"code": "participants", "name_th": "จำนวนผู้เข้าร่วม", "unit": "คน"},
        {"code": "publication", "name_th": "ผลงานวิชาการ", "unit": "ชิ้น"},
        {"code": "funding", "name_th": "ทุนหรืองบประมาณ", "unit": "บาท"},
        {"code": "placement", "name_th": "การรับเข้าฝึกงานหรือทำงาน", "unit": "คน"},
        {"code": "curriculum_input", "name_th": "ข้อเสนอต่อหลักสูตร", "unit": None},
        {"code": "other", "name_th": "อื่น ๆ", "unit": None},
    ],
    "respondent_types": [
        {"code": "student", "name_th": "นักศึกษา"},
        {"code": "participant", "name_th": "ผู้เข้าร่วมกิจกรรม"},
        {"code": "alumni", "name_th": "ศิษย์เก่า"},
        {"code": "partner", "name_th": "คู่ความร่วมมือ"},
        {"code": "coordinator", "name_th": "อาจารย์หรือผู้ประสานงาน"},
        {"code": "staff", "name_th": "เจ้าหน้าที่"},
    ],
    "feedback_sources": [
        {"code": "web_form", "name_th": "ฟอร์มบนเว็บ"},
        {"code": "file_import", "name_th": "ไฟล์นำเข้า"},
        {"code": "coop_system", "name_th": "ระบบสหกิจศึกษา"},
        {"code": "manual_entry", "name_th": "บันทึกโดยเจ้าหน้าที่"},
    ],
}


def seed_lookup(table, connection):
    """Insert the initial rows that are missing; existing and admin-added rows are kept."""
    existing = {row[0] for row in connection.execute(table.select().with_only_columns(table.c.code))}
    rows = [
        {"is_active": True, **row, "sort_order": index}
        for index, row in enumerate(LOOKUP_SEEDS[table.name])
        if row["code"] not in existing
    ]
    if rows:
        connection.execute(table.insert(), rows)


for _model in (OutcomeType, RespondentType, FeedbackSource):
    event.listen(_model.__table__, "after_create", lambda table, connection, **_: seed_lookup(table, connection))


IMPORT_BATCH_STATUSES = ("previewed", "committed", "rolled_back", "failed")


class ImportBatch(Base):
    """One uploaded file: validated as a preview, then committed or rolled back as a whole."""

    __tablename__ = "import_batches"
    __table_args__ = (
        CheckConstraint(
            "status IN ('previewed', 'committed', 'rolled_back', 'failed')",
            name="ck_import_batches_status",
        ),
        CheckConstraint("kind IN ('feedback', 'outcome')", name="ck_import_batches_kind"),
        CheckConstraint(
            "total_rows >= 0 AND valid_rows >= 0 AND invalid_rows >= 0",
            name="ck_import_batches_counts_nonnegative",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String, nullable=False)           # feedback | outcome
    feedback_source_id = Column(Integer, ForeignKey("feedback_sources.id"), nullable=False)
    file_name = Column(String, nullable=False)
    storage_key = Column(String, nullable=True)     # uploaded file in S3/local storage
    status = Column(String, default="previewed", server_default="previewed", nullable=False)
    total_rows = Column(Integer, default=0, server_default="0", nullable=False)
    valid_rows = Column(Integer, default=0, server_default="0", nullable=False)
    invalid_rows = Column(Integer, default=0, server_default="0", nullable=False)
    errors = Column(JSON, nullable=True)            # [{"row": 3, "message": "..."}]
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    committed_at = Column(DateTime(timezone=True), nullable=True)
    rolled_back_at = Column(DateTime(timezone=True), nullable=True)

    feedback_source = relationship("FeedbackSource")


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
    program = Column(String, nullable=True)         # e.g. แลกเปลี่ยนนักศึกษา | ฝึกงาน (free text)
    status = Column(String, nullable=True)          # Thai status label, e.g. "เสร็จสิ้น"
    is_published = Column(Boolean, default=False, nullable=False)
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_user_id = Column(Integer, nullable=True, index=True)

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


class AuditLog(Base):
    """Append-only history of every V3 write: who did what to which record, before and after.

    Rows are written by ``audit.record`` in the same transaction as the change
    and are never updated or deleted through the API.
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        CheckConstraint("length(action) > 0", name="ck_audit_logs_action_nonempty"),
        CheckConstraint("length(entity) > 0", name="ck_audit_logs_entity_nonempty"),
    )

    id = Column(Integer, primary_key=True, index=True)
    # Kept if the account is later removed, so history never disappears.
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String, nullable=False)        # create | update | delete | approve | publish | ...
    entity = Column(String, nullable=False)        # table name, e.g. "partners"
    entity_id = Column(Integer, nullable=True)
    before = Column(JSON, nullable=True)
    after = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)

    user = relationship("User")
