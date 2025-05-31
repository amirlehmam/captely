# CRM Service - Standalone
import os
import uuid
import enum
from datetime import datetime
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, DateTime, Text, Enum, Boolean, Integer, ForeignKey, select, update, text, func, and_, or_
from sqlalchemy.dialects.postgresql import UUID
from pydantic import BaseModel
from common.config import get_settings
from common.db import async_engine, AsyncSessionLocal, get_async_session

# Get settings
settings = get_settings()

# SQLAlchemy setup
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
    await async_engine.dispose()

# FastAPI app
app = FastAPI(
    title="Captely CRM Service",
    description="Contact relationship management and enriched contact data",
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
@app.get("/api/contacts")
async def get_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    search: Optional[str] = Query(None),
    enriched_only: bool = Query(False),
    job_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_async_session)
):
    """Get paginated list of enriched contacts"""
    try:
        offset = (page - 1) * limit
        
        # Build base query
        where_conditions = []
        params = {}
        
        if search:
            where_conditions.append("""
                (LOWER(first_name) LIKE LOWER(:search) OR 
                 LOWER(last_name) LIKE LOWER(:search) OR 
                 LOWER(company) LIKE LOWER(:search) OR
                 LOWER(email) LIKE LOWER(:search))
            """)
            params["search"] = f"%{search}%"
        
        if enriched_only:
            where_conditions.append("enriched = true")
        
        if job_id:
            where_conditions.append("job_id = :job_id")
            params["job_id"] = job_id
        
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        
        # Get total count
        count_query = f"""
            SELECT COUNT(*) 
            FROM contacts 
            {where_clause}
        """
        count_result = await session.execute(text(count_query), params)
        total = count_result.scalar()
        
        # Get contacts
        contacts_query = f"""
            SELECT 
                id, first_name, last_name, company, position, email, phone,
                linkedin_url, location, industry, enriched, enrichment_status,
                enrichment_provider, enrichment_score, credits_consumed,
                email_verified, phone_verified, created_at, updated_at, job_id
            FROM contacts 
            {where_clause}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """
        params.update({"limit": limit, "offset": offset})
        
        contacts_result = await session.execute(text(contacts_query), params)
        contacts = []
        
        for row in contacts_result.fetchall():
            contact = dict(row._mapping)
            # Format dates
            if contact['created_at']:
                contact['created_at'] = contact['created_at'].isoformat()
            if contact['updated_at']:
                contact['updated_at'] = contact['updated_at'].isoformat()
            contacts.append(contact)
        
        return JSONResponse(content={
            "contacts": contacts,
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit,
                "has_next": offset + limit < total,
                "has_prev": page > 1
            }
        })
        
    except Exception as e:
        print(f"Error fetching contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: int, session: AsyncSession = Depends(get_async_session)):
    """Get detailed contact information"""
    try:
        query = """
            SELECT 
                id, first_name, last_name, company, position, email, phone,
                linkedin_url, location, industry, enriched, enrichment_status,
                enrichment_provider, enrichment_score, credits_consumed,
                email_verified, phone_verified, created_at, updated_at, job_id
            FROM contacts 
            WHERE id = :contact_id
        """
        result = await session.execute(text(query), {"contact_id": contact_id})
        contact = result.first()
        
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact_data = dict(contact._mapping)
        if contact_data['created_at']:
            contact_data['created_at'] = contact_data['created_at'].isoformat()
        if contact_data['updated_at']:
            contact_data['updated_at'] = contact_data['updated_at'].isoformat()
        
        return JSONResponse(content=contact_data)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching contact: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contacts/stats/enrichment")
async def get_enrichment_stats(session: AsyncSession = Depends(get_async_session)):
    """Get enrichment statistics across all contacts"""
    try:
        stats_query = """
            SELECT 
                COUNT(*) as total_contacts,
                COUNT(CASE WHEN enriched = true THEN 1 END) as enriched_contacts,
                COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found,
                COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as phones_found,
                COUNT(CASE WHEN email_verified = true THEN 1 END) as emails_verified,
                COUNT(CASE WHEN phone_verified = true THEN 1 END) as phones_verified,
                SUM(credits_consumed) as total_credits_used,
                AVG(CASE WHEN enrichment_score IS NOT NULL THEN enrichment_score END) as avg_confidence
            FROM contacts
        """
        
        result = await session.execute(text(stats_query))
        stats = result.first()
        
        # Provider breakdown
        provider_query = """
            SELECT 
                enrichment_provider,
                COUNT(*) as contacts,
                COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found,
                COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as phones_found,
                AVG(enrichment_score) as avg_confidence
            FROM contacts 
            WHERE enrichment_provider IS NOT NULL
            GROUP BY enrichment_provider
            ORDER BY contacts DESC
        """
        
        provider_result = await session.execute(text(provider_query))
        providers = []
        
        for row in provider_result.fetchall():
            provider_data = dict(row._mapping)
            provider_data['success_rate'] = ((provider_data['emails_found'] + provider_data['phones_found']) / provider_data['contacts'] * 100) if provider_data['contacts'] > 0 else 0
            provider_data['avg_confidence'] = round(float(provider_data['avg_confidence'] or 0), 2)
            providers.append(provider_data)
        
        total_contacts = stats.total_contacts or 0
        enriched_contacts = stats.enriched_contacts or 0
        emails_found = stats.emails_found or 0
        phones_found = stats.phones_found or 0
        
        return JSONResponse(content={
            "overview": {
                "total_contacts": total_contacts,
                "enriched_contacts": enriched_contacts,
                "enrichment_rate": (enriched_contacts / total_contacts * 100) if total_contacts > 0 else 0,
                "emails_found": emails_found,
                "phones_found": phones_found,
                "email_hit_rate": (emails_found / total_contacts * 100) if total_contacts > 0 else 0,
                "phone_hit_rate": (phones_found / total_contacts * 100) if total_contacts > 0 else 0,
                "emails_verified": stats.emails_verified or 0,
                "phones_verified": stats.phones_verified or 0,
                "total_credits_used": stats.total_credits_used or 0,
                "avg_confidence": round(float(stats.avg_confidence or 0), 2)
            },
            "providers": providers
        })
        
    except Exception as e:
        print(f"Error fetching enrichment stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contacts/recent")
async def get_recent_contacts(
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_async_session)
):
    """Get recently enriched contacts"""
    try:
        query = """
            SELECT 
                id, first_name, last_name, company, position, email, phone,
                enrichment_provider, enrichment_score, credits_consumed, created_at
            FROM contacts 
            WHERE enriched = true
            ORDER BY created_at DESC
            LIMIT :limit
        """
        
        result = await session.execute(text(query), {"limit": limit})
        contacts = []
        
        for row in result.fetchall():
            contact = dict(row._mapping)
            if contact['created_at']:
                contact['created_at'] = contact['created_at'].isoformat()
            contacts.append(contact)
        
        return JSONResponse(content={"contacts": contacts})
        
    except Exception as e:
        print(f"Error fetching recent contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contacts/export/{job_id}")
async def export_contacts(job_id: str, session: AsyncSession = Depends(get_async_session)):
    """Export enriched contacts for a specific job"""
    try:
        query = """
            SELECT 
                first_name, last_name, company, position, email, phone,
                linkedin_url, location, industry, enrichment_provider, 
                enrichment_score, credits_consumed
            FROM contacts 
            WHERE job_id = :job_id
            ORDER BY id
        """
        
        result = await session.execute(text(query), {"job_id": job_id})
        contacts = [dict(row._mapping) for row in result.fetchall()]
        
        return JSONResponse(content={
            "job_id": job_id,
            "total_contacts": len(contacts),
            "contacts": contacts
        })
        
    except Exception as e:
        print(f"Error exporting contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: int, session: AsyncSession = Depends(get_async_session)):
    """Delete a contact"""
    try:
        # Check if contact exists
        check_query = "SELECT id FROM contacts WHERE id = :contact_id"
        check_result = await session.execute(text(check_query), {"contact_id": contact_id})
        
        if not check_result.first():
            raise HTTPException(status_code=404, detail="Contact not found")
        
        # Delete the contact
        delete_query = "DELETE FROM contacts WHERE id = :contact_id"
        await session.execute(text(delete_query), {"contact_id": contact_id})
        await session.commit()
        
        return JSONResponse(content={"message": "Contact deleted successfully"})
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting contact: {e}")
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Activity endpoints
@app.get("/api/activities", response_model=List[ActivityResponse])
async def get_activities(
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    type_filter: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    session: AsyncSession = Depends(get_async_session)
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
    session: AsyncSession = Depends(get_async_session)
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
    session: AsyncSession = Depends(get_async_session)
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
    session: AsyncSession = Depends(get_async_session)
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
    session: AsyncSession = Depends(get_async_session)
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
    session: AsyncSession = Depends(get_async_session)
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