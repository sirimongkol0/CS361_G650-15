from pydantic import BaseModel, Field, ConfigDict, AliasChoices, field_validator
from typing import Optional, List, Literal
from datetime import date, datetime, timezone

# Alias for annotations: pydantic 2.5.3 mis-resolves a field literally named
# "date" annotated as Optional[date] (annotation collapses to NoneType).
datetime_date = date

# Cooperation level of a record (docs/api/v2-field-contract.md); None = not yet classified.
ScopeLevel = Literal['program', 'faculty', 'university']


class PartnerBase(BaseModel):
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    type: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2, pattern=r"^[A-Z]{2}$")
    website_url: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


class PartnerCreate(PartnerBase):
    is_published: bool = False


class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    type: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2, pattern=r"^[A-Z]{2}$")
    website_url: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    is_published: Optional[bool] = None


class SourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sourceUrl: str = Field(validation_alias=AliasChoices('source_url', 'sourceUrl'), serialization_alias='sourceUrl')
    sourceTitle: Optional[str] = Field(default=None, validation_alias=AliasChoices('source_title', 'sourceTitle'), serialization_alias='sourceTitle')
    sourcePublisher: Optional[str] = Field(default=None, validation_alias=AliasChoices('source_publisher', 'sourcePublisher'), serialization_alias='sourcePublisher')
    sourceType: str = Field(validation_alias=AliasChoices('source_type', 'sourceType'), serialization_alias='sourceType')
    sourceCheckedAt: datetime = Field(validation_alias=AliasChoices('source_checked_at', 'sourceCheckedAt'), serialization_alias='sourceCheckedAt')
    sourceLocator: Optional[str] = Field(default=None, validation_alias=AliasChoices('source_locator', 'sourceLocator'), serialization_alias='sourceLocator')

    @field_validator('sourceCheckedAt')
    @classmethod
    def checked_at_is_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class PartnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    logoUrl: Optional[str] = Field(validation_alias=AliasChoices('logo_url', 'logoUrl'), serialization_alias='logoUrl')
    type: Optional[str] = None
    country: Optional[str] = None
    countryCode: Optional[str] = Field(default=None, validation_alias=AliasChoices('country_code', 'countryCode'), serialization_alias='countryCode')
    websiteUrl: Optional[str] = Field(default=None, validation_alias=AliasChoices('website_url', 'websiteUrl'), serialization_alias='websiteUrl')
    contactName: Optional[str] = Field(default=None, validation_alias=AliasChoices('contact_name', 'contactName'), serialization_alias='contactName')
    contactEmail: Optional[str] = Field(default=None, validation_alias=AliasChoices('contact_email', 'contactEmail'), serialization_alias='contactEmail')
    scopeLevel: Optional[ScopeLevel] = Field(default=None, validation_alias=AliasChoices('scope_level', 'scopeLevel'), serialization_alias='scopeLevel')
    sources: List['SourceResponse'] = Field(default_factory=list)


class ActivityPartnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ActivityBase(BaseModel):
    name: str
    date: Optional[datetime_date] = None
    description: Optional[str] = None
    activity_type: Optional[str] = None
    date_kind: Optional[Literal['event', 'announcement', 'deadline', 'application_open', 'application_close', 'period_start', 'period_end']] = None
    date_precision: Optional[Literal['day', 'month', 'year', 'approximate']] = None
    # --- detail fields: all optional -> backwards compatible ---
    end_date: Optional[datetime_date] = None
    participants: Optional[int] = None
    location: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    is_open: Optional[bool] = None
    mou_document_id: Optional[int] = None


class ActivityCreate(ActivityBase):
    is_published: bool = False
    partner_id: Optional[int] = None


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[datetime_date] = None
    description: Optional[str] = None
    is_published: Optional[bool] = None
    partner_id: Optional[int] = None
    activity_type: Optional[str] = None
    date_kind: Optional[Literal['event', 'announcement', 'deadline', 'application_open', 'application_close', 'period_start', 'period_end']] = None
    date_precision: Optional[Literal['day', 'month', 'year', 'approximate']] = None
    end_date: Optional[datetime_date] = None
    participants: Optional[int] = None
    location: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    is_open: Optional[bool] = None
    mou_document_id: Optional[int] = None


class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    date: Optional[datetime_date] = None
    description: Optional[str] = None
    activity_type: Optional[str] = None
    dateKind: Optional[Literal['event', 'announcement', 'deadline', 'application_open', 'application_close', 'period_start', 'period_end']] = Field(default=None, validation_alias=AliasChoices('date_kind', 'dateKind'), serialization_alias='dateKind')
    datePrecision: Optional[Literal['day', 'month', 'year', 'approximate']] = Field(default=None, validation_alias=AliasChoices('date_precision', 'datePrecision'), serialization_alias='datePrecision')
    partner: Optional[ActivityPartnerResponse] = None
    endDate: Optional[datetime_date] = Field(default=None, validation_alias=AliasChoices('end_date', 'endDate'), serialization_alias='endDate')
    participants: Optional[int] = None
    location: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    isOpen: Optional[bool] = Field(default=None, validation_alias=AliasChoices('is_open', 'isOpen'), serialization_alias='isOpen')
    mouDocId: Optional[int] = Field(default=None, validation_alias=AliasChoices('mou_document_id', 'mouDocId'), serialization_alias='mouDocId')
    scopeLevel: Optional[ScopeLevel] = Field(default=None, validation_alias=AliasChoices('scope_level', 'scopeLevel'), serialization_alias='scopeLevel')
    sources: List[SourceResponse] = Field(default_factory=list)

class DocumentBase(BaseModel):
    name: str
    doc_type: Optional[str] = None
    document_kind: Optional[Literal['agreement', 'template', 'procedure', 'announcement', 'other']] = None
    file_availability: Optional[Literal['available', 'metadata_only', 'unavailable']] = None
    responsible: Optional[str] = None
    status: Optional[str] = None
    signer_our: Optional[str] = None
    signer_partner: Optional[str] = None


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    partner: Optional[ActivityPartnerResponse] = None
    name: str
    docType: Optional[str] = Field(default=None, validation_alias=AliasChoices('doc_type', 'docType'), serialization_alias='docType')
    documentKind: Optional[Literal['agreement', 'template', 'procedure', 'announcement', 'other']] = Field(default=None, validation_alias=AliasChoices('document_kind', 'documentKind'), serialization_alias='documentKind')
    fileAvailability: Optional[Literal['available', 'metadata_only', 'unavailable']] = Field(default=None, validation_alias=AliasChoices('file_availability', 'fileAvailability'), serialization_alias='fileAvailability')
    storageKey: Optional[str] = Field(
        validation_alias=AliasChoices('storage_key', 'storageKey'),
        serialization_alias='storageKey'
    )
    mimeType: Optional[str] = Field(
        validation_alias=AliasChoices('mime_type', 'mimeType'),
        serialization_alias='mimeType'
    )
    sizeBytes: Optional[int] = Field(
        validation_alias=AliasChoices('size_bytes', 'sizeBytes'),
        serialization_alias='sizeBytes'
    )
    fileName: Optional[str] = Field(default=None, validation_alias=AliasChoices('file_name', 'fileName'))
    uploadedAt: Optional[datetime] = Field(default=None, validation_alias=AliasChoices('uploaded_at', 'uploadedAt'))
    effectiveDate: Optional[datetime_date] = Field(default=None, validation_alias=AliasChoices('effective_date', 'effectiveDate'), serialization_alias='effectiveDate')
    expiryDate: Optional[datetime_date] = Field(default=None, validation_alias=AliasChoices('expiry_date', 'expiryDate'), serialization_alias='expiryDate')
    partnerId: Optional[int] = Field(default=None, validation_alias=AliasChoices('partner_id', 'partnerId'), serialization_alias='partnerId')
    # --- detail fields: all optional -> backwards compatible ---
    responsible: Optional[str] = None
    status: Optional[str] = None
    signerOur: Optional[str] = Field(default=None, validation_alias=AliasChoices('signer_our', 'signerOur'), serialization_alias='signerOur')
    signerPartner: Optional[str] = Field(default=None, validation_alias=AliasChoices('signer_partner', 'signerPartner'), serialization_alias='signerPartner')
    scopeLevel: Optional[ScopeLevel] = Field(default=None, validation_alias=AliasChoices('scope_level', 'scopeLevel'), serialization_alias='scopeLevel')
    scopeItems: Optional[List['DocumentScopeItemResponse']] = Field(
        default=None, validation_alias=AliasChoices('scope_items', 'scopeItems'), serialization_alias='scopeItems'
    )
    sources: List[SourceResponse] = Field(default_factory=list)


class DocumentScopeItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: Optional[int] = None
    text: str


class FeedbackCreate(BaseModel):
    title: str
    source: Optional[str] = None
    rating: Optional[int] = None
    date: Optional[datetime_date] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    is_published: bool = False
    partner_id: Optional[int] = None
    activity_id: Optional[int] = None


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source: Optional[str] = None
    rating: Optional[int] = None
    date: Optional[datetime_date] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    partnerId: Optional[int] = Field(default=None, validation_alias=AliasChoices('partner_id', 'partnerId'), serialization_alias='partnerId')
    activityId: Optional[int] = Field(default=None, validation_alias=AliasChoices('activity_id', 'activityId'), serialization_alias='activityId')


class ExchangeStudentCreate(BaseModel):
    name: str
    type: Optional[str] = None          # outbound | inbound
    from_program: Optional[str] = None
    to_organization: Optional[str] = None
    start_date: Optional[datetime_date] = None
    end_date: Optional[datetime_date] = None
    program: Optional[str] = None
    status: Optional[str] = None
    is_published: bool = False
    partner_id: Optional[int] = None
    activity_id: Optional[int] = None


class ExchangeStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: Optional[str] = None
    fromProgram: Optional[str] = Field(default=None, validation_alias=AliasChoices('from_program', 'fromProgram'), serialization_alias='fromProgram')
    toOrganization: Optional[str] = Field(default=None, validation_alias=AliasChoices('to_organization', 'toOrganization'), serialization_alias='toOrganization')
    startDate: Optional[datetime_date] = Field(default=None, validation_alias=AliasChoices('start_date', 'startDate'), serialization_alias='startDate')
    endDate: Optional[datetime_date] = Field(default=None, validation_alias=AliasChoices('end_date', 'endDate'), serialization_alias='endDate')
    program: Optional[str] = None
    status: Optional[str] = None
    partnerId: Optional[int] = Field(default=None, validation_alias=AliasChoices('partner_id', 'partnerId'), serialization_alias='partnerId')
    activityId: Optional[int] = Field(default=None, validation_alias=AliasChoices('activity_id', 'activityId'), serialization_alias='activityId')


class AdminProfileBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None


class AdminProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firstName: Optional[str] = Field(default=None, validation_alias=AliasChoices('first_name', 'firstName'), serialization_alias='firstName')
    lastName: Optional[str] = Field(default=None, validation_alias=AliasChoices('last_name', 'lastName'), serialization_alias='lastName')
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None


# Resolve forward references (scopeItems declared before their models)
DocumentResponse.model_rebuild()


class ErrorResponse(BaseModel):
    detail: str
