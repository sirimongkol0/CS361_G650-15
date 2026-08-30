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

    partner = relationship("Partner", back_populates="documents")


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

    partner = relationship("Partner", back_populates="activities")
