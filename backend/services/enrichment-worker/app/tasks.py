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

# Define tables
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

# Initialize rate limiters for each service
rate_limiters = {
    'icypeas': RateLimiter(calls_per_minute=60),
    'dropcontact': RateLimiter(calls_per_minute=10),
    'hunter': RateLimiter(calls_per_minute=20),
    'apollo': RateLimiter(calls_per_minute=30)
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

# ----- Database Operations ----- #

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
    enrichment_data: Optional[Dict[str, Any]] = None
):
    """Update contact with enrichment results."""
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

# ----- API Service Integration ----- #

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
    wait_times = [3, 5, 8, 12, 20, 30]  # Progressive waiting
    
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
        
        # Get the first email and phone if available
        email = emails[0] if emails else None
        phone = phones[0] if phones else None
        
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
    wait_times = [3, 5, 8, 12, 15]  # Shorter polling as per docs recommendation
    
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
    """Placeholder for PDL enrichment."""
    logger.info("PDL enrichment not implemented yet")
    return {"email": None, "phone": None, "confidence": 0, "source": "pdl"}

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
    Cascade enrichment with multiple providers and credit tracking
    """
    print(f"🔄 Starting cascade enrichment for {lead.get('first_name', '')} {lead.get('last_name', '')} at {lead.get('company', '')}")
    
    # CREDIT DEDUCTION - PRODUCTION READY
    credits_needed = 1  # 1 credit per enrichment
    
    try:
        # Check and deduct credits BEFORE enrichment - using SYNC session
        with SyncSessionLocal() as session:
            # Check user credits
            user_result = session.execute(
                text("SELECT credits FROM users WHERE id = :user_id"), 
                {"user_id": user_id}
            )
            user_row = user_result.first()
            
            if not user_row:
                # User doesn't exist - this is an error condition
                # Users should be created during registration, not here
                print(f"❌ User {user_id} does not exist in database")
                return {"status": "failed", "reason": "user_not_found"}
            else:
                current_credits = user_row[0] if user_row[0] is not None else 0
            
            if current_credits < credits_needed:
                print(f"❌ Insufficient credits for user {user_id}. Has {current_credits}, needs {credits_needed}")
                # Update job status to reflect credit issue
                session.execute(
                    text("UPDATE import_jobs SET status = 'credit_insufficient' WHERE id = :job_id"),
                    {"job_id": job_id}
                )
                session.commit()
                return {"status": "failed", "reason": "insufficient_credits"}
            
            # Deduct credits
            session.execute(
                text("UPDATE users SET credits = credits - :credits WHERE id = :user_id"),
                {"user_id": user_id, "credits": credits_needed}
            )
            
            # Log credit transaction
            session.execute(
                text("""
                    INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at)
                    VALUES (:user_id, 'enrichment', :cost, :change, :reason, CURRENT_TIMESTAMP)
                """),
                {
                    "user_id": user_id,
                    "operation_type": "enrichment", 
                    "cost": credits_needed,
                    "change": -credits_needed,
                    "reason": f"Enrichment for {lead.get('company', 'unknown')}"
                }
            )
            session.commit()
            
            print(f"💳 Deducted {credits_needed} credits from user {user_id}. Remaining: {current_credits - credits_needed}")
    
    except Exception as e:
        print(f"❌ Credit deduction failed: {e}")
        return {"status": "failed", "reason": "credit_deduction_error"}
    
    # Proceed with enrichment
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
        "credits_consumed": credits_needed,  # Track credits used
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Try enrichment providers in order
    providers = ["apollo", "hunter", "clearbit", "pdl"]
    enrichment_successful = False
    
    for provider in providers:
        try:
            print(f"🔍 Trying enrichment with {provider}")
            
            if provider == "apollo":
                result = call_apollo(lead)
            elif provider == "hunter":
                result = call_hunter(lead)  
            elif provider == "clearbit":
                result = enrich_with_clearbit(lead)
            elif provider == "pdl":
                result = enrich_with_pdl(lead)
            else:
                continue
                
            if result and (result.get("email") or result.get("phone")):
                # Successful enrichment
                contact_data.update({
                    "email": result.get("email"),
                    "phone": result.get("phone"),
                    "enriched": True,
                    "enrichment_status": "completed",
                    "enrichment_provider": provider,
                    "enrichment_score": result.get("confidence", 85),
                    "email_verified": result.get("email_verified", False),
                    "phone_verified": result.get("phone_verified", False),
                    "updated_at": datetime.utcnow()
                })
                enrichment_successful = True
                print(f"✅ Enrichment successful with {provider}")
                break
                
        except Exception as e:
            print(f"❌ {provider} enrichment failed: {e}")
            continue
    
    if not enrichment_successful:
        print(f"❌ All enrichment providers failed for {contact_data['first_name']} {contact_data['last_name']}")
        contact_data.update({
            "enrichment_status": "failed",
            "enrichment_provider": "none",
            "updated_at": datetime.utcnow()
        })
        
        # Refund credits if enrichment completely failed - using SYNC session
        try:
            with SyncSessionLocal() as session:
                session.execute(
                    text("UPDATE users SET credits = credits + :credits WHERE id = :user_id"),
                    {"user_id": user_id, "credits": credits_needed}
                )
                
                # Log refund
                session.execute(
                    text("""
                        INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at)
                        VALUES (:user_id, 'refund', 0, :change, :reason, CURRENT_TIMESTAMP)
                    """),
                    {
                        "user_id": user_id,
                        "change": credits_needed,
                        "reason": "Enrichment failed - credit refund"
                    }
                )
                session.commit()
                print(f"💰 Refunded {credits_needed} credits to user {user_id}")
        except Exception as e:
            print(f"❌ Credit refund failed: {e}")
    
    # Save to database using SYNC operations
    try:
        with SyncSessionLocal() as session:
            # Insert contact record
            contact_insert = text("""
                INSERT INTO contacts (
                    job_id, first_name, last_name, company, position, location, 
                    industry, profile_url, email, phone, enriched, enrichment_status,
                    enrichment_provider, enrichment_score, email_verified, phone_verified,
                    credits_consumed, created_at, updated_at
                ) VALUES (
                    :job_id, :first_name, :last_name, :company, :position, :location,
                    :industry, :profile_url, :email, :phone, :enriched, :enrichment_status,
                    :enrichment_provider, :enrichment_score, :email_verified, :phone_verified,
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
        "credits_consumed": credits_needed,
        "provider_used": contact_data.get("enrichment_provider", "none")
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
