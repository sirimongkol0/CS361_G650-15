from pydantic import BaseModel, Field, ConfigDict, AliasChoices
from typing import Optional, List
from datetime import date


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


class ActivityResponse(BaseModel):
    id: int
    name: str
    date: date
    description: Optional[str] = None
    activity_type: Optional[str] = None
    partner: Optional[ActivityPartnerResponse] = None

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    name: str
    doc_type: Optional[str] = None


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


class ErrorResponse(BaseModel):
    status_code: int
    detail: str
