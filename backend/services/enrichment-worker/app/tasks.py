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

# Celery imports
from celery import Task, chain, group
from celery.exceptions import SoftTimeLimitExceeded, Retry

# Database imports
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import insert, update, select, delete, text

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

# Initialize rate limiters for each service
rate_limiters = {
    'icypeas': RateLimiter(calls_per_minute=60),
    'dropcontact': RateLimiter(calls_per_minute=10),
    'hunter': RateLimiter(calls_per_minute=20),
    'apollo': RateLimiter(calls_per_minute=30)
}

# ----- Database Operations ----- #

async def get_or_create_job(session: AsyncSession, job_id: str, user_id: str, total_contacts: int) -> str:
    """Get or create an import job record."""
    # Check if job exists
    stmt = select("*").where(f"id = '{job_id}'").limit(1)
    result = await session.execute(stmt)
    job = result.first()
    
    if not job:
        # Create new job
        stmt = insert("import_jobs").values(
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
    stmt = insert("contacts").values(
        job_id=job_id,
        first_name=lead.get("first_name", ""),
        last_name=lead.get("last_name", ""),
        position=lead.get("position", ""),
        company=lead.get("company", ""),
        company_domain=lead.get("company_domain", ""),
        profile_url=lead.get("profile_url", ""),
        location=lead.get("location", ""),
        industry=lead.get("industry", ""),
        enriched=False,
        enrichment_status="pending",
        created_at=datetime.now(),
        updated_at=datetime.now()
    ).returning("id")
    
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
    stmt = insert("enrichment_results").values(
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
    stmt = update("import_jobs").where(f"id = '{job_id}'").values(
        status=status,
        updated_at=datetime.now()
    )
    
    await session.execute(stmt)
    await session.commit()

# ----- API Service Integration ----- #

@retry_with_backoff(max_retries=2)
def call_icypeas(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Icypeas API to enrich a contact."""
    # Respect rate limits
    rate_limiters['icypeas'].wait()
    
    # Prepare headers and payload
    headers = {
        "X-API-KEY": settings.icypeas_api,
        "X-API-SECRET": settings.icypeas_secret,
        "Content-Type": "application/json"
    }
    
    payload = {
        "firstname": lead.get("first_name", ""),
        "lastname": lead.get("last_name", ""),
        "domainOrCompany": lead.get("company", "") or lead.get("company_domain", "")
    }
    
    # Add LinkedIn URL if available
    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            payload["linkedin"] = linkedin_url
    
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
        logger.warning("Icypeas did not return request ID")
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
    
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
            continue
        
        # Parse results
        poll_data = poll_response.json()
        items = poll_data.get("items", [])
        
        if not items:
            continue
        
        item = items[0]
        status = item.get("status")
        
        # Check if results are ready
        if status not in ("DEBITED", "FREE"):
            continue
        
        # Extract results
        results = item.get("results", {})
        emails = results.get("emails", [])
        phones = results.get("phones", [])
        
        # Get the first email and phone if available
        email = emails[0] if emails else None
        phone = phones[0] if phones else None
        
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
    
    payload = {
        "data": [{
            "first_name": lead.get("first_name", ""),
            "last_name": lead.get("last_name", ""),
            "company": lead.get("company", ""),
            "linkedin_url": lead.get("profile_url", ""),
            "email": lead.get("email", "")
        }],
        "siren": True,
        "language": "en",
        "num": True,
        "sync": False  # Async mode for better reliability
    }
    
    # Make the API request
    response = httpx.post(
        "https://api.dropcontact.io/batch",
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
    
    # Poll for results
    wait_times = [3, 5, 8, 12, 20, 30]  # Progressive waiting
    
    for i, wait_time in enumerate(wait_times):
        # Wait before checking results
        time.sleep(wait_time)
        
        # Make polling request
        poll_response = httpx.get(
            f"https://api.dropcontact.io/batch/{request_id}",
            headers=headers,
            timeout=20
        )
        
        # Check for errors
        if poll_response.status_code != 200:
            continue
        
        # Parse results
        poll_data = poll_response.json()
        status = poll_data.get("status")
        
        # Check if results are ready
        if status != "completed":
            continue
        
        # Extract results
        if "data" in poll_data and len(poll_data["data"]) > 0:
            result = poll_data["data"][0]
            
            email = result.get("email", {}).get("email")
            phone = result.get("phone", {}).get("number")
            
            # Determine confidence score
            quality = result.get("email", {}).get("quality", "")
            confidence = 0
            if quality == "high":
                confidence = 90
            elif quality == "medium":
                confidence = 70
            elif quality == "low":
                confidence = 40
            
            # Return results
            return {
                "email": email,
                "phone": phone,
                "confidence": confidence,
                "source": "dropcontact",
                "raw_data": result
            }
    
    # No results after polling
    logger.warning(f"Dropcontact polling timeout for request ID {request_id}")
    return {"email": None, "phone": None, "confidence": 0, "source": "dropcontact"}


@retry_with_backoff(max_retries=2)
def call_hunter(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Hunter API to enrich a contact."""
    # Respect rate limits
    rate_limiters['hunter'].wait()
    
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
            
            if domain_response.status_code == 200:
                domain_data = domain_response.json().get("data", {})
                domain = domain_data.get("domain")
    else:
        domain = lead.get("company_domain")
    
    # If still no domain, try LinkedIn URL as fallback
    if not domain and lead.get("profile_url") and "linkedin.com" in lead.get("profile_url", ""):
        # Could try to parse company from LinkedIn URL if needed
        pass
    
    # If still no domain, return empty result
    if not domain:
        logger.info(f"Hunter: No domain found for {lead.get('first_name')} {lead.get('last_name')}")
        return {"email": None, "phone": None, "confidence": 0, "source": "hunter"}
    
    # Now use email-finder to get the email
    email_response = httpx.get(
        "https://api.hunter.io/v2/email-finder",
        params={
            "domain": domain,
            "first_name": lead.get("first_name", ""),
            "last_name": lead.get("last_name", ""),
            "api_key": settings.hunter_api
        },
        timeout=15
    )
    
    # Check for errors
    if email_response.status_code != 200:
        logger.warning(f"Hunter email-finder error: {email_response.status_code}")
        return {"email": None, "phone": None, "confidence": 0, "source": "hunter"}
    
    # Parse results
    email_data = email_response.json().get("data", {})
    email = email_data.get("email")
    score = email_data.get("score", 0)
    
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
    
    # Prepare the search parameters
    params = {
        "api_key": settings.apollo_api,
        "q_organization_domains": lead.get("company_domain", ""),
        "q_names": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip(),
    }
    
    # Add LinkedIn URL if available
    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            params["contact_linkedin_url"] = linkedin_url
    
    # Make the API request
    response = httpx.get(
        "https://api.apollo.io/v1/people/search",
        params=params,
        timeout=20
    )
    
    # Check for errors
    if response.status_code == 401 or response.status_code == 403:
        logger.error("Apollo authentication failed")
        service_status.mark_unavailable('apollo')
        return {"email": None, "phone": None, "confidence": 0, "source": "apollo"}
    
    if response.status_code != 200:
        logger.warning(f"Apollo API error: {response.status_code} - {response.text}")
        return {"email": None, "phone": None, "confidence": 0, "source": "apollo"}
    
    # Parse results
    data = response.json()
    people = data.get("people", [])
    
    if not people:
        logger.info(f"Apollo: No results for {lead.get('first_name')} {lead.get('last_name')}")
        return {"email": None, "phone": None, "confidence": 0, "source": "apollo"}
    
    # Get the first person
    person = people[0]
    
    # Extract email and phone
    email = person.get("email")
    phone = person.get("phone_number")
    
    # Return results
    return {
        "email": email,
        "phone": phone,
        "confidence": 85 if email else 0,  # Default confidence for Apollo
        "source": "apollo",
        "raw_data": person
    }

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
        session = AsyncSessionLocal()
        asyncio.run(get_or_create_job(session, job_id, user_id, len(contacts)))
        
        # Process each contact
        for contact in contacts:
            # Normalize keys (convert to lowercase with underscores)
            normalized = {}
            for key, value in contact.items():
                normalized_key = key.lower().replace(' ', '_')
                normalized[normalized_key] = value
            
            # Map common fields
            lead = {
                'first_name': normalized.get('first_name', '') or normalized.get('firstname', ''),
                'last_name': normalized.get('last_name', '') or normalized.get('lastname', ''),
                'company': normalized.get('company', '') or normalized.get('company_name', ''),
                'company_domain': normalized.get('company_domain', '') or normalized.get('domain', ''),
                'profile_url': normalized.get('profile_url', '') or normalized.get('linkedin_url', ''),
                'position': normalized.get('position', '') or normalized.get('title', ''),
                'location': normalized.get('location', ''),
                'industry': normalized.get('industry', '')
            }
            
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
    """Cascade through enrichment services based on cost efficiency."""
    logger.info(f"Starting cascading enrichment for {lead.get('first_name')} {lead.get('last_name')}")
    
    try:
        # Get database session and save contact
        session = AsyncSessionLocal()
        contact_id = asyncio.run(save_contact(session, job_id, lead))
        
        # Initialize result variables
        best_result = None
        best_confidence = 0
        
        # Try each service in order of cost (cheapest first)
        for service in settings.service_order:
            # Skip if service is unavailable
            if not service_status.is_available(service):
                logger.info(f"Skipping {service} (unavailable)")
                continue
            
            # Call the appropriate service
            result = None
            if service == 'icypeas':
                result = call_icypeas(lead)
            elif service == 'dropcontact':
                result = call_dropcontact(lead)
            elif service == 'hunter':
                result = call_hunter(lead)
            elif service == 'apollo':
                result = call_apollo(lead)
            
            # Skip if no result
            if not result or not result.get('email'):
                logger.info(f"{service} returned no email for {lead.get('first_name')} {lead.get('last_name')}")
                continue
            
            # Save the result
            asyncio.run(save_enrichment_result(session, contact_id, service, result))
            
            # Calculate confidence
            confidence = calculate_confidence(result, service)
            
            logger.info(f"{service} returned email {result.get('email')} with confidence {confidence:.2f}")
            
            # Update best result if this is better
            if confidence > best_confidence:
                best_result = result
                best_confidence = confidence
            
            # If we have a high confidence result, stop cascading
            if confidence >= settings.high_confidence:
                logger.info(f"High confidence result found, stopping cascade")
                break
        
        # Update the contact with the best result
        if best_result and best_confidence >= settings.minimum_confidence:
            enrichment_data = {
                'provider': best_result.get('source'),
                'confidence': best_confidence,
                'email_verified': True,  # Could implement actual verification
                'phone_verified': bool(best_result.get('phone'))
            }
            
            asyncio.run(update_contact(
                session, 
                contact_id, 
                email=best_result.get('email'), 
                phone=best_result.get('phone'),
                enrichment_data=enrichment_data
            ))
            
            logger.info(f"Contact updated with best result from {best_result.get('source')}")
        else:
            # No good results, mark as failed
            asyncio.run(update_contact(
                session,
                contact_id,
                enrichment_data={
                    'provider': None,
                    'confidence': 0,
                    'email_verified': False,
                    'phone_verified': False
                }
            ))
            
            logger.info(f"No valid results found for {lead.get('first_name')} {lead.get('last_name')}")
        
        # Increment job progress
        asyncio.run(increment_job_progress(session, job_id))
        
        # Return the enrichment result
        return {
            'contact_id': contact_id,
            'email': best_result.get('email') if best_result else None,
            'phone': best_result.get('phone') if best_result else None,
            'provider': best_result.get('source') if best_result else None,
            'confidence': best_confidence
        }
    
    except SoftTimeLimitExceeded:
        logger.error(f"Task timed out for {lead.get('first_name')} {lead.get('last_name')}")
        raise
    
    except Exception as e:
        logger.error(f"Error in cascading enrichment: {str(e)}")
        raise

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
