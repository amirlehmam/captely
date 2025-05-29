# services/crm-service/app/schemas.py

from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, Dict, List
from uuid import UUID

# Contact schemas
class ContactCreate(BaseModel):
    first_name: str
    last_name: Optional[str]
    email: EmailStr
    phone: Optional[str]
    company: Optional[str]
    position: Optional[str]
    status: Optional[str] = 'new'
    tags: Optional[List[str]] = []
    custom_fields: Optional[Dict] = {}

class ContactUpdate(BaseModel):
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    company: Optional[str]
    position: Optional[str]
    status: Optional[str]
    lead_score: Optional[int]
    deal_value: Optional[float]
    tags: Optional[List[str]]
    custom_fields: Optional[Dict]
    next_follow_up: Optional[datetime]

class ContactResponse(BaseModel):
    id: UUID
    user_id: UUID
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    company: Optional[str]
    position: Optional[str]
    status: str
    lead_score: int
    deal_value: Optional[float]
    tags: Optional[List[str]]
    custom_fields: Dict
    last_contacted_at: Optional[datetime]
    last_activity_at: Optional[datetime]
    next_follow_up: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class ContactImport(BaseModel):
    job_id: str
    default_tags: Optional[List[str]] = []

# Activity schemas
class ActivityCreate(BaseModel):
    contact_id: UUID
    type: str = Field(..., regex="^(email|call|meeting|note|task)$")
    subject: Optional[str]
    content: Optional[str]
    status: Optional[str] = Field(default="completed", regex="^(scheduled|completed|cancelled)$")
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]

class ActivityResponse(BaseModel):
    id: UUID
    user_id: UUID
    contact_id: UUID
    type: str
    subject: Optional[str]
    content: Optional[str]
    status: str
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        orm_mode = True

# Campaign schemas
class CampaignCreate(BaseModel):
    name: str
    type: str = Field(..., regex="^(email|linkedin|cold_call|multi_channel)$")
    from_email: Optional[EmailStr]
    from_name: Optional[str]
    reply_to_email: Optional[EmailStr]
    subject_lines: Optional[List[str]]
    email_templates: Optional[List[str]]
    timezone: Optional[str] = 'UTC'
    send_days: Optional[List[int]] = [1, 2, 3, 4, 5]
    send_hours_start: Optional[int] = 9
    send_hours_end: Optional[int] = 17
    daily_limit: Optional[int] = 50

class CampaignUpdate(BaseModel):
    name: Optional[str]
    from_email: Optional[EmailStr]
    from_name: Optional[str]
    reply_to_email: Optional[EmailStr]
    subject_lines: Optional[List[str]]
    email_templates: Optional[List[str]]
    timezone: Optional[str]
    send_days: Optional[List[int]]
    send_hours_start: Optional[int]
    send_hours_end: Optional[int]
    daily_limit: Optional[int]

class CampaignResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    type: str
    status: str
    from_email: Optional[str]
    from_name: Optional[str]
    reply_to_email: Optional[str]
    subject_lines: Optional[List[str]]
    email_templates: Optional[List[str]]
    timezone: str
    send_days: Optional[List[int]]
    send_hours_start: int
    send_hours_end: int
    daily_limit: int
    total_contacts: int
    sent_count: int
    open_count: int
    click_count: int
    reply_count: int
    bounce_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class CampaignContactResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    contact_id: UUID
    status: str
    sent_at: Optional[datetime]
    opened_at: Optional[datetime]
    clicked_at: Optional[datetime]
    replied_at: Optional[datetime]
    bounced_at: Optional[datetime]
    unsubscribed_at: Optional[datetime]
    
    class Config:
        orm_mode = True 