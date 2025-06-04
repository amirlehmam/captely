# backend/services/enrichment-worker/app/db_utils.py
import json
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, List

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


async def get_or_create_job(session: AsyncSession, job_id: str, user_id: str, total_contacts: int) -> str:
    """Get or create an import job record."""
    try:
        # Check if job exists
        stmt = text("SELECT id FROM import_jobs WHERE id = :job_id LIMIT 1")
        result = await session.execute(stmt, {"job_id": job_id})
        job = result.first()
        
        if not job:
            # Create new job
            stmt = text("""
                INSERT INTO import_jobs (id, user_id, status, total, completed, created_at, updated_at) 
                VALUES (:job_id, :user_id, :status, :total, :completed, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """)
            await session.execute(stmt, {
                "job_id": job_id,
                "user_id": user_id,
                "status": "processing",
                "total": total_contacts,
                "completed": 0
            })
            await session.commit()
            logger.info(f"Created new job {job_id} with {total_contacts} contacts")
        
        return job_id
        
    except Exception as e:
        logger.error(f"Error creating/getting job {job_id}: {e}")
        await session.rollback()
        raise


async def save_contact(session: AsyncSession, job_id: str, lead: Dict[str, Any]) -> int:
    """Save a contact to the database and return its ID."""
    try:
        # Clean NaN values from lead data
        def clean_value(value):
            import math
            if isinstance(value, float) and math.isnan(value):
                return ""
            return value if value is not None else ""
        
        # Handle name fields properly
        first_name = clean_value(lead.get("first_name", ""))
        last_name = clean_value(lead.get("last_name", ""))
        full_name = clean_value(lead.get("full_name", ""))
        
        # If we have full_name but no first/last, try to split
        if full_name and (not first_name or not last_name):
            name_parts = full_name.split(" ", 1)
            if len(name_parts) >= 2:
                if not first_name:
                    first_name = name_parts[0]
                if not last_name:
                    last_name = name_parts[1]
            elif len(name_parts) == 1 and not last_name:
                last_name = name_parts[0]
        
        stmt = text("""
            INSERT INTO contacts (
                job_id, first_name, last_name, company, position, location, 
                industry, profile_url, company_domain, enriched, enrichment_status,
                email_verified, phone_verified, created_at, updated_at
            ) VALUES (
                :job_id, :first_name, :last_name, :company, :position, :location,
                :industry, :profile_url, :company_domain, false, 'pending',
                false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id
        """)
        
        result = await session.execute(stmt, {
            "job_id": job_id,
            "first_name": first_name,
            "last_name": last_name,
            "company": clean_value(lead.get("company", "")),
            "position": clean_value(lead.get("position", "")),
            "location": clean_value(lead.get("location", "")),
            "industry": clean_value(lead.get("industry", "")),
            "profile_url": clean_value(lead.get("profile_url", "")),
            "company_domain": clean_value(lead.get("company_domain", ""))
        })
        
        contact_id = result.scalar_one()
        await session.commit()
        
        logger.debug(f"Saved contact {contact_id}: {first_name} {last_name} at {lead.get('company', '')}")
        return contact_id
        
    except Exception as e:
        logger.error(f"Error saving contact: {e}")
        await session.rollback()
        raise


async def update_contact(
    session: AsyncSession, 
    contact_id: int, 
    email: Optional[str] = None, 
    phone: Optional[str] = None,
    enrichment_data: Optional[Dict[str, Any]] = None
):
    """Update contact with enrichment results and verification data."""
    try:
        # Build dynamic SET clause based on provided parameters
        set_clauses = []
        params = {"contact_id": contact_id}
        
        # Add email and phone if provided
        if email is not None:
            set_clauses.append("email = :email")
            params["email"] = email
            
        if phone is not None:
            set_clauses.append("phone = :phone")
            params["phone"] = phone
        
        # Add enrichment data if provided
        if enrichment_data:
            if email is not None or phone is not None:
                set_clauses.append("enriched = true")
                set_clauses.append("enrichment_status = 'completed'")
            
            if "provider" in enrichment_data:
                set_clauses.append("enrichment_provider = :enrichment_provider")
                params["enrichment_provider"] = enrichment_data["provider"]
                
            if "confidence" in enrichment_data:
                set_clauses.append("enrichment_score = :enrichment_score")
                params["enrichment_score"] = enrichment_data["confidence"]
                
            if "email_verified" in enrichment_data:
                set_clauses.append("email_verified = :email_verified")
                params["email_verified"] = enrichment_data["email_verified"]
                
            if "phone_verified" in enrichment_data:
                set_clauses.append("phone_verified = :phone_verified")
                params["phone_verified"] = enrichment_data["phone_verified"]
                
            if "email_verification_score" in enrichment_data:
                set_clauses.append("email_verification_score = :email_verification_score")
                params["email_verification_score"] = enrichment_data["email_verification_score"]
                
            if "phone_verification_score" in enrichment_data:
                set_clauses.append("phone_verification_score = :phone_verification_score")
                params["phone_verification_score"] = enrichment_data["phone_verification_score"]
        
        # Add updated_at always
        set_clauses.append("updated_at = CURRENT_TIMESTAMP")
        
        # Build and execute the query
        if set_clauses:
            set_clause = ", ".join(set_clauses)
            stmt = text(f"UPDATE contacts SET {set_clause} WHERE id = :contact_id")
            await session.execute(stmt, params)
            await session.commit()
            
            logger.debug(f"Updated contact {contact_id} with enrichment data")
        
    except Exception as e:
        logger.error(f"Error updating contact {contact_id}: {e}")
        await session.rollback()
        raise


async def save_enrichment_result(
    session: AsyncSession, 
    contact_id: int, 
    provider: str, 
    result: Dict[str, Any]
):
    """Save enrichment result to the database."""
    try:
        stmt = text("""
            INSERT INTO enrichment_results (
                contact_id, provider, email, phone, confidence_score, 
                email_verified, phone_verified, raw_data, created_at
            ) VALUES (
                :contact_id, :provider, :email, :phone, :confidence_score,
                :email_verified, :phone_verified, :raw_data, CURRENT_TIMESTAMP
            )
        """)
        
        # Prepare raw_data as JSON string
        raw_data = json.dumps(result.get("raw_data", {})) if result.get("raw_data") else None
        
        await session.execute(stmt, {
            "contact_id": contact_id,
            "provider": provider,
            "email": result.get("email"),
            "phone": result.get("phone"),
            "confidence_score": result.get("confidence", 0),
            "email_verified": result.get("email_verified", False),
            "phone_verified": result.get("phone_verified", False),
            "raw_data": raw_data
        })
        
        await session.commit()
        logger.debug(f"Saved enrichment result for contact {contact_id} from {provider}")
        
    except Exception as e:
        logger.error(f"Error saving enrichment result for contact {contact_id}: {e}")
        await session.rollback()
        raise


async def increment_job_progress(session: AsyncSession, job_id: str):
    """Increment the completed count for a job."""
    try:
        stmt = text("""
            UPDATE import_jobs 
            SET completed = completed + 1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = :job_id
        """)
        await session.execute(stmt, {"job_id": job_id})
        await session.commit()
        
        # Check if job is complete
        check_stmt = text("""
            SELECT total, completed, status 
            FROM import_jobs 
            WHERE id = :job_id
        """)
        result = await session.execute(check_stmt, {"job_id": job_id})
        job_data = result.first()
        
        if job_data and job_data[1] >= job_data[0] and job_data[2] != 'completed':
            # Job is complete, update status
            await update_job_status(session, job_id, "completed")
            logger.info(f"Job {job_id} completed: {job_data[1]}/{job_data[0]} contacts processed")
        
    except Exception as e:
        logger.error(f"Error incrementing job progress for {job_id}: {e}")
        await session.rollback()
        raise


async def update_job_status(session: AsyncSession, job_id: str, status: str):
    """Update the status of a job."""
    try:
        stmt = text("""
            UPDATE import_jobs 
            SET status = :status, updated_at = CURRENT_TIMESTAMP 
            WHERE id = :job_id
        """)
        
        await session.execute(stmt, {"job_id": job_id, "status": status})
        await session.commit()
        
        logger.info(f"Updated job {job_id} status to {status}")
        
    except Exception as e:
        logger.error(f"Error updating job status for {job_id}: {e}")
        await session.rollback()
        raise


async def consume_credits(
    session: AsyncSession, 
    user_id: str, 
    contact_id: int, 
    email_found: bool, 
    phone_found: bool, 
    provider: str
):
    """Consume credits based on successful enrichment results."""
    try:
        credits_used = 0
        
        # Calculate credits based on results
        if email_found:
            credits_used += 1  # 1 credit for email
        if phone_found:
            credits_used += 10  # 10 credits for phone
        
        if credits_used > 0:
            # Check current credits
            user_check = text("SELECT credits FROM users WHERE id = :user_id")
            result = await session.execute(user_check, {"user_id": user_id})
            user_row = result.first()
            
            if not user_row:
                logger.error(f"User {user_id} not found for credit consumption")
                return 0
                
            current_credits = user_row[0] if user_row[0] is not None else 0
            
            if current_credits < credits_used:
                logger.warning(f"Insufficient credits for user {user_id}: has {current_credits}, needs {credits_used}")
                return 0
            
            # Update user credits
            user_update = text("UPDATE users SET credits = credits - :credits WHERE id = :user_id")
            await session.execute(user_update, {"credits": credits_used, "user_id": user_id})
            
            # Log the credit consumption
            credit_log = text("""
                INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at) 
                VALUES (:user_id, :operation_type, :cost, :change, :reason, CURRENT_TIMESTAMP)
            """)
            
            reason_parts = []
            if email_found:
                reason_parts.append("email (+1)")
            if phone_found:
                reason_parts.append("phone (+10)")
            
            reason = f"Enrichment via {provider}: {', '.join(reason_parts)}"
            
            await session.execute(credit_log, {
                "user_id": user_id,
                "operation_type": "enrichment",
                "cost": credits_used,
                "change": -credits_used,
                "reason": reason
            })
            
            # Update contact with credits consumed
            contact_update = text("UPDATE contacts SET credits_consumed = :credits WHERE id = :contact_id")
            await session.execute(contact_update, {"credits": credits_used, "contact_id": contact_id})
            
            await session.commit()
            logger.info(f"Consumed {credits_used} credits for contact {contact_id} via {provider}")
            
        return credits_used
        
    except Exception as e:
        logger.error(f"Error consuming credits: {e}")
        await session.rollback()
        return 0


async def get_job_stats(session: AsyncSession, job_id: str) -> Dict[str, Any]:
    """Get statistics for a specific job."""
    try:
        stats_query = text("""
            SELECT 
                j.status,
                j.total,
                j.completed,
                j.created_at,
                j.updated_at,
                COUNT(c.id) as contacts_count,
                COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
                COUNT(CASE WHEN c.phone IS NOT NULL THEN 1 END) as phones_found,
                COUNT(CASE WHEN c.email_verified = true THEN 1 END) as emails_verified,
                COUNT(CASE WHEN c.phone_verified = true THEN 1 END) as phones_verified,
                SUM(COALESCE(c.credits_consumed, 0)) as total_credits_used,
                AVG(c.enrichment_score) as avg_confidence
            FROM import_jobs j
            LEFT JOIN contacts c ON j.id = c.job_id
            WHERE j.id = :job_id
            GROUP BY j.id, j.status, j.total, j.completed, j.created_at, j.updated_at
        """)
        
        result = await session.execute(stats_query, {"job_id": job_id})
        row = result.first()
        
        if not row:
            return {"error": "Job not found"}
        
        return {
            "job_id": job_id,
            "status": row[0],
            "total": row[1],
            "completed": row[2],
            "created_at": row[3],
            "updated_at": row[4],
            "contacts_count": row[5],
            "emails_found": row[6],
            "phones_found": row[7],
            "emails_verified": row[8],
            "phones_verified": row[9],
            "total_credits_used": float(row[10]) if row[10] else 0,
            "avg_confidence": float(row[11]) if row[11] else 0,
            "email_success_rate": (row[6] / row[5] * 100) if row[5] > 0 else 0,
            "phone_success_rate": (row[7] / row[5] * 100) if row[5] > 0 else 0,
            "progress_percentage": (row[2] / row[1] * 100) if row[1] > 0 else 0
        }
        
    except Exception as e:
        logger.error(f"Error getting job stats for {job_id}: {e}")
        return {"error": str(e)}


async def get_enrichment_provider_stats(session: AsyncSession) -> Dict[str, Any]:
    """Get statistics about enrichment provider performance."""
    try:
        provider_stats_query = text("""
            SELECT 
                enrichment_provider,
                COUNT(*) as total_attempts,
                COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as email_successes,
                COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as phone_successes,
                AVG(enrichment_score) as avg_confidence,
                SUM(COALESCE(credits_consumed, 0)) as total_credits
            FROM contacts 
            WHERE enrichment_provider IS NOT NULL
            GROUP BY enrichment_provider
            ORDER BY total_attempts DESC
        """)
        
        result = await session.execute(provider_stats_query)
        rows = result.fetchall()
        
        provider_stats = {}
        for row in rows:
            provider = row[0]
            provider_stats[provider] = {
                "total_attempts": row[1],
                "email_successes": row[2],
                "phone_successes": row[3],
                "avg_confidence": float(row[4]) if row[4] else 0,
                "total_credits": float(row[5]) if row[5] else 0,
                "email_success_rate": (row[2] / row[1] * 100) if row[1] > 0 else 0,
                "phone_success_rate": (row[3] / row[1] * 100) if row[1] > 0 else 0
            }
        
        return provider_stats
        
    except Exception as e:
        logger.error(f"Error getting provider stats: {e}")
        return {"error": str(e)}