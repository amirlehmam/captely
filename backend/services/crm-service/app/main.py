# CRM Service - Standalone
import os
import uuid
import enum
from datetime import datetime
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, DateTime, Text, Enum, Boolean, Integer, ForeignKey, select, update
from sqlalchemy.dialects.postgresql import UUID
from pydantic import BaseModel

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgrespw@captely-db:5432/postgres")

# SQLAlchemy setup
engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# Enums
class ActivityType(str, enum.Enum):
    call = "call"
    email = "email"
    meeting = "meeting"
    task = "task"
    note = "note"
    follow_up = "follow_up"

class ActivityStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"
    overdue = "overdue"

class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"

class ContactStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    customer = "customer"
    lost = "lost"

class CampaignStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"

# Database Models
class CrmContact(Base):
    __tablename__ = "crm_contacts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    contact_id = Column(Integer)
    external_id = Column(String)
    crm_provider = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String)
    phone = Column(String)
    company = Column(String)
    position = Column(String)
    status = Column(String, default="new")
    lead_score = Column(Integer, default=0)
    deal_value = Column(Integer)
    tags = Column(Text)  # Will handle as array in responses
    custom_fields = Column(Text)
    last_contacted_at = Column(DateTime)
    last_activity_at = Column(DateTime)
    next_follow_up = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CrmActivity(Base):
    __tablename__ = "crm_activities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(Enum(ActivityType), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("crm_contacts.id"))
    status = Column(Enum(ActivityStatus), default=ActivityStatus.pending)
    priority = Column(Enum(Priority), default=Priority.medium)
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    created_by = Column(String, nullable=False)
    assigned_to = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CrmCampaign(Base):
    __tablename__ = "crm_campaigns"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    type = Column(String, default="email")
    status = Column(Enum(CampaignStatus), default=CampaignStatus.draft)
    from_email = Column(String)
    from_name = Column(String)
    total_contacts = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    open_count = Column(Integer, default=0)
    click_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Pydantic Models
class ContactCreate(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    status: ContactStatus = ContactStatus.new
    lead_score: int = 0

class ContactResponse(BaseModel):
    id: str
    first_name: str
    last_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    company: Optional[str]
    position: Optional[str]
    status: str
    lead_score: int
    tags: Optional[List[str]] = []
    last_contacted_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class ActivityCreate(BaseModel):
    type: ActivityType
    title: str
    description: Optional[str] = None
    contact_id: Optional[str] = None
    status: ActivityStatus = ActivityStatus.pending
    priority: Priority = Priority.medium
    due_date: Optional[datetime] = None
    created_by: str
    assigned_to: Optional[str] = None

class ActivityResponse(BaseModel):
    id: str
    type: str
    title: str
    description: Optional[str]
    contact_id: Optional[str]
    contact_name: Optional[str]
    contact_email: Optional[str]
    status: str
    priority: str
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    created_by: str
    assigned_to: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CampaignCreate(BaseModel):
    name: str
    type: str = "email"
    from_email: Optional[str] = None
    from_name: Optional[str] = None

class CampaignResponse(BaseModel):
    id: str
    name: str
    type: str
    status: str
    from_email: Optional[str]
    from_name: Optional[str]
    total_contacts: int
    sent_count: int
    open_count: int
    click_count: int
    reply_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Database session dependency
async def get_db_session():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        print("✅ CRM service started, using existing database schema")
    except Exception as e:
        print(f"❌ Error during startup: {e}")
    
    yield
    
    # Shutdown
    await engine.dispose()

# FastAPI app
app = FastAPI(
    title="CAPTELY CRM Service",
    description="CRM service for managing contacts, activities, and campaigns",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "crm-service"}

# Contact endpoints
@app.get("/api/contacts", response_model=List[ContactResponse])
async def get_contacts(
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db_session)
):
    """Get all contacts with pagination"""
    try:
        result = await session.execute(
            select(CrmContact)
            .order_by(CrmContact.created_at.desc())
            .limit(limit)
            .offset(skip)
        )
        contacts = result.scalars().all()
        
        return [
            ContactResponse(
                id=str(contact.id),
                first_name=contact.first_name,
                last_name=contact.last_name,
                email=contact.email,
                phone=contact.phone,
                company=contact.company,
                position=contact.position,
                status=contact.status,
                lead_score=contact.lead_score,
                tags=contact.tags.split(',') if contact.tags else [],
                last_contacted_at=contact.last_contacted_at,
                created_at=contact.created_at
            )
            for contact in contacts
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch contacts: {str(e)}")

# Activity endpoints
@app.get("/api/activities", response_model=List[ActivityResponse])
async def get_activities(
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    type_filter: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    session: AsyncSession = Depends(get_db_session)
):
    """Get all activities with filtering and pagination"""
    try:
        query = select(CrmActivity, CrmContact).outerjoin(
            CrmContact, CrmActivity.contact_id == CrmContact.id
        ).order_by(CrmActivity.created_at.desc())
        
        # Apply filters
        if type_filter:
            query = query.where(CrmActivity.type == type_filter)
        if status_filter:
            query = query.where(CrmActivity.status == status_filter)
        if priority_filter:
            query = query.where(CrmActivity.priority == priority_filter)
            
        query = query.limit(limit).offset(skip)
        
        result = await session.execute(query)
        activities_with_contacts = result.all()
        
        return [
            ActivityResponse(
                id=str(activity.id),
                type=activity.type.value,
                title=activity.title,
                description=activity.description,
                contact_id=str(activity.contact_id) if activity.contact_id else None,
                contact_name=f"{contact.first_name} {contact.last_name}" if contact else None,
                contact_email=contact.email if contact else None,
                status=activity.status.value,
                priority=activity.priority.value,
                due_date=activity.due_date,
                completed_at=activity.completed_at,
                created_by=activity.created_by,
                assigned_to=activity.assigned_to,
                created_at=activity.created_at,
                updated_at=activity.updated_at
            )
            for activity, contact in activities_with_contacts
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch activities: {str(e)}")

@app.post("/api/activities", response_model=ActivityResponse)
async def create_activity(
    activity: ActivityCreate,
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new activity"""
    try:
        contact_uuid = None
        if activity.contact_id:
            try:
                contact_uuid = uuid.UUID(activity.contact_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid contact_id format")
        
        db_activity = CrmActivity(
            type=activity.type,
            title=activity.title,
            description=activity.description,
            contact_id=contact_uuid,
            status=activity.status,
            priority=activity.priority,
            due_date=activity.due_date,
            created_by=activity.created_by,
            assigned_to=activity.assigned_to
        )
        
        session.add(db_activity)
        await session.commit()
        await session.refresh(db_activity)
        
        # Get contact info if available
        contact_name = None
        contact_email = None
        if contact_uuid:
            contact_result = await session.execute(
                select(CrmContact).where(CrmContact.id == contact_uuid)
            )
            contact = contact_result.scalar_one_or_none()
            if contact:
                contact_name = f"{contact.first_name} {contact.last_name}"
                contact_email = contact.email
        
        return ActivityResponse(
            id=str(db_activity.id),
            type=db_activity.type.value,
            title=db_activity.title,
            description=db_activity.description,
            contact_id=str(db_activity.contact_id) if db_activity.contact_id else None,
            contact_name=contact_name,
            contact_email=contact_email,
            status=db_activity.status.value,
            priority=db_activity.priority.value,
            due_date=db_activity.due_date,
            completed_at=db_activity.completed_at,
            created_by=db_activity.created_by,
            assigned_to=db_activity.assigned_to,
            created_at=db_activity.created_at,
            updated_at=db_activity.updated_at
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create activity: {str(e)}")

# Campaign endpoints
@app.get("/api/campaigns", response_model=List[CampaignResponse])
async def get_campaigns(
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db_session)
):
    """Get all campaigns with pagination"""
    try:
        result = await session.execute(
            select(CrmCampaign)
            .order_by(CrmCampaign.created_at.desc())
            .limit(limit)
            .offset(skip)
        )
        campaigns = result.scalars().all()
        
        return [
            CampaignResponse(
                id=str(campaign.id),
                name=campaign.name,
                type=campaign.type,
                status=campaign.status.value,
                from_email=campaign.from_email,
                from_name=campaign.from_name,
                total_contacts=campaign.total_contacts,
                sent_count=campaign.sent_count,
                open_count=campaign.open_count,
                click_count=campaign.click_count,
                reply_count=campaign.reply_count,
                created_at=campaign.created_at,
                updated_at=campaign.updated_at
            )
            for campaign in campaigns
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaigns: {str(e)}")

@app.post("/api/campaigns", response_model=CampaignResponse)
async def create_campaign(
    campaign: CampaignCreate,
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new campaign"""
    try:
        db_campaign = CrmCampaign(
            name=campaign.name,
            type=campaign.type,
            from_email=campaign.from_email,
            from_name=campaign.from_name,
            status=CampaignStatus.draft  # New campaigns start as draft
        )
        
        session.add(db_campaign)
        await session.commit()
        await session.refresh(db_campaign)
        
        return CampaignResponse(
            id=str(db_campaign.id),
            name=db_campaign.name,
            type=db_campaign.type,
            status=db_campaign.status.value,
            from_email=db_campaign.from_email,
            from_name=db_campaign.from_name,
            total_contacts=db_campaign.total_contacts,
            sent_count=db_campaign.sent_count,
            open_count=db_campaign.open_count,
            click_count=db_campaign.click_count,
            reply_count=db_campaign.reply_count,
            created_at=db_campaign.created_at,
            updated_at=db_campaign.updated_at
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create campaign: {str(e)}")

@app.put("/api/campaigns/{campaign_id}/status")
async def update_campaign_status(
    campaign_id: str,
    status_update: dict,
    session: AsyncSession = Depends(get_db_session)
):
    """Update campaign status"""
    try:
        # Validate campaign_id
        try:
            campaign_uuid = uuid.UUID(campaign_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid campaign ID format")
        
        # Validate status
        new_status = status_update.get('status')
        if not new_status or new_status not in ['draft', 'active', 'paused', 'completed']:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        # Get campaign
        result = await session.execute(
            select(CrmCampaign).where(CrmCampaign.id == campaign_uuid)
        )
        campaign = result.scalar_one_or_none()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Update status
        campaign.status = CampaignStatus[new_status]
        campaign.updated_at = datetime.utcnow()
        
        await session.commit()
        
        return {"message": f"Campaign status updated to {new_status}"}
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update campaign status: {str(e)}")

@app.put("/api/activities/{activity_id}/status")
async def update_activity_status(
    activity_id: str,
    status_update: dict,
    session: AsyncSession = Depends(get_db_session)
):
    """Update activity status"""
    try:
        # Validate activity_id
        try:
            activity_uuid = uuid.UUID(activity_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid activity ID format")
        
        # Validate status
        new_status = status_update.get('status')
        if not new_status or new_status not in ['pending', 'completed', 'cancelled', 'overdue']:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        # Get activity
        result = await session.execute(
            select(CrmActivity).where(CrmActivity.id == activity_uuid)
        )
        activity = result.scalar_one_or_none()
        
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")
        
        # Update status
        activity.status = ActivityStatus[new_status]
        activity.updated_at = datetime.utcnow()
        
        # Set completed_at if completing
        if new_status == 'completed':
            activity.completed_at = datetime.utcnow()
        
        await session.commit()
        
        return {"message": f"Activity status updated to {new_status}"}
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update activity status: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 