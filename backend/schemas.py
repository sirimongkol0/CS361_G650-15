from pydantic import BaseModel, Field, ConfigDict, AliasChoices
from typing import Optional, List
from datetime import date

# Alias for annotations: pydantic 2.5.3 mis-resolves a field literally named
# "date" annotated as Optional[date] (annotation collapses to NoneType).
datetime_date = date


class PartnerBase(BaseModel):
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    type: Optional[str] = None
    country: Optional[str] = None
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
    website_url: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    is_published: Optional[bool] = None


class PartnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    logoUrl: Optional[str] = Field(validation_alias=AliasChoices('logo_url', 'logoUrl'), serialization_alias='logoUrl')
    type: Optional[str] = None
    country: Optional[str] = None
    websiteUrl: Optional[str] = Field(default=None, validation_alias=AliasChoices('website_url', 'websiteUrl'), serialization_alias='websiteUrl')
    contactName: Optional[str] = Field(default=None, validation_alias=AliasChoices('contact_name', 'contactName'), serialization_alias='contactName')
    contactEmail: Optional[str] = Field(default=None, validation_alias=AliasChoices('contact_email', 'contactEmail'), serialization_alias='contactEmail')


class ActivityPartnerResponse(BaseModel):
    id: int
    name: str


class ActivityBase(BaseModel):
    name: str
    date: date
    description: Optional[str] = None
    activity_type: Optional[str] = None
    # --- frontend mock (pages-C) coverage: all optional -> backwards compatible ---
    end_date: Optional[date] = None
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
    date: Optional[date] = None
    description: Optional[str] = None
    is_published: Optional[bool] = None
    partner_id: Optional[int] = None
    activity_type: Optional[str] = None
    end_date: Optional[date] = None
    participants: Optional[int] = None
    location: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    is_open: Optional[bool] = None
    mou_document_id: Optional[int] = None


class ActivityResponse(BaseModel):
    id: int
    name: str
    date: date
    description: Optional[str] = None
    activity_type: Optional[str] = None
    partner: Optional[ActivityPartnerResponse] = None
    endDate: Optional[date] = Field(default=None, validation_alias=AliasChoices('end_date', 'endDate'), serialization_alias='endDate')
    participants: Optional[int] = None
    location: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    isOpen: Optional[bool] = Field(default=None, validation_alias=AliasChoices('is_open', 'isOpen'), serialization_alias='isOpen')
    mouDocId: Optional[int] = Field(default=None, validation_alias=AliasChoices('mou_document_id', 'mouDocId'), serialization_alias='mouDocId')

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    name: str
    doc_type: Optional[str] = None
    responsible: Optional[str] = None
    status: Optional[str] = None
    signer_our: Optional[str] = None
    signer_partner: Optional[str] = None


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    docType: Optional[str] = Field(default=None, validation_alias=AliasChoices('doc_type', 'docType'), serialization_alias='docType')
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
    effectiveDate: Optional[date] = Field(default=None, validation_alias=AliasChoices('effective_date', 'effectiveDate'), serialization_alias='effectiveDate')
    expiryDate: Optional[date] = Field(default=None, validation_alias=AliasChoices('expiry_date', 'expiryDate'), serialization_alias='expiryDate')
    partnerId: Optional[int] = Field(default=None, validation_alias=AliasChoices('partner_id', 'partnerId'), serialization_alias='partnerId')
    # --- frontend mock (pages-C) coverage: all optional -> backwards compatible ---
    responsible: Optional[str] = None
    status: Optional[str] = None
    signerOur: Optional[str] = Field(default=None, validation_alias=AliasChoices('signer_our', 'signerOur'), serialization_alias='signerOur')
    signerPartner: Optional[str] = Field(default=None, validation_alias=AliasChoices('signer_partner', 'signerPartner'), serialization_alias='signerPartner')
    scopeItems: Optional[List['DocumentScopeItemResponse']] = Field(
        default=None, validation_alias=AliasChoices('scope_items', 'scopeItems'), serialization_alias='scopeItems'
    )
    timelineSteps: Optional[List['DocumentTimelineStepResponse']] = Field(
        default=None, validation_alias=AliasChoices('timeline_steps', 'timelineSteps'), serialization_alias='timelineSteps'
    )


class DocumentScopeItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int = 0
    text: str


class DocumentTimelineStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int = 0
    label: str
    date: Optional[datetime_date] = None
    done: bool = False
    current: bool = False


class FeedbackCreate(BaseModel):
    title: str
    source: Optional[str] = None
    rating: Optional[int] = None
    date: Optional[date] = None
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
    start_date: Optional[date] = None
    end_date: Optional[date] = None
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
    startDate: Optional[date] = Field(default=None, validation_alias=AliasChoices('start_date', 'startDate'), serialization_alias='startDate')
    endDate: Optional[date] = Field(default=None, validation_alias=AliasChoices('end_date', 'endDate'), serialization_alias='endDate')
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


# Resolve forward references (scopeItems / timelineSteps declared before their models)
DocumentResponse.model_rebuild()


class ErrorResponse(BaseModel):
    status_code: int
    detail: str
