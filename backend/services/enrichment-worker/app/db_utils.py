# backend/services/enrichment-worker/app/db_utils.py
import json
import httpx
from datetime import datetime
from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker as sync_sessionmaker
from sqlalchemy import insert, update, text, Table, Column, Integer, String, MetaData, TIMESTAMP, Boolean, Float, JSON, create_engine

from app.config import get_settings
from app.common import logger

settings = get_settings()

# Define metadata and tables (mirroring app/tasks.py structure for now)
metadata = MetaData()

import_jobs = Table(
    'import_jobs', metadata,
    Column('id', String, primary_key=True),
    Column('user_id', String),
    Column('status', String),
    Column('total', Integer),
    Column('completed', Integer),
    Column('created_at', TIMESTAMP),
    Column('updated_at', TIMESTAMP)
)

contacts = Table(
    'contacts', metadata,
    Column('id', Integer, primary_key=True, autoincrement=True), # Added autoincrement
    Column('job_id', String),
    Column('user_id', String, nullable=True), # Added user_id
    Column('first_name', String),
    Column('last_name', String),
    Column('position', String),
    Column('company', String),
    Column('company_domain', String, nullable=True),
    Column('profile_url', String, nullable=True),
    Column('location', String, nullable=True),
    Column('industry', String, nullable=True),
    Column('email', String, nullable=True),
    Column('phone', String, nullable=True),
    Column('enriched', Boolean, default=False),
    Column('enrichment_status', String, default='pending'),
    Column('enrichment_provider', String, nullable=True),
    Column('enrichment_score', Float, nullable=True),
    Column('email_verified', Boolean, default=False),
    Column('phone_verified', Boolean, default=False),
    Column('credits_consumed', Integer, default=0), # Added credits_consumed
    Column('created_at', TIMESTAMP, default=datetime.utcnow),
    Column('updated_at', TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
)

enrichment_results = Table(
    'enrichment_results', metadata,
    Column('id', Integer, primary_key=True, autoincrement=True), # Added autoincrement
    Column('contact_id', Integer), # Foreign key to contacts.id
    Column('provider', String),
    Column('email', String, nullable=True),
    Column('phone', String, nullable=True),
    Column('confidence_score', Float, nullable=True),
    Column('email_verified', Boolean, default=False),
    Column('phone_verified', Boolean, default=False),
    Column('raw_data', JSON, nullable=True),
    Column('created_at', TIMESTAMP, default=datetime.utcnow)
)

# Synchronous engine for Celery tasks that can't easily use async sessions
# The DSN needs to be adjusted for synchronous psycopg2
sync_db_url = settings.database_url
if '+asyncpg' in sync_db_url:
    sync_db_url = sync_db_url.replace('+asyncpg', '')
elif 'postgresql://' not in sync_db_url and 'postgres://' not in sync_db_url : # if it's just a DSN string
    # this is a simple heuristic, might need adjustment based on actual DSN format
    sync_db_url = f"postgresql://{sync_db_url}"


sync_engine = create_engine(sync_db_url)
SyncSessionLocal = sync_sessionmaker(bind=sync_engine)


async def get_or_create_job_async(session: AsyncSession, job_id: str, user_id: str, total_contacts: int) -> str:
    """Get or create an import job record (async)."""
    stmt = text("SELECT id FROM import_jobs WHERE id = :job_id")
    result = await session.execute(stmt, {"job_id": job_id})
    job = result.first()
    
    if not job:
        stmt_insert = insert(import_jobs).values(
            id=job_id,
            user_id=user_id,
            status="processing",
            total=total_contacts,
            completed=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        await session.execute(stmt_insert)
        await session.commit()
    return job_id

def get_or_create_job_sync(session, job_id: str, user_id: str, total_contacts: int) -> str:
    """Get or create an import job record (sync)."""
    stmt = text("SELECT id FROM import_jobs WHERE id = :job_id")
    result = session.execute(stmt, {"job_id": job_id})
    job = result.first()

    if not job:
        stmt_insert = insert(import_jobs).values(
            id=job_id,
            user_id=user_id,
            status="processing",
            total=total_contacts,
            completed=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.execute(stmt_insert)
        session.commit()
    return job_id


async def save_contact_async(session: AsyncSession, job_id: str, user_id: str, lead: dict) -> int:
    """Save a contact to the database and return its ID (async)."""
    def clean_value(value):
        import math
        if isinstance(value, float) and math.isnan(value): return ""
        return value if value is not None else ""

    stmt = insert(contacts).values(
        job_id=job_id,
        user_id=user_id,
        first_name=clean_value(lead.get("first_name", "")),
        last_name=clean_value(lead.get("last_name", "")),
        position=clean_value(lead.get("position", "")),
        company=clean_value(lead.get("company", "")),
        company_domain=clean_value(lead.get("company_domain", "")),
        profile_url=clean_value(lead.get("profile_url", "")),
        location=clean_value(lead.get("location", "")),
        industry=clean_value(lead.get("industry", "")),
        enriched=False,
        enrichment_status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    ).returning(contacts.c.id)
    
    result = await session.execute(stmt)
    contact_id = result.scalar_one()
    await session.commit()
    return contact_id

def save_contact_sync(session, job_id: str, user_id: str, lead: dict, enrichment_data: Optional[Dict[str, Any]] = None) -> int:
    """Save a contact to the database and return its ID (sync)."""
    def clean_value(value):
        import math
        if isinstance(value, float) and math.isnan(value): return ""
        return value if value is not None else ""

    values_to_insert = {
        "job_id": job_id,
        "user_id": user_id,
        "first_name": clean_value(lead.get("first_name", "")),
        "last_name": clean_value(lead.get("last_name", "")),
        "position": clean_value(lead.get("position", "")),
        "company": clean_value(lead.get("company", "")),
        "company_domain": clean_value(lead.get("company_domain", "")),
        "profile_url": clean_value(lead.get("profile_url", "")),
        "location": clean_value(lead.get("location", "")),
        "industry": clean_value(lead.get("industry", "")),
        "enriched": False,
        "enrichment_status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    if enrichment_data:
        values_to_insert.update({
            "email": enrichment_data.get("email"),
            "phone": enrichment_data.get("phone"),
            "enriched": True,
            "enrichment_status": "completed",
            "enrichment_provider": enrichment_data.get("provider"),
            "enrichment_score": enrichment_data.get("confidence"),
            "email_verified": enrichment_data.get("email_verified", False),
            "phone_verified": enrichment_data.get("phone_verified", False),
            "credits_consumed": enrichment_data.get("credits_consumed", 0)
        })
    else: # if no enrichment data, explicitly set to pending/false
        values_to_insert.update({
            "enriched": False,
            "enrichment_status": "failed", # Or "pending" if it's pre-enrichment save
            "enrichment_provider": None,
            "credits_consumed": 0
        })


    stmt = insert(contacts).values(**values_to_insert).returning(contacts.c.id)
    result = session.execute(stmt)
    contact_id = result.scalar_one()
    session.commit() # Commit after insert
    return contact_id


async def update_contact_enrichment_async(
    session: AsyncSession, 
    contact_id: int, 
    enrichment_data: Dict[str, Any]
):
    """Update contact with enrichment results (async)."""
    values_to_update = {
        "enriched": True,
        "enrichment_status": "completed",
        "updated_at": datetime.utcnow()
    }
    if "email" in enrichment_data: values_to_update["email"] = enrichment_data["email"]
    if "phone" in enrichment_data: values_to_update["phone"] = enrichment_data["phone"]
    if "provider" in enrichment_data: values_to_update["enrichment_provider"] = enrichment_data["provider"]
    if "confidence" in enrichment_data: values_to_update["enrichment_score"] = enrichment_data["confidence"]
    if "email_verified" in enrichment_data: values_to_update["email_verified"] = enrichment_data["email_verified"]
    if "phone_verified" in enrichment_data: values_to_update["phone_verified"] = enrichment_data["phone_verified"]
    if "credits_consumed" in enrichment_data: values_to_update["credits_consumed"] = enrichment_data["credits_consumed"]

    stmt = update(contacts).where(contacts.c.id == contact_id).values(**values_to_update)
    await session.execute(stmt)
    await session.commit()

def update_contact_enrichment_sync(
    session, 
    contact_id: int, 
    enrichment_data: Dict[str, Any]
):
    """Update contact with enrichment results (sync)."""
    values_to_update = {
        "enriched": True,
        "enrichment_status": "completed",
        "updated_at": datetime.utcnow()
    }
    if "email" in enrichment_data: values_to_update["email"] = enrichment_data["email"]
    if "phone" in enrichment_data: values_to_update["phone"] = enrichment_data["phone"]
    if "provider" in enrichment_data: values_to_update["enrichment_provider"] = enrichment_data["provider"]
    if "confidence" in enrichment_data: values_to_update["enrichment_score"] = enrichment_data["confidence"]
    if "email_verified" in enrichment_data: values_to_update["email_verified"] = enrichment_data["email_verified"]
    if "phone_verified" in enrichment_data: values_to_update["phone_verified"] = enrichment_data["phone_verified"]
    if "credits_consumed" in enrichment_data: values_to_update["credits_consumed"] = enrichment_data["credits_consumed"]
    
    stmt = update(contacts).where(contacts.c.id == contact_id).values(**values_to_update)
    session.execute(stmt)
    session.commit()


async def save_enrichment_result_async(
    session: AsyncSession, 
    contact_id: int, 
    provider: str, 
    result_data: Dict[str, Any]
):
    """Save enrichment result to the database (async)."""
    stmt = insert(enrichment_results).values(
        contact_id=contact_id,
        provider=provider,
        email=result_data.get("email"),
        phone=result_data.get("phone"),
        confidence_score=result_data.get("confidence", 0),
        email_verified=result_data.get("email_verified", False),
        phone_verified=result_data.get("phone_verified", False),
        raw_data=json.dumps(result_data.get("raw_data", {})), # Ensure raw_data is JSON serialized
        created_at=datetime.utcnow()
    )
    await session.execute(stmt)
    await session.commit()

def save_enrichment_result_sync(
    session, 
    contact_id: int, 
    provider: str, 
    result_data: Dict[str, Any]
):
    """Save enrichment result to the database (sync)."""
    stmt = insert(enrichment_results).values(
        contact_id=contact_id,
        provider=provider,
        email=result_data.get("email"),
        phone=result_data.get("phone"),
        confidence_score=result_data.get("confidence", 0),
        email_verified=result_data.get("email_verified", False),
        phone_verified=result_data.get("phone_verified", False),
        raw_data=json.dumps(result_data.get("raw_data", {})),
        created_at=datetime.utcnow()
    )
    session.execute(stmt)
    session.commit()


async def increment_job_progress_async(session: AsyncSession, job_id: str):
    """Increment the completed count for a job (async)."""
    stmt = update(import_jobs).where(import_jobs.c.id == job_id).values(
        completed=import_jobs.c.completed + 1,
        updated_at=datetime.utcnow()
    )
    await session.execute(stmt)
    await session.commit()

def increment_job_progress_sync(session, job_id: str):
    """Increment the completed count for a job (sync)."""
    stmt = update(import_jobs).where(import_jobs.c.id == job_id).values(
        completed=import_jobs.c.completed + 1,
        updated_at=datetime.utcnow()
    )
    session.execute(stmt)
    session.commit()


async def update_job_status_async(session: AsyncSession, job_id: str, status: str):
    """Update the status of a job (async)."""
    stmt = update(import_jobs).where(import_jobs.c.id == job_id).values(
        status=status,
        updated_at=datetime.utcnow()
    )
    await session.execute(stmt)
    await session.commit()

def update_job_status_sync(session, job_id: str, status: str):
    """Update the status of a job (sync)."""
    stmt = update(import_jobs).where(import_jobs.c.id == job_id).values(
        status=status,
        updated_at=datetime.utcnow()
    )
    session.execute(stmt)
    session.commit()

def charge_credits_sync(session, user_id: str, credits_to_charge: int, reason: str) -> bool:
    """Charge credits from a user and log the transaction (sync). Returns True if successful."""
    try:
        user_result = session.execute(
            text("SELECT credits FROM users WHERE id = :user_id FOR UPDATE"),
            {"user_id": user_id}
        )
        user_row = user_result.first()

        if not user_row:
            logger.error(f"User {user_id} not found for credit charging.")
            return False
        
        current_credits = user_row[0] if user_row[0] is not None else 0

        if current_credits < credits_to_charge:
            logger.warning(f"Insufficient credits for user {user_id}. Has {current_credits}, needs {credits_to_charge}")
            return False

        session.execute(
            text("UPDATE users SET credits = credits - :credits WHERE id = :user_id"),
            {"user_id": user_id, "credits": credits_to_charge}
        )
        
        session.execute(
            text("""
                INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at)
                VALUES (:user_id, 'enrichment', :cost, :change, :reason, CURRENT_TIMESTAMP)
            """),
            {
                "user_id": user_id,
                "cost": credits_to_charge,
                "change": -credits_to_charge,
                "reason": reason
            }
        )
        session.commit()
        logger.info(f"Charged {credits_to_charge} credits from user {user_id}. Reason: {reason}. Remaining: {current_credits - credits_to_charge}")
        return True
    except Exception as e:
        logger.error(f"Credit charging failed for user {user_id}: {e}")
        session.rollback()
        return False

def get_job_stats_sync(session, job_id: str) -> Dict[str, Any]:
    """Get statistics for a completed job (sync)."""
    stats_query = text("""
        SELECT 
            COUNT(*) as total_contacts,
            COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found,
            COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as phones_found,
            SUM(credits_consumed) as total_credits_used
        FROM contacts
        WHERE job_id = :job_id
    """)
    stats_result = session.execute(stats_query, {"job_id": job_id})
    stats = stats_result.first()
    if stats:
        return {
            "total_contacts": stats[0] or 0,
            "emails_found": stats[1] or 0,
            "phones_found": stats[2] or 0,
            "total_credits_used": float(stats[3] or 0)
        }
    return {
        "total_contacts": 0, "emails_found": 0, 
        "phones_found": 0, "total_credits_used": 0
    }

async def save_to_crm(contact_data: Dict[str, Any]):
    """Save enriched contact to CRM service (async)."""
    # This function remains largely the same as it calls an external service.
    # Ensure it's using httpx for async calls if called from async context,
    # or requests if called from sync. For simplicity, using httpx.
    try:
        crm_contact = {
            "first_name": contact_data.get("first_name", ""),
            "last_name": contact_data.get("last_name", ""),
            "email": contact_data.get("email"),
            "phone": contact_data.get("phone"),
            "company": contact_data.get("company"),
            "position": contact_data.get("position"),
            "status": "new", # Or determine based on enrichment
            "lead_score": contact_data.get("enrichment_score", 50), # Use enrichment_score
            "user_id": contact_data.get("user_id") # Ensure user_id is passed
        }
        
        # Assuming CRM service is available at this address
        # TODO: Move CRM service URL to config
        crm_service_url = os.environ.get("CRM_SERVICE_URL", "http://crm-service:8008/api/contacts")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                crm_service_url,
                json=crm_contact,
                timeout=10
            )
        
        if response.status_code == 201: # Created
            logger.info(f"Contact {crm_contact.get('email')} saved to CRM.")
        else:
            logger.warning(f"Failed to save contact {crm_contact.get('email')} to CRM: {response.status_code} - {response.text}")
            
    except Exception as e:
        logger.error(f"Error saving contact to CRM: {str(e)}")

def get_contact_details_sync(session, contact_id: int) -> Optional[Dict[str, Any]]:
    """Fetch contact details by ID (sync)."""
    stmt = text("SELECT * FROM contacts WHERE id = :contact_id")
    result = session.execute(stmt, {"contact_id": contact_id})
    contact_row = result.first()
    if contact_row:
        # Convert row to dict
        return dict(zip(result.keys(), contact_row))
    return None