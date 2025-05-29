# services/crm-service/app/main.py

from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, func, desc
from datetime import datetime, timedelta
from typing import List, Optional
import uuid

from common.config import get_settings
from common.db import get_session
from common.auth import verify_api_token

from app.models import (
    CRMContact, CRMActivity, CRMCampaign, CRMCampaignContact,
    Contact, User
)
from app.schemas import (
    ContactCreate, ContactUpdate, ContactResponse,
    ActivityCreate, ActivityResponse,
    CampaignCreate, CampaignUpdate, CampaignResponse,
    CampaignContactResponse, ContactImport
)

# ---- app setup ----

app = FastAPI(
    title="Captely CRM Service",
    description="Internal CRM for managing contacts, activities, and campaigns",
    version="1.0.0",
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Contact Management ----

@app.post("/api/crm/contacts", response_model=ContactResponse)
async def create_contact(
    contact: ContactCreate,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Create a new CRM contact"""
    # Check if contact already exists
    existing = await session.execute(
        select(CRMContact).where(
            and_(
                CRMContact.user_id == user_id,
                CRMContact.email == contact.email
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Contact with this email already exists")
    
    # Create new contact
    new_contact = CRMContact(
        user_id=user_id,
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
        company=contact.company,
        position=contact.position,
        status=contact.status or 'new',
        tags=contact.tags or [],
        custom_fields=contact.custom_fields or {},
        lead_score=0
    )
    
    session.add(new_contact)
    await session.commit()
    return new_contact

@app.get("/api/crm/contacts", response_model=List[ContactResponse])
async def get_contacts(
    user_id: str = Depends(verify_api_token),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    tags: Optional[str] = None,
    search: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """Get all CRM contacts for a user with filtering"""
    query = select(CRMContact).where(CRMContact.user_id == user_id)
    
    # Apply filters
    if status:
        query = query.where(CRMContact.status == status)
    
    if tags:
        tag_list = tags.split(',')
        query = query.where(CRMContact.tags.contains(tag_list))
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                CRMContact.first_name.ilike(search_term),
                CRMContact.last_name.ilike(search_term),
                CRMContact.email.ilike(search_term),
                CRMContact.company.ilike(search_term)
            )
        )
    
    # Execute query with pagination
    query = query.order_by(desc(CRMContact.created_at)).offset(skip).limit(limit)
    result = await session.execute(query)
    contacts = result.scalars().all()
    
    return contacts

@app.get("/api/crm/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Get a specific CRM contact"""
    result = await session.execute(
        select(CRMContact).where(
            and_(
                CRMContact.id == contact_id,
                CRMContact.user_id == user_id
            )
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    return contact

@app.put("/api/crm/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    contact_update: ContactUpdate,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Update a CRM contact"""
    result = await session.execute(
        select(CRMContact).where(
            and_(
                CRMContact.id == contact_id,
                CRMContact.user_id == user_id
            )
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Update fields
    for field, value in contact_update.dict(exclude_unset=True).items():
        setattr(contact, field, value)
    
    contact.updated_at = datetime.utcnow()
    await session.commit()
    
    return contact

@app.post("/api/crm/contacts/import")
async def import_contacts(
    contact_import: ContactImport,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Import contacts from enrichment job"""
    # Get enriched contacts from job
    if contact_import.job_id:
        enriched_contacts = await session.execute(
            select(Contact).where(
                and_(
                    Contact.job_id == contact_import.job_id,
                    Contact.enriched == True,
                    Contact.email.isnot(None)
                )
            )
        )
        contacts = enriched_contacts.scalars().all()
    else:
        contacts = []
    
    imported_count = 0
    skipped_count = 0
    
    for contact in contacts:
        # Check if already exists
        existing = await session.execute(
            select(CRMContact).where(
                and_(
                    CRMContact.user_id == user_id,
                    CRMContact.email == contact.email
                )
            )
        )
        if existing.scalar_one_or_none():
            skipped_count += 1
            continue
        
        # Create CRM contact
        crm_contact = CRMContact(
            user_id=user_id,
            contact_id=contact.id,
            first_name=contact.first_name,
            last_name=contact.last_name,
            email=contact.email,
            phone=contact.phone,
            company=contact.company,
            position=contact.position,
            status='new',
            tags=contact_import.default_tags or [],
            crm_provider='internal'
        )
        session.add(crm_contact)
        imported_count += 1
    
    await session.commit()
    
    return {
        "imported": imported_count,
        "skipped": skipped_count,
        "total": len(contacts)
    }

# ---- Activity Management ----

@app.post("/api/crm/activities", response_model=ActivityResponse)
async def create_activity(
    activity: ActivityCreate,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Create a new activity for a contact"""
    # Verify contact exists
    contact_result = await session.execute(
        select(CRMContact).where(
            and_(
                CRMContact.id == activity.contact_id,
                CRMContact.user_id == user_id
            )
        )
    )
    contact = contact_result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Create activity
    new_activity = CRMActivity(
        user_id=user_id,
        contact_id=activity.contact_id,
        type=activity.type,
        subject=activity.subject,
        content=activity.content,
        status=activity.status or 'completed',
        scheduled_at=activity.scheduled_at,
        completed_at=activity.completed_at or (datetime.utcnow() if activity.status == 'completed' else None)
    )
    
    session.add(new_activity)
    
    # Update contact's last activity
    contact.last_activity_at = datetime.utcnow()
    if activity.type in ['email', 'call', 'meeting']:
        contact.last_contacted_at = datetime.utcnow()
    
    await session.commit()
    return new_activity

@app.get("/api/crm/activities", response_model=List[ActivityResponse])
async def get_activities(
    user_id: str = Depends(verify_api_token),
    contact_id: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    session: AsyncSession = Depends(get_session)
):
    """Get activities with filtering"""
    query = select(CRMActivity).where(CRMActivity.user_id == user_id)
    
    if contact_id:
        query = query.where(CRMActivity.contact_id == contact_id)
    if type:
        query = query.where(CRMActivity.type == type)
    if status:
        query = query.where(CRMActivity.status == status)
    
    query = query.order_by(desc(CRMActivity.created_at)).offset(skip).limit(limit)
    result = await session.execute(query)
    activities = result.scalars().all()
    
    return activities

# ---- Campaign Management ----

@app.post("/api/crm/campaigns", response_model=CampaignResponse)
async def create_campaign(
    campaign: CampaignCreate,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Create a new campaign"""
    new_campaign = CRMCampaign(
        user_id=user_id,
        name=campaign.name,
        type=campaign.type,
        status='draft',
        from_email=campaign.from_email,
        from_name=campaign.from_name,
        reply_to_email=campaign.reply_to_email,
        subject_lines=campaign.subject_lines or [],
        email_templates=campaign.email_templates or [],
        timezone=campaign.timezone or 'UTC',
        send_days=campaign.send_days or [1, 2, 3, 4, 5],
        send_hours_start=campaign.send_hours_start or 9,
        send_hours_end=campaign.send_hours_end or 17,
        daily_limit=campaign.daily_limit or 50
    )
    
    session.add(new_campaign)
    await session.commit()
    return new_campaign

@app.get("/api/crm/campaigns", response_model=List[CampaignResponse])
async def get_campaigns(
    user_id: str = Depends(verify_api_token),
    status: Optional[str] = None,
    type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    session: AsyncSession = Depends(get_session)
):
    """Get all campaigns for a user"""
    query = select(CRMCampaign).where(CRMCampaign.user_id == user_id)
    
    if status:
        query = query.where(CRMCampaign.status == status)
    if type:
        query = query.where(CRMCampaign.type == type)
    
    query = query.order_by(desc(CRMCampaign.created_at)).offset(skip).limit(limit)
    result = await session.execute(query)
    campaigns = result.scalars().all()
    
    return campaigns

@app.post("/api/crm/campaigns/{campaign_id}/contacts")
async def add_contacts_to_campaign(
    campaign_id: str,
    contact_ids: List[str],
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Add contacts to a campaign"""
    # Verify campaign exists
    campaign_result = await session.execute(
        select(CRMCampaign).where(
            and_(
                CRMCampaign.id == campaign_id,
                CRMCampaign.user_id == user_id
            )
        )
    )
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    added_count = 0
    
    for contact_id in contact_ids:
        # Check if contact exists and not already in campaign
        existing = await session.execute(
            select(CRMCampaignContact).where(
                and_(
                    CRMCampaignContact.campaign_id == campaign_id,
                    CRMCampaignContact.contact_id == contact_id
                )
            )
        )
        if existing.scalar_one_or_none():
            continue
        
        # Add to campaign
        campaign_contact = CRMCampaignContact(
            campaign_id=campaign_id,
            contact_id=contact_id,
            status='pending'
        )
        session.add(campaign_contact)
        added_count += 1
    
    # Update campaign total contacts
    campaign.total_contacts += added_count
    
    await session.commit()
    
    return {
        "added": added_count,
        "total_contacts": campaign.total_contacts
    }

@app.put("/api/crm/campaigns/{campaign_id}/status")
async def update_campaign_status(
    campaign_id: str,
    new_status: str,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Update campaign status (start, pause, complete)"""
    result = await session.execute(
        select(CRMCampaign).where(
            and_(
                CRMCampaign.id == campaign_id,
                CRMCampaign.user_id == user_id
            )
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Validate status transition
    valid_statuses = ['draft', 'active', 'paused', 'completed']
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    campaign.status = new_status
    campaign.updated_at = datetime.utcnow()
    
    await session.commit()
    
    return {"campaign_id": campaign_id, "new_status": new_status}

# ---- Analytics & Reporting ----

@app.get("/api/crm/analytics/overview")
async def get_crm_analytics(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Get CRM analytics overview"""
    # Contact stats
    total_contacts = await session.execute(
        select(func.count()).select_from(CRMContact).where(CRMContact.user_id == user_id)
    )
    
    contact_by_status = await session.execute(
        select(CRMContact.status, func.count())
        .select_from(CRMContact)
        .where(CRMContact.user_id == user_id)
        .group_by(CRMContact.status)
    )
    
    # Activity stats
    recent_activities = await session.execute(
        select(CRMActivity.type, func.count())
        .select_from(CRMActivity)
        .where(
            and_(
                CRMActivity.user_id == user_id,
                CRMActivity.created_at >= datetime.utcnow() - timedelta(days=30)
            )
        )
        .group_by(CRMActivity.type)
    )
    
    # Campaign stats
    active_campaigns = await session.execute(
        select(func.count())
        .select_from(CRMCampaign)
        .where(
            and_(
                CRMCampaign.user_id == user_id,
                CRMCampaign.status == 'active'
            )
        )
    )
    
    return {
        "contacts": {
            "total": total_contacts.scalar(),
            "by_status": {row[0]: row[1] for row in contact_by_status}
        },
        "activities": {
            "recent_30_days": {row[0]: row[1] for row in recent_activities}
        },
        "campaigns": {
            "active": active_campaigns.scalar()
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 