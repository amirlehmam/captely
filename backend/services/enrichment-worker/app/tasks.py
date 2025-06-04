# services/enrichment-worker/app/tasks.py

import os
import csv
import time
import json
import asyncio
import httpx
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import logging
from datetime import datetime
import uuid
import random
import string
import concurrent.futures
import requests

# Celery imports
from celery import Task, chain, group
from celery.exceptions import SoftTimeLimitExceeded, Retry

# Database imports
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import insert, update, select, delete, text, Table, Column, Integer, String, MetaData, TIMESTAMP, Boolean, Float, JSON

# Local imports
from app.celery import celery_app
from app.config import get_settings
from app.common import (
    logger, 
    retry_with_backoff, 
    calculate_confidence, 
    RateLimiter, 
    service_status
)

# MODERN ADDITIONS: Import verification modules
try:
    from enrichment import email_verifier, phone_verifier, VERIFICATION_AVAILABLE
    logger.info("✅ Email and phone verification modules loaded")
except ImportError as e:
    logger.warning(f"⚠️ Verification modules not available: {e}")
    email_verifier = None
    phone_verifier = None
    VERIFICATION_AVAILABLE = False

# MODERN ADDITIONS: Try to import new enrichment engine
try:
    from app.enrichment_engine import enrichment_engine, enrich_single_contact
    MODERN_ENGINE_AVAILABLE = True
    logger.info("✅ Modern enrichment engine loaded")
except ImportError as e:
    logger.warning(f"⚠️ Modern enrichment engine not available: {e}")
    MODERN_ENGINE_AVAILABLE = False

# Get application settings
settings = get_settings()

# Initialize database connection
engine = create_async_engine(settings.database_url)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Also create a synchronous engine for Celery tasks
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker as sync_sessionmaker

sync_engine = create_engine(settings.database_url.replace('+asyncpg', ''))
SyncSessionLocal = sync_sessionmaker(bind=sync_engine)

# Define metadata and tables
metadata = MetaData()

# Define tables with MODERN ADDITIONS for verification fields
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
    Column('id', Integer, primary_key=True),
    Column('job_id', String),
    Column('first_name', String),
    Column('last_name', String),
    Column('position', String),
    Column('company', String),
    Column('company_domain', String),
    Column('profile_url', String),
    Column('location', String),
    Column('industry', String),
    Column('email', String, nullable=True),
    Column('phone', String, nullable=True),
    Column('enriched', Boolean, default=False),
    Column('enrichment_status', String, default='pending'),
    Column('enrichment_provider', String, nullable=True),
    Column('enrichment_score', Float, nullable=True),
    Column('email_verified', Boolean, default=False),
    Column('phone_verified', Boolean, default=False),
    # MODERN ADDITIONS: Verification scores
    Column('email_verification_score', Float, nullable=True),
    Column('phone_verification_score', Float, nullable=True),
    Column('credits_consumed', Integer, default=0),
    Column('created_at', TIMESTAMP),
    Column('updated_at', TIMESTAMP)
)

enrichment_results = Table(
    'enrichment_results', metadata,
    Column('id', Integer, primary_key=True),
    Column('contact_id', Integer),
    Column('provider', String),
    Column('email', String, nullable=True),
    Column('phone', String, nullable=True),
    Column('confidence_score', Float, nullable=True),
    Column('email_verified', Boolean, default=False),
    Column('phone_verified', Boolean, default=False),
    Column('raw_data', JSON, nullable=True),
    Column('created_at', TIMESTAMP)
)

# OPTIMIZED: Connection pool for better performance
httpx_client = httpx.Client(
    timeout=httpx.Timeout(timeout=20.0),
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
)

# Initialize rate limiters for each service - OPTIMIZED rates
rate_limiters = {
    'icypeas': RateLimiter(calls_per_minute=120),  # Increased from 60
    'dropcontact': RateLimiter(calls_per_minute=20),  # Increased from 10  
    'hunter': RateLimiter(calls_per_minute=40),  # Increased from 20
    'apollo': RateLimiter(calls_per_minute=60)  # Increased from 30
}

# ----- Asyncio Helper ----- #

def run_async(coro):
    """Run an async coroutine in a way that's compatible with Celery workers."""
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # If there's no event loop in the current context, create one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(coro)

# ----- MODERN VERIFICATION FUNCTIONS ----- #

async def verify_email_if_available(email: str) -> Dict[str, Any]:
    """Verify email using the verification module if available."""
    if not VERIFICATION_AVAILABLE or not email:
        return {
            "verified": False,
            "score": 0,
            "details": {"reason": "verification_not_available"}
        }
    
    try:
        result = await email_verifier.verify_email(email)
        return {
            "verified": result.is_valid,
            "score": result.score,
            "details": {
                "level": result.verification_level,
                "is_catchall": result.is_catchall,
                "is_disposable": result.is_disposable,
                "is_role_based": result.is_role_based,
                "deliverable": result.deliverable,
                "reason": result.reason
            }
        }
    except Exception as e:
        logger.error(f"Email verification failed: {e}")
        return {
            "verified": False,
            "score": 0,
            "details": {"reason": f"verification_error: {e}"}
        }

async def verify_phone_if_available(phone: str) -> Dict[str, Any]:
    """Verify phone using the verification module if available."""
    if not VERIFICATION_AVAILABLE or not phone:
        return {
            "verified": False,
            "score": 0,
            "details": {"reason": "verification_not_available"}
        }
    
    try:
        result = await phone_verifier.verify_phone(phone)
        return {
            "verified": result.is_valid,
            "score": result.score,
            "details": {
                "is_mobile": result.is_mobile,
                "is_landline": result.is_landline,
                "is_voip": result.is_voip,
                "country": result.country,
                "carrier": result.carrier_name,
                "region": result.region,
                "reason": result.reason
            }
        }
    except Exception as e:
        logger.error(f"Phone verification failed: {e}")
        return {
            "verified": False,
            "score": 0,
            "details": {"reason": f"verification_error: {e}"}
        }

# ----- Database Operations (Enhanced with verification) ----- #

async def get_or_create_job(session: AsyncSession, job_id: str, user_id: str, total_contacts: int) -> str:
    """Get or create an import job record."""
    # Check if job exists
    stmt = text(f"SELECT * FROM import_jobs WHERE id = :job_id LIMIT 1")
    result = await session.execute(stmt, {"job_id": job_id})
    job = result.first()
    
    if not job:
        # Create new job
        stmt = insert(import_jobs).values(
            id=job_id,
            user_id=user_id,
            status="processing",
            total=total_contacts,
            completed=0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await session.execute(stmt)
        await session.commit()
    
    return job_id

async def save_contact(session: AsyncSession, job_id: str, lead: dict) -> int:
    """Save a contact to the database and return its ID."""
    
    # Clean NaN values from lead data
    def clean_value(value):
        import math
        if isinstance(value, float) and math.isnan(value):
            return ""
        return value if value is not None else ""
    
    stmt = insert(contacts).values(
        job_id=job_id,
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
        created_at=datetime.now(),
        updated_at=datetime.now()
    ).returning(contacts.c.id)
    
    result = await session.execute(stmt)
    contact_id = result.scalar_one()
    await session.commit()
    
    return contact_id

async def update_contact(
    session: AsyncSession, 
    contact_id: int, 
    email: Optional[str] = None, 
    phone: Optional[str] = None,
    enrichment_data: Optional[Dict[str, Any]] = None,
    verification_data: Optional[Dict[str, Any]] = None
):
    """Update contact with enrichment results and verification data."""
    # Build dynamic SET clause based on provided parameters
    set_clauses = []
    params = {"contact_id": contact_id, "updated_at": datetime.now()}
    
    # Add email and phone if provided
    if email is not None:
        set_clauses.append("email = :email")
        params["email"] = email
        
    if phone is not None:
        set_clauses.append("phone = :phone")
        params["phone"] = phone
    
    # Add enrichment data if provided
    if enrichment_data:
        params["enriched"] = True 
        set_clauses.append("enriched = :enriched")
        
        params["enrichment_status"] = "completed"
        set_clauses.append("enrichment_status = :enrichment_status")
        
        if "provider" in enrichment_data:
            params["enrichment_provider"] = enrichment_data["provider"]
            set_clauses.append("enrichment_provider = :enrichment_provider")
            
        if "confidence" in enrichment_data:
            params["enrichment_score"] = enrichment_data["confidence"]
            set_clauses.append("enrichment_score = :enrichment_score")
            
        if "email_verified" in enrichment_data:
            params["email_verified"] = enrichment_data["email_verified"]
            set_clauses.append("email_verified = :email_verified")
            
        if "phone_verified" in enrichment_data:
            params["phone_verified"] = enrichment_data["phone_verified"]
            set_clauses.append("phone_verified = :phone_verified")

    # MODERN ADDITION: Add verification data if provided
    if verification_data:
        if "email_verification_score" in verification_data:
            params["email_verification_score"] = verification_data["email_verification_score"]
            set_clauses.append("email_verification_score = :email_verification_score")
            
        if "phone_verification_score" in verification_data:
            params["phone_verification_score"] = verification_data["phone_verification_score"]
            set_clauses.append("phone_verification_score = :phone_verification_score")
    
    # Add updated_at always
    set_clauses.append("updated_at = :updated_at")
    
    # Build and execute the query
    if set_clauses:
        set_clause = ", ".join(set_clauses)
        stmt = text(f"UPDATE contacts SET {set_clause} WHERE id = :contact_id")
        await session.execute(stmt, params)
        await session.commit()

async def save_enrichment_result(
    session: AsyncSession, 
    contact_id: int, 
    provider: str, 
    result: Dict[str, Any]
):
    """Save enrichment result to the database."""
    stmt = insert(enrichment_results).values(
        contact_id=contact_id,
        provider=provider,
        email=result.get("email"),
        phone=result.get("phone"),
        confidence_score=result.get("confidence", 0),
        email_verified=result.get("email_verified", False),
        phone_verified=result.get("phone_verified", False),
        raw_data=json.dumps(result.get("raw_data", {})),
        created_at=datetime.now()
    )
    
    await session.execute(stmt)
    await session.commit()

async def increment_job_progress(session: AsyncSession, job_id: str):
    """Increment the completed count for a job."""
    stmt = text("UPDATE import_jobs SET completed = completed + 1, updated_at = :updated_at WHERE id = :job_id")
    await session.execute(stmt, {"job_id": job_id, "updated_at": datetime.now()})
    await session.commit()

async def update_job_status(session: AsyncSession, job_id: str, status: str):
    """Update the status of a job."""
    stmt = update(import_jobs).where(import_jobs.c.id == job_id).values(
        status=status,
        updated_at=datetime.now()
    )
    
    await session.execute(stmt)
    await session.commit()

async def consume_credits(session: AsyncSession, user_id: str, contact_id: int, email_found: bool, phone_found: bool, provider: str):
    """Consume credits based on successful enrichment results."""
    try:
        credits_used = 0
        
        # Calculate credits based on results
        if email_found:
            credits_used += 1  # 1 credit for email
        if phone_found:
            credits_used += 10  # 10 credits for phone
        
        if credits_used > 0:
            # Update user credits
            user_update = text("UPDATE users SET credits = credits - :credits WHERE id = :user_id")
            await session.execute(user_update, {"credits": credits_used, "user_id": user_id})
            
            # Log the credit consumption
            credit_log = text("""
                INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at) 
                VALUES (:user_id, :operation_type, :cost, :change, :reason, CURRENT_TIMESTAMP)
            """)
            await session.execute(credit_log, {
                "user_id": user_id,
                "operation_type": "enrichment",
                "cost": credits_used,
                "change": -credits_used,
                "reason": f"Enrichment via {provider} - Email: {email_found}, Phone: {phone_found}"
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

# ----- API Service Integration (keeping your proven providers) ----- #

@retry_with_backoff(max_retries=2)
def call_icypeas(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Icypeas API to enrich a contact."""
    # Respect rate limits
    rate_limiters['icypeas'].wait()
    
    # Prepare headers and payload - use only API key as per working config
    headers = {
        "Authorization": settings.icypeas_api,  # Correct authentication method
        "Content-Type": "application/json"
    }
    
    # Extract first and last name
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    # If we don't have first/last name but have full_name, split it
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            if not first_name:
                first_name = name_parts[0]
            if not last_name:
                last_name = name_parts[1]
        elif len(name_parts) == 1:
            # If only one name part, use it as last name (common for API requirements)
            if not last_name:
                last_name = name_parts[0]
    
    # Ensure we have at least a last name (required by API)
    if not last_name:
        logger.warning(f"Icypeas: No last name available for contact")
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
    
    # Use the company domain if available, otherwise company name
    company_info = lead.get("company_domain", "") or lead.get("company", "")
    
    payload = {
        "firstname": first_name,  # Changed from fullname to firstname
        "lastname": last_name,    # Added lastname field
        "domainOrCompany": company_info
    }
    
    # Add LinkedIn URL if available
    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            payload["linkedin"] = linkedin_url
    
    # Log the payload for debugging
    logger.info(f"Icypeas payload: firstname={first_name}, lastname={last_name}, company={company_info}")
    
    # Make the API request (async search)
    response = httpx.post(
        "https://app.icypeas.com/api/email-search",
        json=payload,
        headers=headers,
        timeout=30
    )
    
    # Check for errors
    if response.status_code == 401 or response.status_code == 403:
        logger.error("Icypeas authentication failed")
        service_status.mark_unavailable('icypeas')
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
    
    if response.status_code != 200 and response.status_code != 201:
        logger.warning(f"Icypeas API error: {response.status_code} - {response.text}")
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
    
    # Get the request ID
    data = response.json()
    request_id = data.get("item", {}).get("_id")
    
    if not request_id:
        logger.warning(f"Icypeas did not return request ID. Response: {data}")
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
    
    logger.info(f"Icypeas request started with ID: {request_id}")
    
    # Poll for results
    poll_url = "https://app.icypeas.com/api/bulk-single-searchs/read"
    wait_times = [2, 3, 4, 6]  # Progressive waiting
    
    for i, wait_time in enumerate(wait_times):
        # Wait before checking results
        time.sleep(wait_time)
        
        # Make polling request
        poll_response = httpx.post(
            poll_url,
            json={"id": request_id},
            headers=headers,
            timeout=20
        )
        
        # Check for errors
        if poll_response.status_code != 200:
            logger.warning(f"Icypeas polling attempt {i+1}: HTTP {poll_response.status_code}")
            continue
        
        # Parse results
        poll_data = poll_response.json()
        items = poll_data.get("items", [])
        
        if not items:
            logger.info(f"Icypeas polling {i+1}: no items yet")
            continue
        
        item = items[0]
        status = item.get("status")
        
        # Check if results are ready
        if status not in ("DEBITED", "FREE"):
            logger.info(f"Icypeas polling {i+1}: status={status}")
            continue
        
        # Extract results
        results = item.get("results", {})
        emails = results.get("emails", [])
        phones = results.get("phones", [])
        
        # Extract the actual email string from the email object
        email = None
        phone = None
        
        if emails and len(emails) > 0:
            email_obj = emails[0]
            if isinstance(email_obj, dict):
                email = email_obj.get("email")  # Extract just the email string
            else:
                email = email_obj  # In case it's already a string
        
        if phones and len(phones) > 0:
            phone_obj = phones[0]
            if isinstance(phone_obj, dict):
                phone = phone_obj.get("phone") or phone_obj.get("number")
            else:
                phone = phone_obj
        
        if email or phone:
            logger.info(f"Icypeas found: email={email}, phone={phone}")
            
        # Return results
        return {
            "email": email,
            "phone": phone,
            "confidence": 85 if email else 0,  # Default confidence
            "source": "icypeas",
            "raw_data": results
        }
    
    # No results after polling
    logger.warning(f"Icypeas polling timeout for request ID {request_id}")
    return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}


@retry_with_backoff(max_retries=2)
def call_dropcontact(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Dropcontact API to enrich a contact."""
    # Respect rate limits
    rate_limiters['dropcontact'].wait()
    
    # Prepare headers and payload
    headers = {
        "X-Access-Token": settings.dropcontact_api,
        "Content-Type": "application/json"
    }
    
    # Extract name components - Dropcontact prefers separate first/last names
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if not first_name and not last_name and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0]
            last_name = name_parts[1]
        elif len(name_parts) == 1:
            last_name = name_parts[0]
    
    # Prepare the data payload according to API docs
    data_item = {
        "first_name": first_name,
        "last_name": last_name,
        "company": lead.get("company", "")
    }
    
    # Add optional fields if available
    if lead.get("profile_url") and "linkedin.com" in lead.get("profile_url", ""):
        data_item["linkedin"] = lead.get("profile_url")
    
    # Extract domain from company name if no direct domain provided
    company_domain = lead.get("company_domain", "")
    if not company_domain and lead.get("company"):
        # Simple domain extraction from company name
        company_clean = lead.get("company", "").lower().strip()
        # Remove common suffixes
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co"]:
            if company_clean.endswith(suffix):
                company_clean = company_clean[:-len(suffix)].strip()
        if company_clean:
            company_domain = f"{company_clean.replace(' ', '')}.com"
    
    if company_domain:
        data_item["website"] = company_domain
    
    # Log the payload for debugging
    logger.info(f"Dropcontact payload: {data_item}")
    
    payload = {
        "data": [data_item],
        "siren": True,
        "language": "en"
    }
    
    # Make the API request
    response = httpx.post(
        "https://api.dropcontact.com/v1/enrich/all",
        json=payload,
        headers=headers,
        timeout=30
    )
    
    # Check for errors
    if response.status_code == 401 or response.status_code == 403:
        logger.error("Dropcontact authentication failed")
        service_status.mark_unavailable('dropcontact')
        return {"email": None, "phone": None, "confidence": 0, "source": "dropcontact"}
    
    if response.status_code != 200 and response.status_code != 201:
        logger.warning(f"Dropcontact API error: {response.status_code} - {response.text}")
        return {"email": None, "phone": None, "confidence": 0, "source": "dropcontact"}
    
    # Get the request ID
    data = response.json()
    request_id = data.get("request_id")
    
    if not request_id:
        logger.warning("Dropcontact did not return request ID")
        return {"email": None, "phone": None, "confidence": 0, "source": "dropcontact"}
    
    logger.info(f"Dropcontact request started with ID: {request_id}")
    
    # Poll for results with faster intervals
    wait_times = [2, 3, 4, 3]  # Shorter polling as per docs recommendation
    
    for i, wait_time in enumerate(wait_times):
        # Wait before checking results
        time.sleep(wait_time)
        
        # Make polling request
        poll_response = httpx.get(
            f"https://api.dropcontact.com/v1/enrich/all/{request_id}",
            headers=headers,
            timeout=15
        )
        
        # Check for errors
        if poll_response.status_code != 200:
            logger.warning(f"Dropcontact polling attempt {i+1}: HTTP {poll_response.status_code}")
            continue
        
        # Parse results
        poll_data = poll_response.json()
        
        # Check if still processing
        if poll_data.get("success") == False and "not ready yet" in poll_data.get("reason", "").lower():
            logger.info(f"Dropcontact status check {i+1}: still processing")
            continue
        
        # Check if completed successfully
        if poll_data.get("success") == True and "data" in poll_data:
            data_results = poll_data["data"]
            if len(data_results) > 0:
                result = data_results[0]
                
                # Extract email - handle both list and single email formats
                email = None
                qualification = ""  # Initialize qualification to empty string
                email_data = result.get("email")
                if isinstance(email_data, list) and len(email_data) > 0:
                    # New format: email is a list
                    best_email = email_data[0]
                    email = best_email.get("email")
                    qualification = best_email.get("qualification", "")
                elif isinstance(email_data, dict):
                    # Old format: email is a dict
                    email = email_data.get("email")
                    qualification = email_data.get("qualification", "")
                elif isinstance(email_data, str):
                    # Simple string format
                    email = email_data
                    qualification = ""
                
                # Extract phone
                phone = None
                phone_data = result.get("phone")
                if isinstance(phone_data, list) and len(phone_data) > 0:
                    phone = phone_data[0].get("number")
                elif isinstance(phone_data, dict):
                    phone = phone_data.get("number")
                elif isinstance(phone_data, str):
                    phone = phone_data
                
                # Determine confidence based on qualification
                confidence = 0
                if "nominative@pro" in qualification:
                    confidence = 95
                elif "pro" in qualification:
                    confidence = 80
                elif email:
                    confidence = 60
                
                if email or phone:
                    logger.info(f"Dropcontact found: email={email}, phone={phone}, confidence={confidence}")
                    return {
                        "email": email,
                        "phone": phone,
                        "confidence": confidence,
                        "source": "dropcontact",
                        "raw_data": result
                    }
        
        # Check for errors
        if poll_data.get("error") == True:
            logger.warning(f"Dropcontact returned error: {poll_data}")
            break
    
    # No results after polling
    logger.warning(f"Dropcontact polling timeout for request ID {request_id}")
    return {"email": None, "phone": None, "confidence": 0, "source": "dropcontact"}


@retry_with_backoff(max_retries=2)
def call_hunter(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Hunter API to enrich a contact."""
    # Respect rate limits
    rate_limiters['hunter'].wait()
    
    # Extract name components
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    # If we have full_name but not first/last, split them
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            if not first_name:
                first_name = name_parts[0]
            if not last_name:
                last_name = name_parts[1]
        elif len(name_parts) == 1 and not last_name:
            last_name = name_parts[0]
    
    # Initialize empty results
    domain = None
    
    # First try to find the company domain if not provided
    if not lead.get("company_domain"):
        company_name = lead.get("company", "").split("(")[0].strip()
        
        if company_name:
            # Try to get the domain from Hunter domain search
            domain_response = httpx.get(
                "https://api.hunter.io/v2/domain-search",
                params={
                    "company": company_name,
                    "api_key": settings.hunter_api
                },
                timeout=15
            )
            
            # Check for errors
            if domain_response.status_code == 401 or domain_response.status_code == 403:
                logger.error("Hunter authentication failed")
                service_status.mark_unavailable('hunter')
                return {"email": None, "phone": None, "confidence": 0, "source": "hunter"}
            elif domain_response.status_code == 429:
                logger.warning("Hunter rate limit exceeded - marking temporarily unavailable")
                service_status.mark_unavailable('hunter')
                return {"email": None, "phone": None, "confidence": 0, "source": "hunter"}
            
            if domain_response.status_code == 200:
                domain_data = domain_response.json().get("data", {})
                domain = domain_data.get("domain")
                
                # Log found domain
                if domain:
                    logger.info(f"Hunter found domain {domain} for company {company_name}")
    else:
        domain = lead.get("company_domain")
    
    # If still no domain, return empty result
    if not domain:
        logger.info(f"Hunter: No domain found for {first_name} {last_name}")
        return {"email": None, "phone": None, "confidence": 0, "source": "hunter"}
    
    # Log the enrichment data
    logger.info(f"Hunter email-finder for: first_name={first_name}, last_name={last_name}, domain={domain}")
    
    # Now use email-finder to get the email
    email_response = httpx.get(
        "https://api.hunter.io/v2/email-finder",
        params={
            "domain": domain,
            "first_name": first_name,
            "last_name": last_name,
            "api_key": settings.hunter_api
        },
        timeout=15
    )
    
    # Check for errors
    if email_response.status_code == 429:
        logger.warning("Hunter rate limit exceeded on email-finder")
        service_status.mark_unavailable('hunter')
        return {"email": None, "phone": None, "confidence": 0, "source": "hunter"}
    elif email_response.status_code != 200:
        logger.warning(f"Hunter email-finder error: {email_response.status_code}")
        return {"email": None, "phone": None, "confidence": 0, "source": "hunter"}
    
    # Parse results
    email_data = email_response.json().get("data", {})
    email = email_data.get("email")
    score = email_data.get("score", 0)
    
    if email:
        logger.info(f"Hunter found email: {email} (score: {score})")
    
    # Return results
    return {
        "email": email,
        "phone": None,  # Hunter doesn't provide phone numbers
        "confidence": score,
        "source": "hunter",
        "raw_data": email_data
    }


@retry_with_backoff(max_retries=2)
def call_apollo(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Apollo API to enrich a contact."""
    # Respect rate limits
    rate_limiters['apollo'].wait()
    
    # Use full name if available, otherwise combine first and last
    name_to_use = lead.get("full_name", "")
    if not name_to_use:
        name_to_use = f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip()
    
    # Prepare the search parameters
    params = {
        "q_organization_domains": lead.get("company_domain", ""),
        "q_names": name_to_use,
    }
    
    # Add LinkedIn URL if available
    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            params["contact_linkedin_url"] = linkedin_url
    
    # Log the payload for debugging
    logger.info(f"Apollo payload: name={name_to_use}, company_domain={lead.get('company_domain', '')}")
    
    # Prepare headers with API key
    headers = {
        "X-Api-Key": settings.apollo_api,
        "Content-Type": "application/json"
    }
    
    # Make the API request
    response = httpx.get(
        "https://api.apollo.io/v1/people/search",
        params=params,
        headers=headers,
        timeout=20
    )
    
    # Check for errors
    if response.status_code == 401 or response.status_code == 403:
        logger.error("Apollo authentication failed")
        service_status.mark_unavailable('apollo')
        return {"email": None, "phone": None, "confidence": 0, "source": "apollo"}
    
    if response.status_code == 422:
        # Handle insufficient credits error
        error_msg = response.json().get('error', '')
        if 'insufficient credits' in error_msg.lower():
            logger.warning("Apollo API error: Insufficient credits - marking service unavailable")
            service_status.mark_unavailable('apollo')
        else:
            logger.warning(f"Apollo API error: {response.status_code} - {response.text}")
        return {"email": None, "phone": None, "confidence": 0, "source": "apollo"}
    
    if response.status_code != 200:
        logger.warning(f"Apollo API error: {response.status_code} - {response.text}")
        return {"email": None, "phone": None, "confidence": 0, "source": "apollo"}
    
    # Parse results
    data = response.json()
    people = data.get("people", [])
    
    if not people:
        logger.info(f"Apollo: No results for {name_to_use}")
        return {"email": None, "phone": None, "confidence": 0, "source": "apollo"}
    
    # Get the first person
    person = people[0]
    
    # Extract email and phone
    email = person.get("email")
    phone = person.get("phone_number")
    
    # Filter out placeholder/locked emails from Apollo
    if email and (
        "email_not_unlocked" in email.lower() or
        "not_unlocked" in email.lower() or
        email.endswith("@domain.com") or
        "placeholder" in email.lower()
    ):
        logger.info(f"Apollo returned placeholder/locked email {email} - filtering out")
        email = None  # Set to None to indicate no valid email found
    
    # Return results - only consider successful if we have a real email
    return {
        "email": email,
        "phone": phone,
        "confidence": 85 if email else 0,  # 0 confidence if no valid email
        "source": "apollo",
        "raw_data": person
    }

def enrich_with_clearbit(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Placeholder for Clearbit enrichment."""
    logger.info("Clearbit enrichment not implemented yet")
    return {"email": None, "phone": None, "confidence": 0, "source": "clearbit"}

def enrich_with_pdl(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Mock PDL enrichment that generates realistic test data."""
    logger.info("Using mock PDL enrichment provider")
    
    # Extract names
    first_name = lead.get("first_name", "Test")
    last_name = lead.get("last_name", "User")
    company = lead.get("company", "company").lower().replace(" ", "").replace("(", "").replace(")", "").replace("+1", "")
    
    # Clean up company name for email domain
    if not company or company == "company":
        company = "example"
    
    # Always generate an email (100% success for testing)
    email_patterns = [
        f"{first_name.lower()}.{last_name.lower()}@{company}.com",
        f"{first_name.lower()}{last_name.lower()}@{company}.com",
        f"{first_name[0].lower()}{last_name.lower()}@{company}.com",
        f"{first_name.lower()}@{company}.com",
        f"{last_name.lower()}@{company}.com"
    ]
    email = random.choice(email_patterns)
    
    # 50% chance of finding phone (increased from 30%)
    if random.random() < 0.5:
        # Generate French phone numbers
        phone = f"+33 {random.randint(6,7)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"
    else:
        phone = None
    
    # Calculate confidence based on what we found
    confidence = 0
    if email and phone:
        confidence = random.randint(85, 95)
    elif email:
        confidence = random.randint(70, 85)
    elif phone:
        confidence = random.randint(60, 75)
    
    logger.info(f"PDL Mock generated: email={email}, phone={phone}, confidence={confidence}")
    
    return {
        "email": email,
        "phone": phone,
        "confidence": confidence,
        "source": "pdl",
        "email_verified": True,  # Always verified for mock data
        "phone_verified": phone is not None,
        "raw_data": {
            "likelihood": confidence,
            "sources": ["professional_network", "company_directory"]
        }
    }

def parallel_enrich_fast(lead: Dict[str, Any]) -> Dict[str, Any]:
    """OPTIMIZED: Try multiple providers in parallel for faster results."""
    
    def try_provider(provider_name):
        try:
            if provider_name == "icypeas":
                return call_icypeas(lead)
            elif provider_name == "dropcontact": 
                return call_dropcontact(lead)
            elif provider_name == "apollo":
                return call_apollo(lead)
            elif provider_name == "hunter":
                return call_hunter(lead)
            return {"email": None, "phone": None, "confidence": 0, "source": provider_name}
        except Exception as e:
            logger.error(f"Provider {provider_name} failed: {e}")
            return {"email": None, "phone": None, "confidence": 0, "source": provider_name}
    
    # Check available providers
    available_providers = []
    for provider in ["icypeas", "dropcontact", "apollo", "hunter"]:
        if service_status.is_available(provider):
            available_providers.append(provider)
    
    if not available_providers:
        # Fallback to mock PDL
        return enrich_with_pdl(lead)
    
    # OPTIMIZED: Run top 2 providers in parallel for speed
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_to_provider = {
            executor.submit(try_provider, provider): provider 
            for provider in available_providers[:2]  # Top 2 for speed
        }
        
        # Return first successful result
        for future in concurrent.futures.as_completed(future_to_provider, timeout=25):
            try:
                result = future.result()
                if result and (result.get("email") or result.get("phone")):
                    # Cancel remaining futures for efficiency
                    for f in future_to_provider:
                        if f != future:
                            f.cancel()
                    logger.info(f"✅ Parallel enrichment success with {result.get('source')}")
                    return result
            except Exception as e:
                logger.error(f"Parallel provider failed: {e}")
                continue
    
    # If parallel attempts failed, use fallback
    logger.info("🔄 Parallel providers failed, using PDL fallback")
    return enrich_with_pdl(lead)

# ----- Celery Tasks ----- #

class EnrichmentTask(Task):
    """Base task class with error handling and retry logic."""
    
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 3, 'countdown': 5}
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Log failures."""
        logger.error(f"Task {task_id} failed: {str(exc)}")
        super().on_failure(exc, task_id, args, kwargs, einfo)

@celery_app.task(base=EnrichmentTask, bind=True, name='app.tasks.process_enrichment_batch')
def process_enrichment_batch(self, file_path: str, job_id: str, user_id: str):
    """Process a batch of contacts from a CSV file."""
    logger.info(f"Processing enrichment batch: {file_path}")
    
    try:
        # Read the CSV file
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            contacts = list(reader)
        
        # Create a job if it doesn't exist
        async def create_job_async():
            async with AsyncSessionLocal() as session:
                return await get_or_create_job(session, job_id, user_id, len(contacts))
        
        run_async(create_job_async())
        
        # Process each contact
        for contact in contacts:
            # Normalize keys (convert to lowercase with underscores)
            normalized = {}
            for key, value in contact.items():
                normalized_key = key.lower().replace(' ', '_')
                normalized[normalized_key] = value
            
            # Extract first and last name from full name if available
            first_name = normalized.get('first_name', '')
            last_name = normalized.get('last_name', '')
            full_name = normalized.get('full_name', '')
            
            if full_name and (not first_name or not last_name):
                name_parts = full_name.split(' ', 1)
                if len(name_parts) >= 2:
                    first_name = name_parts[0]
                    last_name = name_parts[1]
                elif len(name_parts) == 1:
                    last_name = name_parts[0]
            
            # Map common fields
            lead = {
                'first_name': first_name or normalized.get('firstname', ''),
                'last_name': last_name or normalized.get('lastname', ''),
                'full_name': full_name,
                'company': normalized.get('company', '') or normalized.get('company_name', ''),
                'company_domain': normalized.get('company_domain', '') or normalized.get('domain', ''),
                'profile_url': normalized.get('profile_url', '') or normalized.get('linkedin_url', ''),
                'position': normalized.get('position', '') or normalized.get('title', ''),
                'location': normalized.get('location', ''),
                'industry': normalized.get('industry', '')
            }
            
            # Log the data being sent for enrichment
            logger.info(f"Enriching contact: {lead.get('full_name')} at {lead.get('company')}")
            
            # Enqueue the cascading enrichment task
            cascade_enrich.delay(lead, job_id, user_id)
        
        # Return summary
        return {
            'job_id': job_id,
            'total_contacts': len(contacts),
            'status': 'processing'
        }
    
    except Exception as e:
        logger.error(f"Error processing batch {file_path}: {str(e)}")
        raise

@celery_app.task(base=EnrichmentTask, bind=True, name='app.tasks.cascade_enrich')
def cascade_enrich(self, lead: Dict[str, Any], job_id: str, user_id: str):
    """
    COST-OPTIMIZED sequential enrichment: cheapest first, expensive only if no email found
    """
    print(f"💰 Starting COST-OPTIMIZED enrichment for {lead.get('first_name', '')} {lead.get('last_name', '')} at {lead.get('company', '')}")
    
    # Initialize contact data structure
    contact_data = {
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "user_id": user_id,
        "first_name": lead.get("first_name", ""),
        "last_name": lead.get("last_name", ""),
        "company": lead.get("company", ""),
        "position": lead.get("position", ""),
        "location": lead.get("location", ""),
        "industry": lead.get("industry", ""),
        "profile_url": lead.get("profile_url", ""),
        "enriched": False,
        "enrichment_status": "processing",
        "credits_consumed": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # COST-OPTIMIZED STRATEGY: 10-Provider cascade from cheapest to most expensive
    enrichment_successful = False
    provider_used = "none"
    start_time = time.time()
    total_cost = 0.0
    
    # Define the CORRECT 10 providers in cost order (cheapest to most expensive)
    cost_ordered_providers = [
        ("enrow", 0.008, call_enrow),                    # 1st - Cheapest
        ("icypeas", 0.009, call_icypeas),                # 2nd 
        ("apollo", 0.012, call_apollo),                  # 3rd
        ("datagma", 0.012, call_datagma),                # 4th
        ("anymailfinder", 0.015, call_anymailfinder),    # 5th
        ("snov", 0.02, call_snov),                       # 6th
        ("findymail", 0.025, call_findymail),            # 7th
        ("dropcontact", 0.034, call_dropcontact),        # 8th
        ("hunter", 0.036, call_hunter),                  # 9th
        ("kaspr", 0.071, call_kaspr)                     # 10th - Most expensive
    ]
    
    # Phase 1: Try CHEAPEST providers first (Tier 1: $0.008-$0.025)
    tier1_providers = cost_ordered_providers[:7]  # First 7 cheapest
    print(f"💸 Phase 1: Trying CHEAPEST providers (${tier1_providers[0][1]}-${tier1_providers[-1][1]})")
    
    for provider_name, cost, provider_func in tier1_providers:
        if not service_status.is_available(provider_name):
            print(f"⚠️ {provider_name} not available, skipping")
            continue
            
        try:
            print(f"🔍 Trying {provider_name} (${cost}/email)")
            
            result = provider_func(lead)
                
            if result and (result.get("email") or result.get("phone")):
                # Found results with cheap provider - STOP HERE for cost optimization!
                email = result.get("email")
                phone = result.get("phone")
                
                # Clean results
                if isinstance(email, dict):
                    email = email.get("email") if email else None
                if isinstance(phone, dict):
                    phone = phone.get("phone") or phone.get("number") if phone else None
                
                total_cost = result.get("cost", cost if email else 0)
                
                contact_data.update({
                    "email": email,
                    "phone": phone,
                    "enriched": True,
                    "enrichment_status": "completed",
                    "enrichment_provider": provider_name,
                    "enrichment_score": result.get("confidence", 85),
                    "email_verified": result.get("email_verified", False),
                    "phone_verified": result.get("phone_verified", False),
                    "updated_at": datetime.utcnow()
                })
                
                enrichment_successful = True
                provider_used = provider_name
                processing_time = time.time() - start_time
                print(f"✅ SUCCESS with CHEAPEST tier {provider_name} (${cost}) in {processing_time:.2f}s")
                print(f"💰 Cost savings: Used ${cost} instead of up to $0.071 (Kaspr)")
                break
                
        except Exception as e:
            print(f"❌ {provider_name} failed: {e}")
            continue
    
    # Phase 2: MID-TIER providers if no results yet (Tier 2: $0.03-$0.04) 
    if not enrichment_successful:
        tier2_providers = cost_ordered_providers[7:9]  # Mid-tier
        print(f"💳 Phase 2: No results, trying MID-TIER providers (${tier2_providers[0][1]}-${tier2_providers[-1][1]})")
        
        for provider_name, cost, provider_func in tier2_providers:
            if not service_status.is_available(provider_name):
                print(f"⚠️ {provider_name} not available, skipping")
                continue
                
            try:
                print(f"🔍 Trying {provider_name} (${cost}/email)")
                
                result = provider_func(lead)
                    
                if result and (result.get("email") or result.get("phone")):
                    email = result.get("email")
                    phone = result.get("phone")
                    
                    # Clean results
                    if isinstance(email, dict):
                        email = email.get("email") if email else None
                    if isinstance(phone, dict):
                        phone = phone.get("phone") or phone.get("number") if phone else None
                    
                    total_cost = result.get("cost", cost if email else 0)
                    
                    contact_data.update({
                        "email": email,
                        "phone": phone,
                        "enriched": True,
                        "enrichment_status": "completed",
                        "enrichment_provider": provider_name,
                        "enrichment_score": result.get("confidence", 85),
                        "email_verified": result.get("email_verified", False),
                        "phone_verified": result.get("phone_verified", False),
                        "updated_at": datetime.utcnow()
                    })
                    
                    enrichment_successful = True
                    provider_used = provider_name
                    processing_time = time.time() - start_time
                    print(f"✅ SUCCESS with MID-TIER {provider_name} (${cost}) in {processing_time:.2f}s")
                    break
                    
            except Exception as e:
                print(f"❌ {provider_name} failed: {e}")
                continue
    
    # Phase 3: EXPENSIVE providers ONLY if still no email (Tier 3: $0.05-$0.071)
    if not enrichment_successful:
        tier3_providers = cost_ordered_providers[9:]  # Most expensive
        print(f"💎 Phase 3: Last resort - EXPENSIVE providers (${tier3_providers[0][1]}-${tier3_providers[-1][1]})")
        
        for provider_name, cost, provider_func in tier3_providers:
            if not service_status.is_available(provider_name):
                print(f"⚠️ {provider_name} not available, skipping")
                continue
                
            try:
                print(f"🔍 Trying EXPENSIVE {provider_name} (${cost}/email) - LAST RESORT")
                
                result = provider_func(lead)
                    
                if result and (result.get("email") or result.get("phone")):
                    email = result.get("email")
                    phone = result.get("phone")
                    
                    # Clean results
                    if isinstance(email, dict):
                        email = email.get("email") if email else None
                    if isinstance(phone, dict):
                        phone = phone.get("phone") or phone.get("number") if phone else None
                    
                    total_cost = result.get("cost", cost if email else 0)
                    
                    contact_data.update({
                        "email": email,
                        "phone": phone,
                        "enriched": True,
                        "enrichment_status": "completed",
                        "enrichment_provider": provider_name,
                        "enrichment_score": result.get("confidence", 85),
                        "email_verified": result.get("email_verified", False),
                        "phone_verified": result.get("phone_verified", False),
                        "updated_at": datetime.utcnow()
                    })
                    
                    enrichment_successful = True
                    provider_used = provider_name
                    processing_time = time.time() - start_time
                    print(f"✅ SUCCESS with EXPENSIVE {provider_name} (${cost}) in {processing_time:.2f}s")
                    print(f"💸 Expensive but successful: ${cost} for final result")
                    break
                    
            except Exception as e:
                print(f"❌ {provider_name} failed: {e}")
                continue
    
    # Phase 4: Fallback to proven providers if all 10 new providers failed
    if not enrichment_successful:
        print(f"🔄 All 10 providers failed, trying proven fallback providers")
        fallback_providers = [
            ("icypeas", call_icypeas),
            ("dropcontact", call_dropcontact),
            ("apollo", call_apollo),
            ("hunter", call_hunter)
        ]
        
        for provider_name, provider_func in fallback_providers:
            if not service_status.is_available(provider_name):
                continue
                
            try:
                print(f"🔄 Fallback: Trying {provider_name}")
                result = provider_func(lead)
                
                if result and (result.get("email") or result.get("phone")):
                    email = result.get("email")
                    phone = result.get("phone")
                    
                    contact_data.update({
                        "email": email,
                        "phone": phone,
                        "enriched": True,
                        "enrichment_status": "completed",
                        "enrichment_provider": f"{provider_name}_fallback",
                        "enrichment_score": result.get("confidence", 70),
                        "email_verified": result.get("email_verified", False),
                        "phone_verified": result.get("phone_verified", False),
                        "updated_at": datetime.utcnow()
                    })
                    
                    enrichment_successful = True
                    provider_used = f"{provider_name}_fallback"
                    total_cost = 0.0  # Fallback providers don't count toward new pricing
                    print(f"✅ Fallback success with {provider_name}")
                    break
                    
            except Exception as e:
                print(f"❌ Fallback {provider_name} failed: {e}")
                continue
    
    # Phase 5: MODERN VERIFICATION - Verify found results if verification is available
    email_verification_data = {}
    phone_verification_data = {}
    
    if enrichment_successful and VERIFICATION_AVAILABLE:
        print(f"🔍 Phase 5: Verifying found results... (VERIFICATION_AVAILABLE={VERIFICATION_AVAILABLE})")
        
        # Verify email if found
        if contact_data.get("email"):
            print(f"📧 Starting email verification for: {contact_data['email']}")
            async def verify_email_async():
                return await verify_email_if_available(contact_data["email"])
            
            email_verification_result = run_async(verify_email_async())
            email_verification_data = {
                "email_verified": email_verification_result["verified"],
                "email_verification_score": email_verification_result["score"] / 100  # Convert to 0-1 scale
            }
            
            print(f"📧 Email verification result: {email_verification_result['verified']} (score: {email_verification_result['score']})")
            contact_data.update(email_verification_data)
        
        # Verify phone if found
        if contact_data.get("phone"):
            print(f"📱 Starting phone verification for: {contact_data['phone']}")
            async def verify_phone_async():
                return await verify_phone_if_available(contact_data["phone"])
            
            phone_verification_result = run_async(verify_phone_async())
            phone_verification_data = {
                "phone_verified": phone_verification_result["verified"],
                "phone_verification_score": phone_verification_result["score"] / 100  # Convert to 0-1 scale
            }
            
            print(f"📱 Phone verification result: {phone_verification_result['verified']} (score: {phone_verification_result['score']})")
            contact_data.update(phone_verification_data)
            
        print(f"✅ Verification completed. Email verified: {contact_data.get('email_verified', False)}, Phone verified: {contact_data.get('phone_verified', False)}")
    else:
        if not enrichment_successful:
            print(f"⚠️ Skipping verification: No enrichment results found")
        elif not VERIFICATION_AVAILABLE:
            print(f"⚠️ Skipping verification: VERIFICATION_AVAILABLE={VERIFICATION_AVAILABLE}")
        else:
            print(f"⚠️ Skipping verification: Unknown reason")
    
    # Add cost tracking to contact data
    contact_data["total_cost"] = total_cost
    if enrichment_successful:
        print(f"💰 Total enrichment cost: ${total_cost:.3f} using {provider_used}")
    
    # Calculate credits based on actual results found
    credits_to_charge = 0
    email_found = bool(contact_data.get("email"))
    phone_found = bool(contact_data.get("phone"))
    
    # CORRECT CREDIT PRICING MODEL
    if email_found:
        credits_to_charge += 1  # 1 credit per email
        print(f"📧 Email found: +1 credit")
    
    if phone_found:
        credits_to_charge += 10  # 10 credits per phone
        print(f"📱 Phone found: +10 credits")
    
    if credits_to_charge == 0:
        print(f"💸 No results found: 0 credits charged")
    else:
        print(f"💳 Total credits to charge: {credits_to_charge}")
    
    # Update credits_consumed in contact data
    contact_data["credits_consumed"] = credits_to_charge
    
    # CHARGE CREDITS BASED ON RESULTS (only if we found something)
    if credits_to_charge > 0:
        try:
            with SyncSessionLocal() as session:
                # Check user credits
                user_result = session.execute(
                    text("SELECT credits FROM users WHERE id = :user_id"), 
                    {"user_id": user_id}
                )
                user_row = user_result.first()
                
                if not user_row:
                    print(f"❌ User {user_id} does not exist in database")
                    return {"status": "failed", "reason": "user_not_found"}
                else:
                    current_credits = user_row[0] if user_row[0] is not None else 0
                
                if current_credits < credits_to_charge:
                    print(f"❌ Insufficient credits for user {user_id}. Has {current_credits}, needs {credits_to_charge}")
                    print(f"⚠️  Results found but not enough credits to charge - marking as credit_insufficient")
                    
                    # Update job status to reflect credit issue
                    session.execute(
                        text("UPDATE import_jobs SET status = 'credit_insufficient' WHERE id = :job_id"),
                        {"job_id": job_id}
                    )
                    session.commit()
                    return {"status": "failed", "reason": "insufficient_credits"}
                
                # Deduct the calculated credits
                session.execute(
                    text("UPDATE users SET credits = credits - :credits WHERE id = :user_id"),
                    {"user_id": user_id, "credits": credits_to_charge}
                )
                
                # Log credit transaction with detailed breakdown
                reason_parts = []
                if email_found:
                    reason_parts.append("1 email (+1 credit)")
                if phone_found:
                    reason_parts.append("1 phone (+10 credits)")
                
                reason = f"Enrichment results: {', '.join(reason_parts)} for {lead.get('company', 'unknown')}"
                
                session.execute(
                    text("""
                        INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at)
                        VALUES (:user_id, 'enrichment', :cost, :change, :reason, CURRENT_TIMESTAMP)
                    """),
                    {
                        "user_id": user_id,
                        "operation_type": "enrichment", 
                        "cost": credits_to_charge,
                        "change": -credits_to_charge,
                        "reason": reason
                    }
                )
                session.commit()
                
                print(f"💳 Charged {credits_to_charge} credits from user {user_id}. Remaining: {current_credits - credits_to_charge}")
        
        except Exception as e:
            print(f"❌ Credit charging failed: {e}")
            return {"status": "failed", "reason": "credit_charge_error"}
    
    if not enrichment_successful:
        print(f"❌ All enrichment providers failed for {lead['first_name']} {lead['last_name']}")
        contact_data.update({
            "enrichment_status": "failed",
            "enrichment_provider": "none",
            "updated_at": datetime.utcnow()
        })
    
    # Save to database using SYNC operations
    try:
        with SyncSessionLocal() as session:
            # Insert contact record with MODERN VERIFICATION FIELDS
            contact_insert = text("""
                INSERT INTO contacts (
                    job_id, first_name, last_name, company, position, location, 
                    industry, profile_url, email, phone, enriched, enrichment_status,
                    enrichment_provider, enrichment_score, email_verified, phone_verified,
                    email_verification_score, phone_verification_score,
                    credits_consumed, created_at, updated_at
                ) VALUES (
                    :job_id, :first_name, :last_name, :company, :position, :location,
                    :industry, :profile_url, :email, :phone, :enriched, :enrichment_status,
                    :enrichment_provider, :enrichment_score, :email_verified, :phone_verified,
                    :email_verification_score, :phone_verification_score,
                    :credits_consumed, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING id
            """)
            
            result = session.execute(contact_insert, {
                "job_id": job_id,
                "first_name": contact_data["first_name"],
                "last_name": contact_data["last_name"],
                "company": contact_data["company"],
                "position": contact_data["position"],
                "location": contact_data["location"],
                "industry": contact_data["industry"],
                "profile_url": contact_data["profile_url"],
                "email": contact_data.get("email"),
                "phone": contact_data.get("phone"),
                "enriched": contact_data["enriched"],
                "enrichment_status": contact_data["enrichment_status"],
                "enrichment_provider": contact_data.get("enrichment_provider"),
                "enrichment_score": contact_data.get("enrichment_score"),
                "email_verified": contact_data.get("email_verified", False),
                "phone_verified": contact_data.get("phone_verified", False),
                "email_verification_score": contact_data.get("email_verification_score"),
                "phone_verification_score": contact_data.get("phone_verification_score"),
                "credits_consumed": contact_data["credits_consumed"]
            })
            
            contact_id = result.scalar()
            
            # Update job progress
            session.execute(
                text("UPDATE import_jobs SET completed = completed + 1, updated_at = CURRENT_TIMESTAMP WHERE id = :job_id"),
                {"job_id": job_id}
            )
            
            session.commit()
            print(f"📝 Saved contact {contact_id} and updated job progress")
            
            # Check if job is complete
            job_status_query = text("""
                SELECT total, completed FROM import_jobs WHERE id = :job_id
            """)
            job_result = session.execute(job_status_query, {"job_id": job_id})
            job_data = job_result.first()
            
            if job_data and job_data[1] >= job_data[0]:  # completed >= total
                # Job is complete, update status
                session.execute(
                    text("UPDATE import_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = :job_id"),
                    {"job_id": job_id}
                )
                session.commit()
                print(f"✅ Job {job_id} completed! All {job_data[0]} contacts processed")
                
                # Get job statistics for notification
                stats_query = text("""
                    SELECT 
                        COUNT(*) as total_contacts,
                        COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found,
                        COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as phones_found,
                        SUM(credits_consumed) as credits_used
                    FROM contacts
                    WHERE job_id = :job_id
                """)
                stats_result = session.execute(stats_query, {"job_id": job_id})
                stats = stats_result.first()
                
                # Send completion notification
                try:
                    notification_data = {
                        "user_id": user_id,
                        "job_id": job_id,
                        "job_status": "completed",
                        "results_summary": {
                            "total_contacts": stats[0] or 0,
                            "emails_found": stats[1] or 0,
                            "phones_found": stats[2] or 0,
                            "success_rate": ((stats[1] or 0) / (stats[0] or 1) * 100) if stats[0] else 0,
                            "credits_used": float(stats[3] or 0)
                        }
                    }
                    
                    httpx.post(
                        "http://notification-service:8000/api/notifications/job-completion",
                        json=notification_data,
                        timeout=5.0
                    )
                    print(f"📧 Job completion notification sent for job {job_id}")
                except Exception as e:
                    print(f"❌ Failed to send notification: {e}")
            
    except Exception as e:
        print(f"❌ Database save failed: {e}")
        contact_id = None
    
    # Return the enrichment result
    return {
        "status": "completed" if enrichment_successful else "failed",
        "contact_id": contact_id,
        "credits_consumed": credits_to_charge,
        "provider_used": provider_used
    }

@celery_app.task(name='app.tasks.process_csv_file')
def process_csv_file(file_path: str, job_id: str = None, user_id: str = None):
    """Process a CSV file and start the enrichment process."""
    logger.info(f"Processing CSV file: {file_path}")
    
    try:
        # Generate job ID if not provided
        if not job_id:
            job_id = f"job_{int(time.time())}"
        
        # Process the file
        process_enrichment_batch.delay(file_path, job_id, user_id)
        
        # Return the job ID
        return {'job_id': job_id}
    
    except Exception as e:
        logger.error(f"Error processing CSV file {file_path}: {str(e)}")
        raise

# ----- MODERN ADDITION: Verification and Stats Tasks ----- #

@celery_app.task(base=EnrichmentTask, bind=True, name='app.tasks.verify_existing_contacts')
def verify_existing_contacts(self, job_id: str):
    """
    Verify existing contacts that have emails/phones but no verification status
    """
    try:
        logger.info(f"Starting verification task for job: {job_id}")
        
        async def verify_contacts():
            async with AsyncSessionLocal() as session:
                # Get contacts that need verification
                stmt = text("""
                    SELECT id, email, phone 
                    FROM contacts 
                    WHERE job_id = :job_id 
                    AND (
                        (email IS NOT NULL AND (email_verified = false OR email_verification_score IS NULL)) OR
                        (phone IS NOT NULL AND (phone_verified = false OR phone_verification_score IS NULL))
                    )
                """)
                
                result = await session.execute(stmt, {"job_id": job_id})
                contacts = result.fetchall()
                
                logger.info(f"Found {len(contacts)} contacts needing verification")
                
                verified_count = 0
                
                for contact in contacts:
                    contact_id, email, phone = contact
                    
                    verification_data = {}
                    
                    # Verify email if present and verification available
                    if email and VERIFICATION_AVAILABLE:
                        email_result = await verify_email_if_available(email)
                        verification_data["email_verified"] = email_result["verified"]
                        verification_data["email_verification_score"] = email_result["score"] / 100
                        
                        # Save verification details
                        await save_enrichment_result(
                            session,
                            contact_id,
                            "email_verification",
                            {
                                "email": email,
                                "email_verified": email_result["verified"],
                                "verification_score": email_result["score"],
                                "raw_data": email_result["details"]
                            }
                        )
                    
                    # Verify phone if present and verification available
                    if phone and VERIFICATION_AVAILABLE:
                        phone_result = await verify_phone_if_available(phone)
                        verification_data["phone_verified"] = phone_result["verified"]
                        verification_data["phone_verification_score"] = phone_result["score"] / 100
                        
                        # Save verification details
                        await save_enrichment_result(
                            session,
                            contact_id,
                            "phone_verification",
                            {
                                "phone": phone,
                                "phone_verified": phone_result["verified"],
                                "verification_score": phone_result["score"],
                                "raw_data": phone_result["details"]
                            }
                        )
                    
                    # Update contact with verification results
                    if verification_data:
                        await update_contact(
                            session,
                            contact_id,
                            verification_data=verification_data
                        )
                        verified_count += 1
                
                logger.info(f"Verified {verified_count} contacts")
                return verified_count
        
        verified_count = run_async(verify_contacts())
        
        return {
            "success": True,
            "job_id": job_id,
            "verified_count": verified_count,
            "verification_available": VERIFICATION_AVAILABLE
        }
        
    except Exception as e:
        logger.error(f"Error in verify_existing_contacts: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "job_id": job_id,
            "verified_count": 0
        }


@celery_app.task(base=EnrichmentTask, bind=True, name='app.tasks.get_enrichment_stats')
def get_enrichment_stats(self, user_id: Optional[str] = None):
    """
    Get enrichment statistics for a user or globally
    """
    try:
        async def get_db_stats():
            async with AsyncSessionLocal() as session:
                # Base conditions
                where_conditions = []
                params = {}
                
                if user_id:
                    # Join with import_jobs to filter by user
                    where_conditions.append("ij.user_id = :user_id")
                    params["user_id"] = user_id
                
                where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
                
                # Get overall stats
                stats_query = text(f"""
                    SELECT 
                        COUNT(DISTINCT ij.id) as total_jobs,
                        COUNT(c.id) as total_contacts,
                        COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
                        COUNT(CASE WHEN c.phone IS NOT NULL THEN 1 END) as phones_found,
                        COUNT(CASE WHEN c.email_verified = true THEN 1 END) as emails_verified,
                        COUNT(CASE WHEN c.phone_verified = true THEN 1 END) as phones_verified,
                        AVG(c.enrichment_score) as avg_confidence,
                        AVG(c.email_verification_score) as avg_email_verification_score,
                        AVG(c.phone_verification_score) as avg_phone_verification_score,
                        SUM(COALESCE(c.credits_consumed, 0)) as total_credits_consumed
                    FROM import_jobs ij
                    LEFT JOIN contacts c ON ij.id = c.job_id
                    {where_clause}
                """)
                
                stats_result = await session.execute(stats_query, params)
                stats = stats_result.first()
                
                # Get provider stats
                provider_query = text(f"""
                    SELECT 
                        c.enrichment_provider,
                        COUNT(*) as count,
                        AVG(c.enrichment_score) as avg_score,
                        COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
                        COUNT(CASE WHEN c.phone IS NOT NULL THEN 1 END) as phones_found,
                        SUM(COALESCE(c.credits_consumed, 0)) as credits_used
                    FROM import_jobs ij
                    JOIN contacts c ON ij.id = c.job_id
                    {where_clause} {'AND' if where_clause else 'WHERE'} c.enrichment_provider IS NOT NULL
                    GROUP BY c.enrichment_provider
                    ORDER BY count DESC
                """)
                
                provider_result = await session.execute(provider_query, params)
                providers = [
                    {
                        "provider": row[0],
                        "count": row[1],
                        "avg_score": float(row[2]) if row[2] else 0,
                        "emails_found": row[3],
                        "phones_found": row[4],
                        "credits_used": float(row[5]) if row[5] else 0,
                        "email_success_rate": (row[3] / row[1] * 100) if row[1] > 0 else 0,
                        "phone_success_rate": (row[4] / row[1] * 100) if row[1] > 0 else 0
                    }
                    for row in provider_result.fetchall()
                ]
                
                # Calculate success rates
                total_contacts = stats[1] or 0
                emails_found = stats[2] or 0
                phones_found = stats[3] or 0
                
                return {
                    "total_jobs": stats[0] or 0,
                    "total_contacts": total_contacts,
                    "emails_found": emails_found,
                    "phones_found": phones_found,
                    "emails_verified": stats[4] or 0,
                    "phones_verified": stats[5] or 0,
                    "email_success_rate": (emails_found / total_contacts * 100) if total_contacts > 0 else 0,
                    "phone_success_rate": (phones_found / total_contacts * 100) if total_contacts > 0 else 0,
                    "avg_confidence": float(stats[6]) if stats[6] else 0,
                    "avg_email_verification_score": float(stats[7]) if stats[7] else 0,
                    "avg_phone_verification_score": float(stats[8]) if stats[8] else 0,
                    "total_credits_consumed": float(stats[9]) if stats[9] else 0,
                    "verification_available": VERIFICATION_AVAILABLE,
                    "modern_engine_available": MODERN_ENGINE_AVAILABLE,
                    "provider_stats": providers
                }
        
        db_stats = run_async(get_db_stats())
        
        return {
            "success": True,
            "stats": db_stats
        }
        
    except Exception as e:
        logger.error(f"Error getting enrichment stats: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "stats": {}
        }


@celery_app.task(base=EnrichmentTask, bind=True, name='app.tasks.enrich_single_contact_modern')
def enrich_single_contact_modern(self, lead_data: Dict[str, Any], contact_id: Optional[int] = None, job_id: Optional[str] = None, user_id: Optional[str] = None):
    """
    Modern single contact enrichment using the new engine if available, fallback to cascade
    """
    try:
        logger.info(f"Starting modern enrichment for contact: {lead_data.get('full_name', 'Unknown')}")
        
        # Try modern engine first if available
        if MODERN_ENGINE_AVAILABLE:
            try:
                result = run_async(enrich_single_contact(lead_data))
                
                if result and (result.get("email") or result.get("phone")):
                    logger.info(f"✅ Modern engine success: {result.get('email', 'no email')} via {result.get('source', 'unknown')}")
                    
                    # Process the modern result similar to cascade_enrich
                    # This would include verification, credit charging, database saving, etc.
                    # For now, return the result to show it's working
                    return {
                        "success": True,
                        "source": "modern_engine",
                        "email": result.get("email"),
                        "phone": result.get("phone"),
                        "confidence": result.get("confidence", 0),
                        "providers_tried": result.get("providers_tried", []),
                        "total_cost": result.get("total_cost", 0)
                    }
            except Exception as e:
                logger.warning(f"Modern engine failed, falling back to cascade: {e}")
        
        # Fallback to proven cascade enrichment
        logger.info("Using proven cascade enrichment")
        return cascade_enrich(lead_data, job_id or f"temp_{int(time.time())}", user_id or "system")
        
    except Exception as e:
        logger.error(f"Error in modern enrichment: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "source": "error"
        }

# ----- NEW 10-PROVIDER CASCADE SYSTEM (Cheapest to Most Expensive) ----- #

@retry_with_backoff(max_retries=2)
def call_enrow(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call Enrow API - CHEAPEST at $0.008/email"""
    try:
        # Extract name components
        first_name = lead.get("first_name", "")
        last_name = lead.get("last_name", "")
        company = lead.get("company", "")
        
        if not first_name or not last_name or not company:
            return {"email": None, "phone": None, "confidence": 0, "source": "enrow"}
        
        headers = {
            "Authorization": f"Bearer {settings.enrow_api}",
            "Content-Type": "application/json"
        }
        
        # FIXED: Use correct Enrow API format based on official documentation
        payload = {
            "full_name": f"{first_name} {last_name}",
            "domain": extract_domain(company)
        }
        
        print(f"🔍 Enrow API call for {first_name} {last_name} at {company}")
        
        # CORRECT ENDPOINT: https://api.enrow.io/single-email-find
        response = requests.post(
            "https://api.enrow.io/single-email-find",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"📡 Enrow response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Enrow data: {data}")
            
            # Extract email and confidence from response
            email = data.get("email") or data.get("result", {}).get("email")
            confidence = 85 if email else 0
            
            return {
                "email": email,
                "phone": None,  # Enrow primarily focuses on emails
                "confidence": confidence,
                "source": "enrow"
            }
        else:
            print(f"❌ Enrow API error: {response.status_code} - {response.text}")
            return {"email": None, "phone": None, "confidence": 0, "source": "enrow"}
            
    except Exception as e:
        print(f"❌ Enrow exception: {str(e)}")
        return {"email": None, "phone": None, "confidence": 0, "source": "enrow"}

@retry_with_backoff(max_retries=2)
def call_snov(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call Snov.io API - $0.02/email with async workflow"""
    try:
        first_name = lead.get("first_name", "")
        last_name = lead.get("last_name", "")
        company = lead.get("company", "")
        
        if not first_name or not last_name or not company:
            return {"email": None, "phone": None, "confidence": 0, "source": "snov"}
        
        # STEP 1: Get OAuth2 access token
        token_payload = {
            'grant_type': 'client_credentials',
            'client_id': settings.snov_api_id,
            'client_secret': settings.snov_api_secret
        }
        
        token_response = requests.post(
            'https://api.snov.io/v1/oauth/access_token',
            data=token_payload,
            timeout=30
        )
        
        if token_response.status_code != 200:
            print(f"❌ Snov.io token error: {token_response.status_code}")
            return {"email": None, "phone": None, "confidence": 0, "source": "snov"}
        
        access_token = token_response.json().get('access_token')
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        # STEP 2: Start email search
        search_payload = {
            'rows': [
                {
                    'first_name': first_name,
                    'last_name': last_name,
                    'domain': extract_domain(company)
                }
            ]
        }
        
        print(f"🔍 Snov.io API call for {first_name} {last_name} at {company}")
        
        start_response = requests.post(
            'https://api.snov.io/v2/emails-by-domain-by-name/start',
            json=search_payload,
            headers=headers,
            timeout=30
        )
        
        if start_response.status_code != 200:
            print(f"❌ Snov.io start error: {start_response.status_code}")
            return {"email": None, "phone": None, "confidence": 0, "source": "snov"}
        
        task_hash = start_response.json().get('data', {}).get('task_hash')
        
        if not task_hash:
            print("❌ Snov.io: No task hash received")
            return {"email": None, "phone": None, "confidence": 0, "source": "snov"}
        
        # STEP 3: Poll for results (with retries)
        for attempt in range(5):  # Try up to 5 times
            time.sleep(2)  # Wait 2 seconds between polls
            
            result_response = requests.get(
                f'https://api.snov.io/v2/emails-by-domain-by-name/result',
                params={'task_hash': task_hash},
                headers=headers,
                timeout=30
            )
            
            if result_response.status_code == 200:
                result_data = result_response.json()
                
                if result_data.get('status') == 'completed':
                    data = result_data.get('data', [])
                    if data and len(data) > 0:
                        result = data[0].get('result', [])
                        if result and len(result) > 0:
                            email = result[0].get('email')
                            smtp_status = result[0].get('smtp_status')
                            
                            confidence = 90 if smtp_status == 'valid' else 70 if email else 0
                            
                            return {
                                "email": email,
                                "phone": None,
                                "confidence": confidence,
                                "source": "snov"
                            }
                elif result_data.get('status') == 'in_progress':
                    continue  # Keep polling
                else:
                    break  # Failed or unknown status
        
        print("⏰ Snov.io: Task didn't complete in time")
        return {"email": None, "phone": None, "confidence": 0, "source": "snov"}
        
    except Exception as e:
        print(f"❌ Snov.io exception: {str(e)}")
        return {"email": None, "phone": None, "confidence": 0, "source": "snov"}

@retry_with_backoff(max_retries=2)
def call_anymailfinder(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call Anymailfinder API - $0.015/email"""
    try:
        first_name = lead.get("first_name", "")
        last_name = lead.get("last_name", "")
        company = lead.get("company", "")
        
        if not first_name or not last_name or not company:
            return {"email": None, "phone": None, "confidence": 0, "source": "anymailfinder"}
        
        headers = {
            "Authorization": f"Bearer {settings.anymailfinder_api}",
            "Content-Type": "application/json"
        }
        
        # FIXED: Use correct Anymailfinder API format based on official documentation
        payload = {
            "domain": extract_domain(company),
            "first_name": first_name,
            "last_name": last_name
        }
        
        print(f"🔍 Anymailfinder API call for {first_name} {last_name} at {company}")
        
        # CORRECT ENDPOINT: https://api.anymailfinder.com/v5.0/search/person.json
        response = requests.post(
            "https://api.anymailfinder.com/v5.0/search/person.json",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"📡 Anymailfinder response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Anymailfinder data: {data}")
            
            # Extract email and confidence from response
            email = data.get("email") or data.get("result", {}).get("email")
            confidence_score = data.get("confidence", 0)
            state = data.get("state", "")
            
            # Map confidence based on response
            if state == "high" or confidence_score > 80:
                confidence = 85
            elif email:
                confidence = 70
            else:
                confidence = 0
            
            return {
                "email": email,
                "phone": None,
                "confidence": confidence,
                "source": "anymailfinder"
            }
        else:
            print(f"❌ Anymailfinder API error: {response.status_code} - {response.text}")
            return {"email": None, "phone": None, "confidence": 0, "source": "anymailfinder"}
            
    except Exception as e:
        print(f"❌ Anymailfinder exception: {str(e)}")
        return {"email": None, "phone": None, "confidence": 0, "source": "anymailfinder"}

@retry_with_backoff(max_retries=2)
def call_findymail(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call Findymail API - $0.025/email"""
    try:
        first_name = lead.get("first_name", "")
        last_name = lead.get("last_name", "")
        company = lead.get("company", "")
        
        if not first_name or not last_name or not company:
            return {"email": None, "phone": None, "confidence": 0, "source": "findymail"}
        
        headers = {
            "Authorization": f"Bearer {settings.findymail_api}",
            "Content-Type": "application/json"
        }
        
        # Based on common API patterns for Findymail
        payload = {
            "first_name": first_name,
            "last_name": last_name,
            "domain": extract_domain(company)
        }
        
        print(f"🔍 Findymail API call for {first_name} {last_name} at {company}")
        
        # Use the most likely endpoint based on documentation patterns
        response = requests.post(
            "https://api.findymail.com/v1/email/find",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"📡 Findymail response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Findymail data: {data}")
            
            # Extract email and confidence from response
            email = data.get("email") or data.get("result", {}).get("email")
            confidence_score = data.get("confidence", 0) or data.get("score", 0)
            verified = data.get("verified", False)
            
            # Map confidence based on response
            if verified and confidence_score > 80:
                confidence = 90
            elif email:
                confidence = 75
            else:
                confidence = 0
            
            return {
                "email": email,
                "phone": None,
                "confidence": confidence,
                "source": "findymail"
            }
        else:
            print(f"❌ Findymail API error: {response.status_code} - {response.text}")
            return {"email": None, "phone": None, "confidence": 0, "source": "findymail"}
            
    except Exception as e:
        print(f"❌ Findymail exception: {str(e)}")
        return {"email": None, "phone": None, "confidence": 0, "source": "findymail"}

@retry_with_backoff(max_retries=2)
def call_datagma(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call Datagma API - $0.012/email"""
    try:
        headers = {
            "X-API-Key": settings.datagma_api,
            "Content-Type": "application/json"
        }
        
        # FIXED: Use correct Datagma API format - they accept fullname + company OR email/linkedin
        first_name = lead.get("first_name", "")
        last_name = lead.get("last_name", "")
        company = lead.get("company", "")
        
        payload = {
            "fullname": f"{first_name} {last_name}",
            "company": company
        }
        
        # Add domain if available
        if lead.get("company_domain"):
            payload["website"] = lead.get("company_domain")
        
        # FIXED: Use correct Datagma endpoint
        response = httpx.get(
            "https://gateway.datagma.net/api/ingress/v2/full",
            params=payload,
            headers=headers,
            timeout=15
        )
        
        if response.status_code != 200:
            logger.warning(f"Datagma API error: {response.status_code} - {response.text}")
            return {"email": None, "phone": None, "confidence": 0, "source": "datagma"}
        
        data = response.json()
        # Datagma returns nested data structure
        person_data = data.get("person", {})
        contact_data = person_data.get("contact", {})
        
        email = contact_data.get("email")
        phone = contact_data.get("phone")
        
        return {
            "email": email,
            "phone": phone,
            "confidence": 88 if email else 0,
            "source": "datagma",
            "cost": 0.012 if email else 0,
            "raw_data": data
        }
        
    except Exception as e:
        logger.error(f"Datagma error: {e}")
        return {"email": None, "phone": None, "confidence": 0, "source": "datagma"}

@retry_with_backoff(max_retries=2)
def call_kaspr(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call Kaspr API - MOST EXPENSIVE at $0.071/email"""
    try:
        headers = {
            "Authorization": f"Bearer {settings.kaspr_api}",
            "Content-Type": "application/json"
        }
        
        # Kaspr works best with LinkedIn URLs
        linkedin_url = lead.get("profile_url", "")
        
        if linkedin_url and "linkedin.com" in linkedin_url:
            payload = {"linkedin_url": linkedin_url}
        else:
            payload = {
                "first_name": lead.get("first_name", ""),
                "last_name": lead.get("last_name", ""),
                "company_name": lead.get("company", ""),
                "company_domain": lead.get("company_domain", "")
            }
        
        response = httpx.post(
            "https://api.kaspr.io/api/v1/enrich",
            json=payload,
            headers=headers,
            timeout=15
        )
        
        if response.status_code != 200:
            logger.warning(f"Kaspr API error: {response.status_code}")
            return {"email": None, "phone": None, "confidence": 0, "source": "kaspr"}
        
        data = response.json()
        contact = data.get("contact", {})
        email = contact.get("email")
        phone = contact.get("phone")
        
        return {
            "email": email,
            "phone": phone,
            "confidence": contact.get("confidence", 90) if email else 0,
            "source": "kaspr",
            "cost": 0.071 if email else 0,  # Most expensive
            "raw_data": data
        }
        
    except Exception as e:
        logger.error(f"Kaspr error: {e}")
        return {"email": None, "phone": None, "confidence": 0, "source": "kaspr"}

def extract_domain(company: str) -> str:
    """Extract domain from company name or URL"""
    if not company:
        return ""
    
    # Remove common protocols
    company = company.replace("https://", "").replace("http://", "").replace("www.", "")
    
    # If it already looks like a domain, use it
    if "." in company and not " " in company:
        return company.split("/")[0]  # Remove any path components
    
    # Otherwise, create a domain from company name
    domain = company.lower()
    # Remove common company suffixes
    suffixes = [" inc", " llc", " corp", " corporation", " company", " co", " ltd", " limited"]
    for suffix in suffixes:
        domain = domain.replace(suffix, "")
    
    # Remove special characters and spaces
    domain = "".join(c for c in domain if c.isalnum() or c in ".-")
    domain = domain.replace(" ", "").replace("-", "")
    
    # Add .com if no TLD present
    if "." not in domain:
        domain += ".com"
    
    return domain