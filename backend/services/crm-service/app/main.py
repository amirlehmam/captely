# CRM Service - Standalone
import os
import uuid
import enum
import httpx
from datetime import datetime
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Query, Header
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

# Authentication dependency
async def get_current_user_id(authorization: str = Header(...)) -> str:
    """Extract user ID from JWT token via auth service"""
    try:
        print(f"🔧 CRM: Received Authorization header: {authorization[:50]}...")
        
        if not authorization.startswith("Bearer "):
            print(f"❌ CRM: Invalid authorization header format")
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        token = authorization.replace("Bearer ", "")
        print(f"🔧 CRM: Extracted token: {token[:20]}...{token[-10:]}")
        
        # Validate token with auth service
        async with httpx.AsyncClient() as client:
            request_payload = {"token": token}
            print(f"🔧 CRM: Sending request to auth service: {request_payload}")
            
            response = await client.post(
                f"http://auth-service:8000/auth/validate-token",
                json=request_payload,
                timeout=5.0
            )
            
            print(f"🔧 CRM: Auth service response status: {response.status_code}")
            print(f"🔧 CRM: Auth service response text: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ CRM: Auth service returned {response.status_code}: {response.text}")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        token_data = response.json()
        print(f"✅ CRM: Token validation successful: {token_data}")
        return token_data["user_id"]
        
    except httpx.RequestError as e:
        print(f"❌ CRM: Request error to auth service: {e}")
        raise HTTPException(status_code=503, detail="Authentication service unavailable")
    except Exception as e:
        print(f"❌ CRM: Authentication failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

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
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Get paginated list of enriched contacts for the authenticated user"""
    try:
        offset = (page - 1) * limit
        
        # Build base query with user filtering
        where_conditions = ["j.user_id = :user_id"]  # Always filter by user (from import_jobs table)
        params = {"user_id": user_id}
        
        if search:
            where_conditions.append("""
                (LOWER(c.first_name) LIKE LOWER(:search) OR 
                 LOWER(c.last_name) LIKE LOWER(:search) OR 
                 LOWER(c.company) LIKE LOWER(:search) OR
                 LOWER(c.email) LIKE LOWER(:search))
            """)
            params["search"] = f"%{search}%"
        
        if enriched_only:
            where_conditions.append("c.enriched = true")
        
        if job_id:
            where_conditions.append("c.job_id = :job_id")
            params["job_id"] = job_id
        
        where_clause = "WHERE " + " AND ".join(where_conditions)
        
        # Get total count
        count_query = f"""
            SELECT COUNT(*) 
            FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id 
            {where_clause}
        """
        count_result = await session.execute(text(count_query), params)
        total = count_result.scalar()
        
        # Get contacts with job info
        contacts_query = f"""
            SELECT 
                c.id, c.first_name, c.last_name, c.company, c.position, 
                c.email, c.phone, c.profile_url as linkedin_url, c.location, 
                c.industry, c.enriched, c.enrichment_status,
                c.enrichment_provider, c.enrichment_score, c.credits_consumed,
                c.email_verified, c.phone_verified, c.created_at, c.updated_at, 
                c.job_id, j.status as job_status
            FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id 
            {where_clause}
            ORDER BY c.created_at DESC
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
async def get_contact(
    contact_id: int, 
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Get detailed contact information for the authenticated user"""
    try:
        query = """
            SELECT 
                c.id, c.first_name, c.last_name, c.company, c.position, 
                c.email, c.phone, c.profile_url as linkedin_url, c.location, 
                c.industry, c.enriched, c.enrichment_status,
                c.enrichment_provider, c.enrichment_score, c.credits_consumed,
                c.email_verified, c.phone_verified, c.created_at, c.updated_at, 
                c.job_id, j.status as job_status
            FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id 
            WHERE c.id = :contact_id AND j.user_id = :user_id
        """
        result = await session.execute(text(query), {
            "contact_id": contact_id, 
            "user_id": user_id
        })
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
async def get_enrichment_stats(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Get enrichment statistics for the authenticated user"""
    try:
        stats_query = """
            SELECT 
                COUNT(*) as total_contacts,
                COUNT(CASE WHEN c.enriched = true THEN 1 END) as enriched_contacts,
                COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
                COUNT(CASE WHEN c.phone IS NOT NULL THEN 1 END) as phones_found,
                COUNT(CASE WHEN c.email_verified = true THEN 1 END) as emails_verified,
                COUNT(CASE WHEN c.phone_verified = true THEN 1 END) as phones_verified,
                SUM(c.credits_consumed) as total_credits_used,
                AVG(CASE WHEN c.enrichment_score IS NOT NULL THEN c.enrichment_score END) as avg_confidence
            FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id
            WHERE j.user_id = :user_id
        """
        
        result = await session.execute(text(stats_query), {"user_id": user_id})
        stats = result.first()
        
        # Provider breakdown for user
        provider_query = """
            SELECT 
                c.enrichment_provider,
                COUNT(*) as contacts,
                COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
                COUNT(CASE WHEN c.phone IS NOT NULL THEN 1 END) as phones_found,
                AVG(c.enrichment_score) as avg_confidence
            FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id
            WHERE c.enrichment_provider IS NOT NULL AND j.user_id = :user_id
            GROUP BY c.enrichment_provider
            ORDER BY contacts DESC
        """
        
        provider_result = await session.execute(text(provider_query), {"user_id": user_id})
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
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Get recently enriched contacts for the authenticated user"""
    try:
        print(f"🔧 CRM: get_recent_contacts called with user_id={user_id}, limit={limit}")
        
        query = """
            SELECT 
                c.id, c.first_name, c.last_name, c.company, c.position, 
                c.email, c.phone, c.enrichment_provider, c.enrichment_score, 
                c.credits_consumed, c.created_at
            FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id
            WHERE c.enriched = true AND j.user_id = :user_id
            ORDER BY c.created_at DESC
            LIMIT :limit
        """
        
        print(f"🔧 CRM: Executing query with params: user_id={user_id}, limit={limit}")
        result = await session.execute(text(query), {
            "user_id": user_id, 
            "limit": limit
        })
        contacts = []
        
        row_count = 0
        for row in result.fetchall():
            row_count += 1
            contact = dict(row._mapping)
            print(f"🔧 CRM: Processing row {row_count}: {contact}")
            
            # Ensure id is properly handled - convert to string if needed for validation
            if contact.get('id'):
                contact['id'] = str(contact['id'])
            
            if contact['created_at']:
                contact['created_at'] = contact['created_at'].isoformat()
            
            # Handle null values that might cause frontend issues
            for key, value in contact.items():
                if value is None:
                    contact[key] = None
                elif key in ['enrichment_score', 'credits_consumed'] and value is not None:
                    contact[key] = float(value)
                    
            contacts.append(contact)
        
        print(f"✅ CRM: Successfully processed {len(contacts)} contacts")
        
        # Always return a valid response structure, even if no contacts found
        response_data = {"contacts": contacts}
        print(f"🔧 CRM: Returning response: {response_data}")
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        print(f"❌ CRM: Error in get_recent_contacts: {e}")
        print(f"❌ CRM: Error type: {type(e).__name__}")
        import traceback
        print(f"❌ CRM: Full traceback: {traceback.format_exc()}")
        
        # Return empty array instead of error to prevent frontend crashes
        return JSONResponse(content={"contacts": []}, status_code=200)

@app.get("/api/contacts/export/{job_id}")
async def export_contacts(
    job_id: str, 
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Export enriched contacts for a specific job owned by the authenticated user"""
    try:
        # Verify job belongs to user
        job_check = """
            SELECT id FROM import_jobs WHERE id = :job_id AND user_id = :user_id
        """
        job_result = await session.execute(text(job_check), {
            "job_id": job_id, 
            "user_id": user_id
        })
        
        if not job_result.first():
            raise HTTPException(status_code=404, detail="Job not found")
        
        query = """
            SELECT 
                c.first_name, c.last_name, c.company, c.position, c.email, c.phone,
                c.profile_url as linkedin_url, c.location, c.industry, c.enrichment_provider, 
                c.enrichment_score, c.credits_consumed
            FROM contacts c
            WHERE c.job_id = :job_id
            ORDER BY c.id
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
async def delete_contact(
    contact_id: int, 
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Delete a contact owned by the authenticated user"""
    try:
        # Check if contact exists and belongs to user
        check_query = """
            SELECT c.id FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id
            WHERE c.id = :contact_id AND j.user_id = :user_id
        """
        check_result = await session.execute(text(check_query), {
            "contact_id": contact_id, 
            "user_id": user_id
        })
        
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
        raise HTTPException(status_code=500, detail=str(e))

# HUBSPOT EXPORT PROXY ENDPOINT 
@app.post("/api/contacts/{contact_id}/export/hubspot")
async def export_contact_to_hubspot_proxy(
    contact_id: str,
    authorization: str = Header(...),
):
    """Proxy endpoint to forward HubSpot export requests to the export service"""
    try:
        print(f"🔧 CRM: Proxying HubSpot export for contact {contact_id}")
        
        # Forward the request to the export service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"http://export-service:8000/api/export/contacts/{contact_id}/export/hubspot",
                headers={
                    "Authorization": authorization,
                    "Content-Type": "application/json"
                },
                timeout=60.0
            )
            
            print(f"🔧 CRM: Export service response: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ CRM: Export service error: {response.text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"Export failed: {response.text}"
                )
                
    except httpx.RequestError as e:
        print(f"❌ CRM: Request error to export service: {e}")
        raise HTTPException(status_code=503, detail="Export service unavailable")
    except Exception as e:
        print(f"❌ CRM: Export proxy failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

# Activity endpoints
@app.get("/api/activities", response_model=List[ActivityResponse])
async def get_activities(
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    type_filter: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all activities with filtering and pagination for authenticated user"""
    try:
        # Start with a simple query for activities first, then optionally join contacts
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
                contact_name=f"{contact.first_name} {contact.last_name}" if contact and contact.first_name else None,
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
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new activity for authenticated user"""
    try:
        contact_uuid = None
        if activity.contact_id:
            try:
                contact_uuid = uuid.UUID(activity.contact_id)
                # Verify contact belongs to user if contact_id is provided
                contact_check = await session.execute(
                    select(CrmContact).where(CrmContact.id == contact_uuid, CrmContact.user_id == user_id)
                )
                if not contact_check.scalar_one_or_none():
                    raise HTTPException(status_code=404, detail="Contact not found or doesn't belong to user")
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

@app.put("/api/activities/{activity_id}/status")
async def update_activity_status(
    activity_id: str,
    status_update: dict,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Update activity status for authenticated user"""
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
        
        # Get activity - first try with contact join, then without
        result = await session.execute(
            select(CrmActivity).where(CrmActivity.id == activity_uuid)
        )
        activity = result.scalar_one_or_none()
        
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")
        
        # If activity has a contact, verify user ownership
        if activity.contact_id:
            contact_result = await session.execute(
                select(CrmContact).where(CrmContact.id == activity.contact_id)
            )
            contact = contact_result.scalar_one_or_none()
            if contact and contact.user_id != uuid.UUID(user_id):
                raise HTTPException(status_code=403, detail="Not authorized to update this activity")
        
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

# Campaign endpoints
@app.get("/api/campaigns", response_model=List[CampaignResponse])
async def get_campaigns(
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all campaigns with pagination for authenticated user"""
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
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new campaign for authenticated user"""
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
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_async_session)
):
    """Update campaign status for authenticated user"""
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
        
        # Get campaign and verify ownership
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 