# app/tasks_v2.py
"""
Modern Celery tasks using the new enrichment engine with verification
"""
import os
import csv
import time
import json
import asyncio
from typing import Dict, List, Any, Optional
from pathlib import Path
import logging
from datetime import datetime
import uuid

# Celery imports
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded, Retry

# Database imports
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import insert, update, select, text

# Local imports
from app.celery import celery_app
from app.config import get_settings
from app.common import logger
from app.enrichment_engine import enrichment_engine, enrich_single_contact
from app.db_utils import (
    get_or_create_job,
    save_contact, 
    update_contact,
    save_enrichment_result,
    increment_job_progress,
    update_job_status,
    consume_credits
)

settings = get_settings()

# Initialize database connection
engine = create_async_engine(settings.database_url)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

def run_async(coro):
    """Run an async coroutine in a way that's compatible with Celery workers."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(coro)


class ModernEnrichmentTask(Task):
    """Modern task class with better error handling and verification support."""
    
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 2, 'countdown': 10}
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Task {task_id} failed: {exc}")
        logger.error(f"Full traceback: {einfo}")


@celery_app.task(base=ModernEnrichmentTask, bind=True, name='app.tasks_v2.enrich_single_contact_task')
def enrich_single_contact_task(self, lead_data: Dict[str, Any], contact_id: Optional[int] = None, job_id: Optional[str] = None, user_id: Optional[str] = None):
    """
    Enrich a single contact using the modern cascade engine
    """
    try:
        logger.info(f"Starting enrichment task for contact: {lead_data.get('full_name', 'Unknown')}")
        
        # Use the async enrichment engine
        result = run_async(enrich_single_contact(lead_data))
        
        # Save results to database if contact_id provided
        if contact_id:
            async def save_results():
                async with AsyncSessionLocal() as session:
                    # Update contact with results
                    enrichment_data = {
                        "provider": result.get("source", ""),
                        "confidence": result.get("confidence", 0),
                        "email_verified": result.get("email_verified", False),
                        "phone_verified": result.get("phone_verified", False)
                    }
                    
                    await update_contact(
                        session, 
                        contact_id,
                        email=result.get("email"),
                        phone=result.get("phone"),
                        enrichment_data=enrichment_data
                    )
                    
                    # Save detailed enrichment result
                    await save_enrichment_result(
                        session,
                        contact_id,
                        result.get("source", "unknown"),
                        result
                    )
                    
                    # Consume credits if user_id provided
                    if user_id:
                        await consume_credits(
                            session,
                            user_id,
                            contact_id,
                            bool(result.get("email")),
                            bool(result.get("phone")),
                            result.get("source", "unknown")
                        )
                    
                    # Update job progress if job_id provided
                    if job_id:
                        await increment_job_progress(session, job_id)
            
            run_async(save_results())
        
        # Log results
        if result.get("email"):
            verification_status = "verified" if result.get("email_verified") else "unverified"
            logger.info(f"✓ Enrichment success: {result['email']} ({verification_status}) from {result.get('source', 'unknown')}")
        else:
            logger.info(f"✗ No email found for contact")
        
        return {
            "success": True,
            "email": result.get("email"),
            "phone": result.get("phone"),
            "source": result.get("source"),
            "confidence": result.get("confidence", 0),
            "email_verified": result.get("email_verified", False),
            "phone_verified": result.get("phone_verified", False),
            "email_verification_score": result.get("email_verification_score", 0),
            "phone_verification_score": result.get("phone_verification_score", 0),
            "providers_tried": result.get("providers_tried", []),
            "cost": result.get("total_cost", 0),
            "processing_time": result.get("processing_time", 0),
            "verification_details": {
                "email": result.get("email_verification_details", {}),
                "phone": result.get("phone_verification_details", {})
            }
        }
        
    except Exception as e:
        logger.error(f"Error in enrich_single_contact_task: {str(e)}")
        
        # Save error to database if contact_id provided
        if contact_id:
            async def save_error():
                async with AsyncSessionLocal() as session:
                    await update_contact(
                        session,
                        contact_id,
                        enrichment_data={
                            "provider": "error",
                            "confidence": 0
                        }
                    )
                    
                    if job_id:
                        await increment_job_progress(session, job_id)
            
            run_async(save_error())
        
        return {
            "success": False,
            "error": str(e),
            "email": None,
            "phone": None,
            "source": "error",
            "confidence": 0,
            "cost": 0,
            "processing_time": 0
        }


@celery_app.task(base=ModernEnrichmentTask, bind=True, name='app.tasks_v2.process_csv_batch')
def process_csv_batch(self, file_path: str, job_id: str, user_id: str, batch_size: int = 50):
    """
    Process a CSV file in batches using the modern enrichment engine
    """
    try:
        logger.info(f"Starting CSV batch processing: {file_path}")
        
        # Verify file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"CSV file not found: {file_path}")
        
        # Read CSV and create contacts
        async def process_csv():
            async with AsyncSessionLocal() as session:
                # Read CSV file
                contacts_data = []
                with open(file_path, 'r', encoding='utf-8-sig') as csvfile:
                    reader = csv.DictReader(csvfile)
                    for row in reader:
                        # Normalize column names
                        normalized_row = {}
                        for key, value in row.items():
                            # Handle common CSV column variations
                            if key.lower() in ['full name', 'name', 'fullname']:
                                normalized_row['full_name'] = value
                            elif key.lower() in ['first name', 'firstname']:
                                normalized_row['first_name'] = value
                            elif key.lower() in ['last name', 'lastname']:
                                normalized_row['last_name'] = value
                            elif key.lower() in ['company', 'company name']:
                                normalized_row['company'] = value
                            elif key.lower() in ['company domain', 'domain', 'website']:
                                normalized_row['company_domain'] = value
                            elif key.lower() in ['linkedin', 'linkedin url', 'profile url']:
                                normalized_row['profile_url'] = value
                            elif key.lower() in ['position', 'title', 'job title']:
                                normalized_row['position'] = value
                            elif key.lower() in ['location', 'city', 'country']:
                                normalized_row['location'] = value
                            elif key.lower() in ['industry', 'sector']:
                                normalized_row['industry'] = value
                            else:
                                normalized_row[key.lower().replace(' ', '_')] = value
                        
                        contacts_data.append(normalized_row)
                
                total_contacts = len(contacts_data)
                logger.info(f"Found {total_contacts} contacts in CSV")
                
                # Create or update job
                await get_or_create_job(session, job_id, user_id, total_contacts)
                
                # Save contacts to database and get their IDs
                contact_ids = []
                for lead_data in contacts_data:
                    contact_id = await save_contact(session, job_id, lead_data)
                    contact_ids.append((contact_id, lead_data))
                
                logger.info(f"Saved {len(contact_ids)} contacts to database")
                
                return contact_ids, total_contacts
        
        contact_ids, total_contacts = run_async(process_csv())
        
        # Create enrichment tasks in batches
        batch_tasks = []
        for i in range(0, len(contact_ids), batch_size):
            batch = contact_ids[i:i + batch_size]
            
            # Create tasks for this batch
            for contact_id, lead_data in batch:
                task = enrich_single_contact_task.delay(
                    lead_data=lead_data,
                    contact_id=contact_id,
                    job_id=job_id,
                    user_id=user_id
                )
                batch_tasks.append(task)
            
            logger.info(f"Created batch {i//batch_size + 1} with {len(batch)} enrichment tasks")
        
        logger.info(f"Created {len(batch_tasks)} total enrichment tasks for job {job_id}")
        
        return {
            "success": True,
            "job_id": job_id,
            "total_contacts": total_contacts,
            "tasks_created": len(batch_tasks),
            "task_ids": [task.id for task in batch_tasks]
        }
        
    except Exception as e:
        logger.error(f"Error in process_csv_batch: {str(e)}")
        
        # Update job status to failed
        async def mark_job_failed():
            async with AsyncSessionLocal() as session:
                await update_job_status(session, job_id, "failed")
        
        run_async(mark_job_failed())
        
        return {
            "success": False,
            "error": str(e),
            "job_id": job_id
        }


@celery_app.task(base=ModernEnrichmentTask, bind=True, name='app.tasks_v2.bulk_enrich_contacts')
def bulk_enrich_contacts(self, leads: List[Dict[str, Any]], job_id: Optional[str] = None, user_id: Optional[str] = None):
    """
    Bulk enrich multiple contacts using the async batch enrichment
    """
    try:
        logger.info(f"Starting bulk enrichment for {len(leads)} contacts")
        
        # Use the async batch enrichment
        from app.enrichment_engine import enrich_contacts_batch
        
        results = run_async(enrich_contacts_batch(leads))
        
        # Process results
        success_count = sum(1 for r in results if r.get("email"))
        total_cost = sum(r.get("total_cost", 0) for r in results)
        
        logger.info(f"Bulk enrichment complete: {success_count}/{len(results)} emails found")
        logger.info(f"Total cost: ${total_cost:.4f}")
        
        # Save results to database if job_id provided
        if job_id:
            async def save_bulk_results():
                async with AsyncSessionLocal() as session:
                    for i, (lead, result) in enumerate(zip(leads, results)):
                        # Save contact and get ID
                        contact_id = await save_contact(session, job_id, lead)
                        
                        # Update with enrichment results
                        enrichment_data = {
                            "provider": result.get("source", ""),
                            "confidence": result.get("confidence", 0),
                            "email_verified": result.get("email_verified", False),
                            "phone_verified": result.get("phone_verified", False)
                        }
                        
                        await update_contact(
                            session,
                            contact_id,
                            email=result.get("email"),
                            phone=result.get("phone"),
                            enrichment_data=enrichment_data
                        )
                        
                        # Save detailed result
                        await save_enrichment_result(
                            session,
                            contact_id,
                            result.get("source", "bulk"),
                            result
                        )
                        
                        # Consume credits if user_id provided
                        if user_id:
                            await consume_credits(
                                session,
                                user_id,
                                contact_id,
                                bool(result.get("email")),
                                bool(result.get("phone")),
                                result.get("source", "bulk")
                            )
            
            run_async(save_bulk_results())
        
        return {
            "success": True,
            "total_processed": len(results),
            "emails_found": success_count,
            "success_rate": (success_count / len(results)) * 100 if results else 0,
            "total_cost": total_cost,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error in bulk_enrich_contacts: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "total_processed": 0,
            "emails_found": 0,
            "success_rate": 0,
            "total_cost": 0
        }


@celery_app.task(base=ModernEnrichmentTask, bind=True, name='app.tasks_v2.verify_existing_contacts')
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
                        (email IS NOT NULL AND email_verified = false) OR
                        (phone IS NOT NULL AND phone_verified = false)
                    )
                """)
                
                result = await session.execute(stmt, {"job_id": job_id})
                contacts = result.fetchall()
                
                logger.info(f"Found {len(contacts)} contacts needing verification")
                
                verified_count = 0
                
                for contact in contacts:
                    contact_id, email, phone = contact
                    
                    verification_data = {}
                    
                    # Verify email if present
                    if email:
                        from enrichment.email_verification import email_verifier
                        email_result = await email_verifier.verify_email(email)
                        verification_data["email_verified"] = email_result.is_valid
                        verification_data["email_verification_score"] = email_result.score / 100
                        
                        # Save verification details
                        await save_enrichment_result(
                            session,
                            contact_id,
                            "email_verification",
                            {
                                "email": email,
                                "email_verified": email_result.is_valid,
                                "verification_score": email_result.score,
                                "verification_details": {
                                    "level": email_result.verification_level,
                                    "is_catchall": email_result.is_catchall,
                                    "is_disposable": email_result.is_disposable,
                                    "is_role_based": email_result.is_role_based,
                                    "deliverable": email_result.deliverable,
                                    "reason": email_result.reason
                                }
                            }
                        )
                    
                    # Verify phone if present
                    if phone:
                        from enrichment.phone_verification import phone_verifier
                        phone_result = await phone_verifier.verify_phone(phone)
                        verification_data["phone_verified"] = phone_result.is_valid
                        verification_data["phone_verification_score"] = phone_result.score / 100
                        
                        # Save verification details
                        await save_enrichment_result(
                            session,
                            contact_id,
                            "phone_verification",
                            {
                                "phone": phone,
                                "phone_verified": phone_result.is_valid,
                                "verification_score": phone_result.score,
                                "verification_details": {
                                    "is_mobile": phone_result.is_mobile,
                                    "is_landline": phone_result.is_landline,
                                    "is_voip": phone_result.is_voip,
                                    "country": phone_result.country,
                                    "carrier": phone_result.carrier_name,
                                    "region": phone_result.region,
                                    "reason": phone_result.reason
                                }
                            }
                        )
                    
                    # Update contact with verification results
                    if verification_data:
                        await update_contact(
                            session,
                            contact_id,
                            enrichment_data=verification_data
                        )
                        verified_count += 1
                
                logger.info(f"Verified {verified_count} contacts")
                return verified_count
        
        verified_count = run_async(verify_contacts())
        
        return {
            "success": True,
            "job_id": job_id,
            "verified_count": verified_count
        }
        
    except Exception as e:
        logger.error(f"Error in verify_existing_contacts: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "job_id": job_id,
            "verified_count": 0
        }


@celery_app.task(base=ModernEnrichmentTask, bind=True, name='app.tasks_v2.get_enrichment_stats')
def get_enrichment_stats(self):
    """
    Get enrichment engine statistics
    """
    try:
        stats = enrichment_engine.get_stats()
        
        # Add system-wide stats
        async def get_db_stats():
            async with AsyncSessionLocal() as session:
                # Get job stats
                job_stats = await session.execute(text("""
                    SELECT status, COUNT(*) as count
                    FROM import_jobs
                    GROUP BY status
                """))
                
                # Get enrichment stats
                enrichment_stats = await session.execute(text("""
                    SELECT 
                        COUNT(*) as total_contacts,
                        COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found,
                        COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as phones_found,
                        COUNT(CASE WHEN email_verified = true THEN 1 END) as emails_verified,
                        COUNT(CASE WHEN phone_verified = true THEN 1 END) as phones_verified,
                        AVG(enrichment_score) as avg_confidence
                    FROM contacts
                    WHERE enriched = true
                """))
                
                # Get provider stats
                provider_stats = await session.execute(text("""
                    SELECT 
                        enrichment_provider,
                        COUNT(*) as count,
                        AVG(enrichment_score) as avg_score
                    FROM contacts
                    WHERE enrichment_provider IS NOT NULL
                    GROUP BY enrichment_provider
                    ORDER BY count DESC
                """))
                
                return {
                    "jobs": {row[0]: row[1] for row in job_stats.fetchall()},
                    "enrichment": dict(enrichment_stats.fetchone()._asdict()),
                    "providers": [
                        {
                            "provider": row[0],
                            "count": row[1],
                            "avg_score": float(row[2]) if row[2] else 0
                        }
                        for row in provider_stats.fetchall()
                    ]
                }
        
        db_stats = run_async(get_db_stats())
        
        return {
            "success": True,
            "engine_stats": stats,
            "database_stats": db_stats
        }
        
    except Exception as e:
        logger.error(f"Error getting enrichment stats: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        } 