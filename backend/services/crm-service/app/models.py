# services/crm-service/app/models.py

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, func, JSON, DECIMAL, ARRAY
from sqlalchemy.dialects.postgresql import UUID
import uuid

class Base(DeclarativeBase):
    pass

class CRMContact(Base):
    __tablename__ = "crm_contacts"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    contact_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("contacts.id"))
    external_id: Mapped[str | None] = mapped_column(String(255))
    crm_provider: Mapped[str | None] = mapped_column(String(50))
    
    # Contact information
    first_name: Mapped[str | None] = mapped_column(String(255))
    last_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    company: Mapped[str | None] = mapped_column(String(255))
    position: Mapped[str | None] = mapped_column(String(255))
    
    # CRM specific fields
    status: Mapped[str] = mapped_column(String(50), default='new')
    lead_score: Mapped[int] = mapped_column(Integer, default=0)
    deal_value: Mapped[float | None] = mapped_column(DECIMAL(10, 2))
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    custom_fields: Mapped[dict] = mapped_column(JSON, default={})
    
    # Activity tracking
    last_contacted_at: Mapped[DateTime | None] = mapped_column(DateTime)
    last_activity_at: Mapped[DateTime | None] = mapped_column(DateTime)
    next_follow_up: Mapped[DateTime | None] = mapped_column(DateTime)
    
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    activities = relationship("CRMActivity", back_populates="contact")

class CRMActivity(Base):
    __tablename__ = "crm_activities"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_contacts.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500))
    content: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String(20), default='completed')
    scheduled_at: Mapped[DateTime | None] = mapped_column(DateTime)
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime)
    activity_metadata: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    
    # Relationships
    contact = relationship("CRMContact", back_populates="activities")

class CRMCampaign(Base):
    __tablename__ = "crm_campaigns"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='draft')
    
    # Campaign settings
    from_email: Mapped[str | None] = mapped_column(String(255))
    from_name: Mapped[str | None] = mapped_column(String(255))
    reply_to_email: Mapped[str | None] = mapped_column(String(255))
    subject_lines: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    email_templates: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    
    # Scheduling
    timezone: Mapped[str] = mapped_column(String(50), default='UTC')
    send_days: Mapped[list[int] | None] = mapped_column(ARRAY(Integer), default=[1,2,3,4,5])
    send_hours_start: Mapped[int] = mapped_column(Integer, default=9)
    send_hours_end: Mapped[int] = mapped_column(Integer, default=17)
    daily_limit: Mapped[int] = mapped_column(Integer, default=50)
    
    # Stats
    total_contacts: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    open_count: Mapped[int] = mapped_column(Integer, default=0)
    click_count: Mapped[int] = mapped_column(Integer, default=0)
    reply_count: Mapped[int] = mapped_column(Integer, default=0)
    bounce_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    campaign_contacts = relationship("CRMCampaignContact", back_populates="campaign")

class CRMCampaignContact(Base):
    __tablename__ = "crm_campaign_contacts"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_campaigns.id", ondelete="CASCADE"))
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_contacts.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default='pending')
    
    # Tracking
    sent_at: Mapped[DateTime | None] = mapped_column(DateTime)
    opened_at: Mapped[DateTime | None] = mapped_column(DateTime)
    clicked_at: Mapped[DateTime | None] = mapped_column(DateTime)
    replied_at: Mapped[DateTime | None] = mapped_column(DateTime)
    bounced_at: Mapped[DateTime | None] = mapped_column(DateTime)
    unsubscribed_at: Mapped[DateTime | None] = mapped_column(DateTime)
    
    # Personalization
    personalized_data: Mapped[dict] = mapped_column(JSON, default={})
    
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    
    # Relationships
    campaign = relationship("CRMCampaign", back_populates="campaign_contacts")

# Import existing models from enrichment
class Contact(Base):
    __tablename__ = "contacts"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str | None] = mapped_column(String(255), ForeignKey("import_jobs.id"))
    first_name: Mapped[str | None] = mapped_column(String(255))
    last_name: Mapped[str | None] = mapped_column(String(255))
    position: Mapped[str | None] = mapped_column(String(255))
    company: Mapped[str | None] = mapped_column(String(255))
    company_domain: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(255))
    enriched: Mapped[bool] = mapped_column(Boolean, default=False)
    enrichment_status: Mapped[str | None] = mapped_column(String(50), default='pending')

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=100) 