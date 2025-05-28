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
from sqlalchemy import text
from datetime import datetime, timedelta, date
from jose import jwt, JWTError

from common.config import get_settings
from common.db import get_session, async_engine
from app.models import Base

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

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return user ID"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Pydantic models
class DateRange(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None

@app.get("/api/analytics/dashboard/{user_id}")
async def get_user_dashboard(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    auth_user: str = Depends(verify_jwt)
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
            COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found,
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
            COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
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
            COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
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
    session: AsyncSession = Depends(get_session),
    auth_user: str = Depends(verify_jwt)
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
            COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found,
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
async def get_job_analytics(
    job_id: str,
    session: AsyncSession = Depends(get_session),
    auth_user: str = Depends(verify_jwt)
):
    """Get detailed analytics for a specific job"""
    
    # Job overview
    job_query = """
        SELECT ij.*, 
               COUNT(c.id) as total_processed,
               COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
               COUNT(CASE WHEN c.phone IS NOT NULL THEN 1 END) as phones_found,
               AVG(c.enrichment_score) as avg_confidence,
               SUM(c.credits_consumed) as total_credits
        FROM import_jobs ij
        LEFT JOIN contacts c ON ij.id = c.job_id
        WHERE ij.id = :job_id
        GROUP BY ij.id
    """
    
    result = await session.execute(text(job_query), {"job_id": job_id})
    job_data = result.first()
    
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Provider breakdown for this job
    provider_query = """
        SELECT 
            enrichment_provider,
            COUNT(*) as contacts,
            COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found,
            AVG(enrichment_score) as avg_confidence,
            AVG(email_verification_score) as avg_email_score
        FROM contacts
        WHERE job_id = :job_id AND enrichment_provider IS NOT NULL
        GROUP BY enrichment_provider
    """
    
    provider_result = await session.execute(text(provider_query), {"job_id": job_id})
    providers = [
        {
            "provider": row[0],
            "contacts": row[1],
            "emails_found": row[2],
            "success_rate": (row[2] / row[1] * 100) if row[1] > 0 else 0,
            "avg_confidence": round(float(row[3] or 0), 2),
            "avg_email_score": round(float(row[4] or 0), 2)
        }
        for row in provider_result.fetchall()
    ]
    
    # Enrichment timeline
    timeline_query = """
        SELECT 
            DATE_TRUNC('hour', created_at) as hour,
            COUNT(*) as contacts_processed,
            COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as emails_found
        FROM contacts
        WHERE job_id = :job_id
        GROUP BY hour
        ORDER BY hour
    """
    
    timeline_result = await session.execute(text(timeline_query), {"job_id": job_id})
    timeline = [
        {
            "timestamp": row[0].isoformat(),
            "contacts_processed": row[1],
            "emails_found": row[2]
        }
        for row in timeline_result.fetchall()
    ]
    
    return {
        "job_info": {
            "id": job_data[0],
            "user_id": job_data[1],
            "status": job_data[2],
            "total": job_data[3],
            "completed": job_data[4],
            "created_at": job_data[5],
            "updated_at": job_data[6]
        },
        "results": {
            "total_processed": job_data[7] or 0,
            "emails_found": job_data[8] or 0,
            "phones_found": job_data[9] or 0,
            "success_rate": ((job_data[8] or 0) / (job_data[7] or 1) * 100),
            "avg_confidence": round(float(job_data[10] or 0), 2),
            "total_credits": float(job_data[11] or 0)
        },
        "provider_breakdown": providers,
        "timeline": timeline
    }

@app.get("/api/analytics/credits/{user_id}")
async def get_credit_analytics(
    user_id: str,
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    session: AsyncSession = Depends(get_session),
    auth_user: str = Depends(verify_jwt)
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 