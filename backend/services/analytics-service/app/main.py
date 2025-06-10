"""
Analytics Service for Captely
Provides business statistics and user-facing analytics dashboard
"""
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, date
from common.config import get_settings
from common.db import get_async_session, async_engine, get_session
from common.auth import verify_api_token
from app.models import Base
import httpx
import base64
import asyncio
import json

app = FastAPI(
    title="Captely Analytics Service",
    description="Business analytics and statistics dashboard",
    version="1.0.0"
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# @app.on_event("startup")
# async def startup_event():
#     """Create database tables on startup"""
#     async with async_engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)

# Pydantic models
class DateRange(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None

# Flower proxy configuration
FLOWER_URL = "http://captely-flower:5555"
FLOWER_AUTH = base64.b64encode(b"admin:flowerpassword").decode()

@app.get("/api/flower/workers")
async def proxy_flower_workers():
    """Proxy Flower workers endpoint with authentication"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{FLOWER_URL}/api/workers",
                headers={"Authorization": f"Basic {FLOWER_AUTH}"},
                follow_redirects=True
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Flower error: {e}")
        raise HTTPException(status_code=503, detail=f"Flower service unavailable: {str(e)}")
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@app.get("/api/flower/tasks")
async def proxy_flower_tasks():
    """Proxy Flower tasks endpoint with authentication"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{FLOWER_URL}/api/tasks",
                headers={"Authorization": f"Basic {FLOWER_AUTH}"},
                follow_redirects=True
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Flower error: {e}")
        raise HTTPException(status_code=503, detail=f"Flower service unavailable: {str(e)}")
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@app.get("/api/analytics/dashboard/{user_id}")
async def get_user_dashboard(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_api_token)
):
    """Get comprehensive dashboard analytics for a user"""
    
    # Overall statistics
    stats_query = """
        SELECT 
            COUNT(*) as total_contacts,
            COUNT(CASE WHEN enriched = true THEN 1 END) as enriched_contacts,
            COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as emails_found,
            COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as phones_found,
            COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_emails,
            COUNT(CASE WHEN phone_verified = true THEN 1 END) as verified_phones,
            COUNT(CASE WHEN is_disposable = true THEN 1 END) as disposable_emails,
            COUNT(CASE WHEN is_role_based = true THEN 1 END) as role_based_emails,
            AVG(enrichment_score) as avg_confidence,
            AVG(email_verification_score) as avg_email_score,
            SUM(credits_consumed) as total_credits_used
        FROM contacts 
        WHERE job_id IN (
            SELECT id FROM import_jobs WHERE user_id = :user_id
        )
    """
    
    result = await session.execute(text(stats_query), {"user_id": user_id})
    stats = result.first()
    
    # Provider performance
    provider_query = """
        SELECT 
            enrichment_provider,
            COUNT(*) as contacts_processed,
            COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as emails_found,
            AVG(enrichment_score) as avg_confidence,
            SUM(credits_consumed) as credits_used
        FROM contacts 
        WHERE job_id IN (
            SELECT id FROM import_jobs WHERE user_id = :user_id
        )
        AND enrichment_provider IS NOT NULL
        GROUP BY enrichment_provider
    """
    
    provider_result = await session.execute(text(provider_query), {"user_id": user_id})
    provider_stats = [
        {
            "provider": row[0],
            "contacts_processed": row[1],
            "emails_found": row[2],
            "success_rate": (row[2] / row[1] * 100) if row[1] > 0 else 0,
            "avg_confidence": round(float(row[3] or 0), 2),
            "credits_used": float(row[4] or 0)
        }
        for row in provider_result.fetchall()
    ]
    
    # Recent jobs performance
    jobs_query = """
        SELECT 
            ij.id,
            ij.created_at,
            ij.total,
            ij.completed,
            ij.status,
            COUNT(c.id) as processed_contacts,
            COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as emails_found,
            AVG(c.enrichment_score) as avg_confidence,
            SUM(c.credits_consumed) as credits_used
        FROM import_jobs ij
        LEFT JOIN contacts c ON ij.id = c.job_id
        WHERE ij.user_id = :user_id
        GROUP BY ij.id, ij.created_at, ij.total, ij.completed, ij.status
        ORDER BY ij.created_at DESC
        LIMIT 10
    """
    
    jobs_result = await session.execute(text(jobs_query), {"user_id": user_id})
    recent_jobs = [
        {
            "job_id": row[0],
            "created_at": row[1],
            "total_contacts": row[2],
            "completed": row[3],
            "status": row[4],
            "processed_contacts": row[5] or 0,
            "emails_found": row[6] or 0,
            "success_rate": ((row[6] or 0) / (row[5] or 1) * 100) if row[5] else 0,
            "avg_confidence": round(float(row[7] or 0), 2),
            "credits_used": float(row[8] or 0),
            "completion_rate": (row[3] / row[2] * 100) if row[2] > 0 else 0
        }
        for row in jobs_result.fetchall()
    ]
    
    # Daily activity for the last 30 days
    activity_query = """
        SELECT 
            DATE(c.created_at) as date,
            COUNT(*) as contacts_processed,
            COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as emails_found,
            SUM(c.credits_consumed) as credits_used
        FROM contacts c
        WHERE c.job_id IN (
            SELECT id FROM import_jobs WHERE user_id = :user_id
        )
        AND c.created_at >= :start_date
        GROUP BY DATE(c.created_at)
        ORDER BY date DESC
    """
    
    thirty_days_ago = datetime.now() - timedelta(days=30)
    activity_result = await session.execute(text(activity_query), {
        "user_id": user_id,
        "start_date": thirty_days_ago
    })
    
    daily_activity = [
        {
            "date": row[0].isoformat(),
            "contacts_processed": row[1],
            "emails_found": row[2],
            "success_rate": (row[2] / row[1] * 100) if row[1] > 0 else 0,
            "credits_used": float(row[3] or 0)
        }
        for row in activity_result.fetchall()
    ]
    
    # Calculate derived metrics
    total_contacts = stats[0] or 0
    enriched_contacts = stats[1] or 0
    emails_found = stats[2] or 0
    phones_found = stats[3] or 0
    
    return {
        "overview": {
            "total_contacts": total_contacts,
            "enriched_contacts": enriched_contacts,
            "emails_found": emails_found,
            "phones_found": phones_found,
            "verified_emails": stats[4] or 0,
            "verified_phones": stats[5] or 0,
            "disposable_emails": stats[6] or 0,
            "role_based_emails": stats[7] or 0,
            "enrichment_rate": (enriched_contacts / total_contacts * 100) if total_contacts > 0 else 0,
            "email_success_rate": (emails_found / total_contacts * 100) if total_contacts > 0 else 0,
            "phone_success_rate": (phones_found / total_contacts * 100) if total_contacts > 0 else 0,
            "avg_confidence_score": round(float(stats[8] or 0), 2),
            "avg_email_verification_score": round(float(stats[9] or 0), 2),
            "total_credits_used": float(stats[10] or 0)
        },
        "provider_performance": provider_stats,
        "recent_jobs": recent_jobs,
        "daily_activity": daily_activity
    }

@app.get("/api/analytics/enrichment-stats/{user_id}")
async def get_enrichment_statistics(
    user_id: str,
    date_range: Optional[DateRange] = None,
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_api_token)
):
    """Get detailed enrichment statistics with filtering"""
    
    # Build date filter
    date_filter = ""
    params = {"user_id": user_id}
    
    if date_range and date_range.start_date:
        date_filter += " AND c.created_at >= :start_date"
        params["start_date"] = date_range.start_date
        
    if date_range and date_range.end_date:
        date_filter += " AND c.created_at <= :end_date"
        params["end_date"] = date_range.end_date
    
    # Enrichment funnel analysis
    funnel_query = f"""
        SELECT 
            COUNT(*) as total_contacts,
            COUNT(CASE WHEN enrichment_status != 'pending' THEN 1 END) as processed,
            COUNT(CASE WHEN enriched = true THEN 1 END) as enriched,
            COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as emails_found,
            COUNT(CASE WHEN email_verified = true THEN 1 END) as emails_verified,
            COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as phones_found,
            COUNT(CASE WHEN phone_verified = true THEN 1 END) as phones_verified
        FROM contacts c
        WHERE c.job_id IN (
            SELECT id FROM import_jobs WHERE user_id = :user_id
        )
        {date_filter}
    """
    
    result = await session.execute(text(funnel_query), params)
    funnel_data = result.first()
    
    # Email quality distribution
    email_quality_query = f"""
        SELECT 
            CASE 
                WHEN email_verification_score >= 90 THEN 'excellent'
                WHEN email_verification_score >= 80 THEN 'very_good'
                WHEN email_verification_score >= 70 THEN 'good'
                WHEN email_verification_score >= 50 THEN 'fair'
                ELSE 'poor'
            END as quality_tier,
            COUNT(*) as count
        FROM contacts c
        WHERE c.job_id IN (
            SELECT id FROM import_jobs WHERE user_id = :user_id
        )
        AND email IS NOT NULL
        {date_filter}
        GROUP BY quality_tier
    """
    
    quality_result = await session.execute(text(email_quality_query), params)
    email_quality = {row[0]: row[1] for row in quality_result.fetchall()}
    
    # Phone type distribution
    phone_type_query = f"""
        SELECT 
            phone_type,
            COUNT(*) as count
        FROM contacts c
        WHERE c.job_id IN (
            SELECT id FROM import_jobs WHERE user_id = :user_id
        )
        AND phone IS NOT NULL
        {date_filter}
        GROUP BY phone_type
    """
    
    phone_result = await session.execute(text(phone_type_query), params)
    phone_distribution = {row[0]: row[1] for row in phone_result.fetchall()}
    
    # Industry breakdown
    industry_query = f"""
        SELECT 
            industry,
            COUNT(*) as contacts,
            COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as emails_found,
            AVG(enrichment_score) as avg_confidence
        FROM contacts c
        WHERE c.job_id IN (
            SELECT id FROM import_jobs WHERE user_id = :user_id
        )
        AND industry IS NOT NULL AND industry != ''
        {date_filter}
        GROUP BY industry
        ORDER BY contacts DESC
        LIMIT 10
    """
    
    industry_result = await session.execute(text(industry_query), params)
    industry_stats = [
        {
            "industry": row[0],
            "contacts": row[1],
            "emails_found": row[2],
            "success_rate": (row[2] / row[1] * 100) if row[1] > 0 else 0,
            "avg_confidence": round(float(row[3] or 0), 2)
        }
        for row in industry_result.fetchall()
    ]
    
    total = funnel_data[0] or 1  # Avoid division by zero
    
    return {
        "enrichment_funnel": {
            "total_contacts": funnel_data[0] or 0,
            "processed": funnel_data[1] or 0,
            "enriched": funnel_data[2] or 0,
            "emails_found": funnel_data[3] or 0,
            "emails_verified": funnel_data[4] or 0,
            "phones_found": funnel_data[5] or 0,
            "phones_verified": funnel_data[6] or 0,
            "conversion_rates": {
                "processed_rate": (funnel_data[1] / total * 100),
                "enriched_rate": (funnel_data[2] / total * 100),
                "email_found_rate": (funnel_data[3] / total * 100),
                "email_verified_rate": (funnel_data[4] / total * 100),
                "phone_found_rate": (funnel_data[5] / total * 100),
                "phone_verified_rate": (funnel_data[6] / total * 100)
            }
        },
        "email_quality_distribution": email_quality,
        "phone_type_distribution": phone_distribution,
        "industry_breakdown": industry_stats
    }

@app.get("/api/analytics/job/{job_id}")
async def get_job_analytics(job_id: str, session: AsyncSession = Depends(get_async_session)):
    """Get real-time analytics for a specific enrichment job"""
    try:
        # Get job details
        job_query = """
            SELECT id, user_id, status, total, completed, file_name, created_at, updated_at
            FROM import_jobs 
            WHERE id = :job_id
        """
        job_result = await session.execute(text(job_query), {"job_id": job_id})
        job = job_result.first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get enrichment statistics
        stats_query = """
            SELECT 
                COUNT(*) as total_contacts,
                COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as emails_found,
                COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as phones_found,
                COUNT(CASE WHEN enriched = true THEN 1 END) as enriched_count,
                AVG(CASE WHEN enrichment_score IS NOT NULL THEN enrichment_score END) as avg_confidence,
                SUM(credits_consumed) as total_credits_used
            FROM contacts 
            WHERE job_id = :job_id
        """
        stats_result = await session.execute(text(stats_query), {"job_id": job_id})
        stats = stats_result.first()
        
        # Calculate rates
        total_contacts = stats.total_contacts or 0
        emails_found = stats.emails_found or 0
        phones_found = stats.phones_found or 0
        enriched_count = stats.enriched_count or 0
        
        email_hit_rate = (emails_found / total_contacts * 100) if total_contacts > 0 else 0
        phone_hit_rate = (phones_found / total_contacts * 100) if total_contacts > 0 else 0
        success_rate = (enriched_count / total_contacts * 100) if total_contacts > 0 else 0
        
        # Get contacts for the job
        contacts_query = """
            SELECT id, first_name, last_name, company, email, phone, enriched, 
                   enrichment_status, enrichment_provider, enrichment_score, credits_consumed
            FROM contacts 
            WHERE job_id = :job_id
            ORDER BY id
        """
        contacts_result = await session.execute(text(contacts_query), {"job_id": job_id})
        contacts = [dict(row._mapping) for row in contacts_result.fetchall()]
        
        return JSONResponse(content={
            "job": {
                "id": job.id,
                "status": job.status,
                "total": job.total,
                "completed": job.completed,
                "file_name": job.file_name,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "updated_at": job.updated_at.isoformat() if job.updated_at else None
            },
            "statistics": {
                "total_contacts": total_contacts,
                "emails_found": emails_found,
                "phones_found": phones_found,
                "enriched_count": enriched_count,
                "email_hit_rate": round(email_hit_rate, 1),
                "phone_hit_rate": round(phone_hit_rate, 1),
                "success_rate": round(success_rate, 1),
                "avg_confidence": round(float(stats.avg_confidence or 0), 2),
                "total_credits_used": stats.total_credits_used or 0
            },
            "contacts": contacts
        })
        
    except Exception as e:
        print(f"Error fetching job analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/dashboard")
async def get_dashboard_analytics(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Get real-time dashboard analytics from the database for the authenticated user"""
    try:
        # Get total contacts and enrichment stats for this user
        # FIXED: Made email/phone counting consistent with other queries
        stats_query = text("""
            SELECT 
                COUNT(*) as total_contacts,
                COUNT(CASE WHEN c.enriched = true THEN 1 END) as enriched_count,
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' AND c.email != 'null' THEN 1 END) as emails_found,
                COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' AND c.phone != 'null' THEN 1 END) as phones_found,
                AVG(c.enrichment_score) as avg_confidence,
                SUM(c.credits_consumed) as credits_used_total,
                COUNT(DISTINCT c.job_id) as total_jobs
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE ij.user_id = :user_id
        """)
        
        result = await session.execute(stats_query, {"user_id": user_id})
        stats = result.first()
        
        total_contacts = stats.total_contacts if stats else 0
        enriched_count = stats.enriched_count if stats else 0
        emails_found = stats.emails_found if stats else 0
        phones_found = stats.phones_found if stats else 0
        avg_confidence = float(stats.avg_confidence) if stats and stats.avg_confidence else 0
        credits_used_total = float(stats.credits_used_total) if stats and stats.credits_used_total else 0
        
        # Calculate rates based on TOTAL CONTACTS (as requested)
        email_hit_rate = (emails_found / total_contacts * 100) if total_contacts > 0 else 0
        phone_hit_rate = (phones_found / total_contacts * 100) if total_contacts > 0 else 0
        success_rate = (enriched_count / total_contacts * 100) if total_contacts > 0 else 0
        
        # Enhanced debug logging to track down discrepancies
        print(f"📊 DASHBOARD ANALYTICS DEBUG for user {user_id}:")
        print(f"   - Total contacts: {total_contacts}")
        print(f"   - Enriched contacts: {enriched_count}")
        print(f"   - Emails found: {emails_found}")
        print(f"   - Phones found: {phones_found}")
        print(f"   - Credits used total: {credits_used_total}")
        print(f"   - Email hit rate: {email_hit_rate:.1f}%")
        print(f"   - Phone hit rate: {phone_hit_rate:.1f}%")
        
        # Additional debug query to check for data inconsistencies
        debug_query = text("""
            SELECT 
                ij.id as job_id,
                ij.status,
                COUNT(c.id) as contacts_in_job,
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as emails_in_job,
                SUM(c.credits_consumed) as credits_in_job
            FROM import_jobs ij
            LEFT JOIN contacts c ON ij.id = c.job_id
            WHERE ij.user_id = :user_id
            GROUP BY ij.id, ij.status
            ORDER BY ij.created_at DESC
            LIMIT 3
        """)
        
        debug_result = await session.execute(debug_query, {"user_id": user_id})
        print(f"   📋 Recent jobs breakdown:")
        for job in debug_result.fetchall():
            print(f"      Job {job[0]}: {job[2]} contacts, {job[3]} emails, {job[4]} credits")
        print(f"   =" * 50)
        
        # Get recent jobs (both active and completed)
        recent_jobs_query = text("""
            SELECT 
                ij.id, ij.status, ij.total, ij.completed, ij.file_name,
                ij.created_at, ij.updated_at,
                COUNT(c.id) as actual_completed,
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as emails_found,
                COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN 1 END) as phones_found,
                SUM(c.credits_consumed) as credits_used
            FROM import_jobs ij
            LEFT JOIN contacts c ON ij.id = c.job_id
            WHERE ij.user_id = :user_id
            GROUP BY ij.id, ij.status, ij.total, ij.completed, ij.file_name, ij.created_at, ij.updated_at
            ORDER BY ij.created_at DESC
            LIMIT 10
        """)
        
        recent_jobs_result = await session.execute(recent_jobs_query, {"user_id": user_id})
        recent_jobs = []
        active_jobs = []
        
        for job in recent_jobs_result:
            actual_completed = job.actual_completed or 0
            job_total = job.total or 1
            progress = (actual_completed / job_total * 100) if job_total > 0 else 0
            
            # Update job status based on actual progress
            if progress >= 100 and job.status == 'processing':
                status = 'completed'
            else:
                status = job.status
            
            job_data = {
                "job_id": job.id,
                "status": status,
                "total": job_total,
                "completed": actual_completed,
                "progress": round(progress, 1),
                "emails_found": job.emails_found or 0,
                "phones_found": job.phones_found or 0,
                "credits_used": int(job.credits_used or 0),
                "success_rate": ((job.emails_found or 0) / actual_completed * 100) if actual_completed > 0 else 0,
                "file_name": job.file_name,
                "created_at": job.created_at.isoformat() if job.created_at else None
            }
            
            recent_jobs.append(job_data)
            
            # Add to active jobs if still processing
            if status == 'processing' and progress < 100:
                active_jobs.append(job_data)
        
        # Get the most recent job as current batch
        current_batch = None
        if recent_jobs:
            current_batch = recent_jobs[0]  # Most recent job
        
        # Get provider performance (real data from database)
        provider_query = text("""
            SELECT 
                c.enrichment_provider,
                COUNT(*) as total_requests,
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as emails_found,
                COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN 1 END) as phones_found,
                AVG(c.enrichment_score) as avg_confidence,
                AVG(c.credits_consumed) as avg_cost,
                MAX(c.created_at) as last_used
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE ij.user_id = :user_id 
            AND c.enrichment_provider IS NOT NULL
            AND c.created_at >= NOW() - INTERVAL '7 days'  -- Last 7 days
            GROUP BY c.enrichment_provider
            ORDER BY total_requests DESC
        """)
        
        provider_result = await session.execute(provider_query, {"user_id": user_id})
        
        provider_performance = []
        for row in provider_result.fetchall():
            provider_name = row[0]
            total_requests = row[1] or 0
            emails_found = row[2] or 0
            phones_found = row[3] or 0
            avg_confidence = float(row[4] or 0)
            avg_cost = float(row[5] or 0)
            last_used = row[6]
            
            # Calculate success rate (emails OR phones found)
            success_rate = ((emails_found + phones_found) / total_requests * 100) if total_requests > 0 else 0
            
            # Determine status based on recent activity and success
            if total_requests > 0 and success_rate > 50:
                status = "active"
            elif total_requests > 0 and success_rate > 0:
                status = "low_performance"
            elif total_requests > 0:
                status = "error"
            else:
                status = "inactive"
            
            provider_performance.append({
                "provider": provider_name,
                "success_rate": round(success_rate, 1),
                "avg_confidence": round(avg_confidence, 1),
                "total_requests": total_requests,
                "emails_found": emails_found,
                "phones_found": phones_found,
                "avg_cost": round(avg_cost, 3),
                "status": status,
                "last_used": last_used.isoformat() if last_used else None
            })
        
        # If no provider data, show the configured 10-provider cascade
        if not provider_performance:
            provider_performance = [
                {"provider": "enrow", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.008},
                {"provider": "icypeas", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.009},
                {"provider": "apollo", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.012},
                {"provider": "datagma", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.012},
                {"provider": "anymailfinder", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.015},
                {"provider": "snov", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.02},
                {"provider": "findymail", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.025},
                {"provider": "dropcontact", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.034},
                {"provider": "hunter", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.036},
                {"provider": "kaspr", "success_rate": 0, "avg_confidence": 0, "total_requests": 0, "status": "inactive", "avg_cost": 0.071}
            ]
        
        # Calculate credits used today
        today_credits_query = text("""
            SELECT SUM(c.credits_consumed) as credits_today
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE ij.user_id = :user_id 
            AND DATE(c.created_at) = CURRENT_DATE
        """)
        
        today_result = await session.execute(today_credits_query, {"user_id": user_id})
        today_data = today_result.first()
        credits_used_today = int(today_data.credits_today) if today_data and today_data.credits_today else 0
        
        # Processing stages for UI
        processing_stages = []
        if current_batch:
            progress = current_batch['progress']
            if progress < 25:
                processing_stages = [
                    {"name": "Upload & Parse", "status": "completed", "duration": "2s"},
                    {"name": "Data Validation", "status": "in_progress", "duration": ""},
                    {"name": "Enrichment", "status": "pending", "duration": ""},
                    {"name": "Export Ready", "status": "pending", "duration": ""}
                ]
            elif progress < 75:
                processing_stages = [
                    {"name": "Upload & Parse", "status": "completed", "duration": "2s"},
                    {"name": "Data Validation", "status": "completed", "duration": "1s"},
                    {"name": "Enrichment", "status": "in_progress", "duration": ""},
                    {"name": "Export Ready", "status": "pending", "duration": ""}
                ]
            elif progress < 100:
                processing_stages = [
                    {"name": "Upload & Parse", "status": "completed", "duration": "2s"},
                    {"name": "Data Validation", "status": "completed", "duration": "1s"},
                    {"name": "Enrichment", "status": "in_progress", "duration": f"{int(progress)}%"},
                    {"name": "Export Ready", "status": "pending", "duration": ""}
                ]
            else:
                processing_stages = [
                    {"name": "Upload & Parse", "status": "completed", "duration": "2s"},
                    {"name": "Data Validation", "status": "completed", "duration": "1s"},
                    {"name": "Enrichment", "status": "completed", "duration": "100%"},
                    {"name": "Export Ready", "status": "completed", "duration": "Ready"}
                ]
        
        # 🎯 FIXED: Get current batch stats (not cumulative) - CORRECTED FIELD NAMES
        current_batch_emails = 0
        current_batch_phones = 0
        current_batch_total = 0
        current_batch_email_hit_rate = 0
        
        if current_batch:
            current_batch_emails = current_batch.get('emails_found', 0)
            current_batch_phones = current_batch.get('phones_found', 0)
            current_batch_total = current_batch.get('total', 0)  # 🔧 FIXED: Field is called 'total', not 'total_contacts'
            if current_batch_total > 0:
                current_batch_email_hit_rate = (current_batch_emails / current_batch_total) * 100
        
        # Debug current batch calculation
        print(f"🔧 CURRENT BATCH HIT RATE CALCULATION:")
        print(f"   - Current batch emails: {current_batch_emails}")
        print(f"   - Current batch total: {current_batch_total}")
        print(f"   - Calculated hit rate: {current_batch_email_hit_rate:.1f}%")
        
        response_data = {
            "overview": {
                "total_contacts": total_contacts,
                "emails_found": emails_found,
                "phones_found": phones_found,
                "success_rate": round(success_rate, 1),
                "email_hit_rate": round(email_hit_rate, 1),
                "phone_hit_rate": round(phone_hit_rate, 1),
                "avg_confidence": round(avg_confidence, 1),
                "credits_used_today": credits_used_today,
                "credits_used_month": int(credits_used_total),
                "current_batch_emails": current_batch_emails,
                "current_batch_email_hit_rate": round(current_batch_email_hit_rate, 1)
            },
            "recent_jobs": recent_jobs[:5],  # Last 5 jobs
            "active_jobs": active_jobs,
            "current_batch": current_batch,  # Most recent job for BatchProgress component
            "provider_performance": provider_performance,
            "processing_stages": processing_stages,
            "last_updated": datetime.now().isoformat(),  # Cache busting
            "data_source": "live_database"  # Indicates this is fresh data
        }
        
        print(f"🎯 DASHBOARD RESPONSE: Emails found = {emails_found}")
        return response_data
        
    except Exception as e:
        print(f"Error fetching dashboard analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching analytics: {str(e)}")

@app.get("/api/analytics/enrichment-history")
async def get_enrichment_history(
    limit: int = 50,
    session: AsyncSession = Depends(get_async_session)
):
    """Get recent enrichment history"""
    try:
        history_query = text("""
            SELECT 
                c.id,
                c.first_name || ' ' || COALESCE(c.last_name, '') as contact_name,
                c.email as contact_email,
                CASE 
                    WHEN c.email IS NOT NULL THEN 'email'
                    WHEN c.phone IS NOT NULL THEN 'phone'
                    ELSE 'email'
                END as enrichment_type,
                CASE 
                    WHEN c.enriched = true THEN 'success'
                    ELSE 'failed'
                END as status,
                c.enrichment_provider as source,
                COALESCE(c.email, c.phone) as result_data,
                c.credits_consumed as credits_used,
                c.created_at
            FROM contacts c
            WHERE c.enriched = true
            ORDER BY c.created_at DESC
            LIMIT :limit
        """)
        
        result = await session.execute(history_query, {"limit": limit})
        history_rows = result.fetchall()
        
        enrichments = []
        for row in history_rows:
            enrichments.append({
                "id": str(row[0]),
                "contact_name": row[1],
                "contact_email": row[2],
                "enrichment_type": row[3],
                "status": row[4],
                "source": row[5] or "internal",
                "result_data": row[6],
                "credits_used": row[7] or 0,
                "created_at": row[8].isoformat() if row[8] else None
            })
        
        return {"enrichments": enrichments}
        
    except Exception as e:
        print(f"Error fetching enrichment history: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching history: {str(e)}")

@app.get("/api/analytics/workers")
async def get_worker_status():
    """Get Celery worker status from Redis/Flower"""
    try:
        # Mock worker data for now - in production, this would connect to Flower API
        workers = [
            {
                "hostname": "enrichment-worker-1",
                "status": "active",
                "tasks": 15,
                "load": 0.65,
                "uptime": "2h 30m"
            },
            {
                "hostname": "enrichment-worker-2", 
                "status": "active",
                "tasks": 12,
                "load": 0.45,
                "uptime": "2h 30m"
            }
        ]
        
        return {"workers": workers}
        
    except Exception as e:
        print(f"Error fetching worker status: {e}")
        return {"workers": []}

@app.get("/api/analytics/credits/{user_id}")
async def get_credit_analytics(
    user_id: str,
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_api_token)
):
    """Get credit usage analytics"""
    
    # Calculate date range
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map[period]
    start_date = datetime.now() - timedelta(days=days)
    
    # Credit usage over time
    usage_query = """
        SELECT 
            DATE(created_at) as date,
            SUM(CASE WHEN cost > 0 THEN cost ELSE 0 END) as spent,
            SUM(CASE WHEN cost < 0 THEN -cost ELSE 0 END) as added,
            COUNT(CASE WHEN cost > 0 THEN 1 END) as operations
        FROM credit_logs
        WHERE user_id = :user_id AND created_at >= :start_date
        GROUP BY DATE(created_at)
        ORDER BY date
    """
    
    result = await session.execute(text(usage_query), {
        "user_id": user_id,
        "start_date": start_date
    })
    
    usage_timeline = [
        {
            "date": row[0].isoformat(),
            "spent": float(row[1] or 0),
            "added": float(row[2] or 0),
            "net": float(row[2] or 0) - float(row[1] or 0),
            "operations": row[3] or 0
        }
        for row in result.fetchall()
    ]
    
    # Provider cost breakdown
    provider_costs_query = """
        SELECT 
            provider,
            SUM(cost) as total_cost,
            COUNT(*) as operations,
            AVG(cost) as avg_cost_per_operation
        FROM credit_logs
        WHERE user_id = :user_id AND created_at >= :start_date AND cost > 0
        GROUP BY provider
        ORDER BY total_cost DESC
    """
    
    provider_result = await session.execute(text(provider_costs_query), {
        "user_id": user_id,
        "start_date": start_date
    })
    
    provider_costs = [
        {
            "provider": row[0],
            "total_cost": float(row[1]),
            "operations": row[2],
            "avg_cost": round(float(row[3]), 3)
        }
        for row in provider_result.fetchall()
    ]
    
    return {
        "period": period,
        "usage_timeline": usage_timeline,
        "provider_costs": provider_costs,
        "summary": {
            "total_spent": sum(day["spent"] for day in usage_timeline),
            "total_operations": sum(day["operations"] for day in usage_timeline),
            "avg_daily_spend": sum(day["spent"] for day in usage_timeline) / len(usage_timeline) if usage_timeline else 0
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "analytics-service"}

@app.get("/api/health")
async def api_health_check():
    """API health check endpoint (nginx compatibility)"""
    return {"status": "ok", "service": "analytics-service"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 
 
