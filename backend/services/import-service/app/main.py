# services/import-service/app/main.py

from fastapi import (
    FastAPI, Request,
    UploadFile, File,
    Depends, HTTPException, status,
    Form
)
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy import insert, select, text
import pandas as pd
import uuid, io, boto3, httpx
from sqlalchemy.ext.asyncio import AsyncSession

from common.config import get_settings
from common.db import get_session, async_engine
from common.celery_app import celery_app
from common.auth import verify_api_token
from .models import ImportJob, Contact, Base
from .routers import jobs, salesnav, enrichment

# ─── App & Config ───────────────────────────────────────────────────────────────

settings = get_settings()
app = FastAPI(
    title="Captely Import Service",
    description="Upload CSV/Excel or push JSON batches of leads for enrichment",
    version="1.0.0",
)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://localhost:8001",
    "http://localhost:8002",
    "http://localhost:8003",
    "chrome-extension://*"  # Allow Chrome extensions
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,           # allow cookies/auth headers
    allow_methods=["*"],              # GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],              # allow any request headers
)

# mount static files (e.g. your extension UI under /static)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Include routers
app.include_router(jobs.router)
app.include_router(salesnav.router)
app.include_router(enrichment.router)

# HTTP-Bearer for JWT
security = HTTPBearer()

# Startup event removed to fix async engine issues
# Tables will be created by the enrichment worker or manually

# prepare S3 client if AWS credentials are available
s3 = None
try:
    if hasattr(settings, 'aws_access_key_id') and settings.aws_access_key_id:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_default_region,
        )
except Exception as e:
    print(f"Warning: AWS S3 client initialization failed: {e}")

# ─── Web UI ─────────────────────────────────────────────────────────────────────

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
async def do_login(
    username: str = Form(...),
    password: str = Form(...),
):
    # call your auth-service
    resp = httpx.post(
        "http://auth-service:8000/api/auth/token/",
        data={"username": username, "password": password},
        timeout=5.0,
    )
    if resp.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad credentials")
    token = resp.json()["access"]
    r = RedirectResponse(url="/dashboard", status_code=302)
    r.set_cookie("Authorization", f"Bearer {token}", httponly=True)
    return r

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    user_id: str = Depends(verify_api_token),
):
    # fetch job list
    api_token = request.cookies.get("Authorization")
    resp = httpx.get(
        "http://import-service:8000/api/jobs",
        headers={"Authorization": api_token},
        timeout=5.0,
    )
    jobs = resp.json()
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "jobs": jobs},
    )

# ─── API Endpoints ──────────────────────────────────────────────────────────────

# 1) file upload CSV/XLSX
@app.post(
    "/api/imports/file",
    status_code=status.HTTP_201_CREATED,
)
async def import_file(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_api_token),
    session=Depends(get_session),
):
    data = await file.read()
    if file.filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(data))
    else:
        df = pd.read_excel(io.BytesIO(data))

    # Normalize column names: convert to lowercase and replace spaces with underscores
    df.columns = df.columns.str.lower().str.replace(' ', '_')
    
    # Check for required columns
    missing = [c for c in ("first_name", "company") if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing columns: {', '.join(missing)}. Found columns: {', '.join(df.columns.tolist())}"
        )

    job_id = str(uuid.uuid4())
    session.execute(
        insert(ImportJob).values(id=job_id, user_id=user_id, total=df.shape[0])
    )
    session.commit()

    for _, row in df.iterrows():
        # Convert row to dict and normalize field names
        lead_data = row.to_dict()
        
        # Clean NaN values - replace with empty strings
        for key, value in lead_data.items():
            if pd.isna(value):
                lead_data[key] = ""
        
        # Log what we're sending to enrichment
        print(f"📤 Sending to enrichment: {lead_data.get('first_name', '')} {lead_data.get('last_name', '')} at {lead_data.get('company', '')}")
        
        # Send to the cascade enrichment task
        celery_app.send_task(
            "app.tasks.cascade_enrich",
            args=[lead_data, job_id, user_id],
            queue="cascade_enrichment"
        )

    # Upload to S3 if available
    if s3 and hasattr(settings, 's3_bucket_raw'):
        key = f"{user_id}/{job_id}/{file.filename}"
        s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)

    return JSONResponse({"job_id": job_id})

# 2) JSON batch endpoint (from extension or other clients)
class LeadsBatch(BaseModel):
    leads: list[dict]

@app.post(
    "/api/imports/leads",
    status_code=status.HTTP_201_CREATED,
)
async def import_leads(
    batch: LeadsBatch,
    user_id: str = Depends(verify_api_token),
    session=Depends(get_session),
):
    job_id = str(uuid.uuid4())
    total = len(batch.leads)

    session.execute(
        insert(ImportJob).values(id=job_id, user_id=user_id, total=total)
    )
    session.commit()

    for lead in batch.leads:
        print(f"📤 Sending batch lead to enrichment: {lead.get('first_name', '')} {lead.get('last_name', '')} at {lead.get('company', '')}")
        celery_app.send_task(
            "app.tasks.cascade_enrich",
            args=[lead, job_id, user_id],
            queue="cascade_enrichment"
        )

    return {"job_id": job_id}

# 3) /api/scraper/leads — used by your Chrome extension
class LeadIn(BaseModel):
    first_name: str
    last_name:   str | None
    position:    str | None
    company:     str
    profile_url: str | None
    location:    str | None
    industry:    str | None

@app.post(
    "/api/scraper/leads",
    status_code=status.HTTP_201_CREATED,
)
async def scraper_leads(
    leads: list[LeadIn],
    user_id: str = Depends(verify_api_token),
    session=Depends(get_session),
):
    job_id = str(uuid.uuid4())
    session.execute(
        insert(ImportJob).values(id=job_id, user_id=user_id, total=len(leads))
    )
    session.commit()

    for lead in leads:
        lead_dict = lead.dict()
        print(f"📤 Sending scraper lead to enrichment: {lead_dict.get('first_name', '')} {lead_dict.get('last_name', '')} at {lead_dict.get('company', '')}")
        celery_app.send_task(
            "app.tasks.cascade_enrich",
            args=[lead_dict, job_id, user_id],
            queue="cascade_enrichment"
        )

    return {"job_id": job_id}

# 4) list all jobs for this user
@app.get(
    "/api/jobs",
)
async def list_jobs(
    user_id: str = Depends(verify_api_token),
    session=Depends(get_session),
):
    q = session.execute(select(ImportJob).where(ImportJob.user_id == user_id))
    jobs = q.scalars().all()
    return [
        {
            "id":        j.id,
            "total":     j.total,
            "completed": j.completed,
            "status":    j.status,
        }
        for j in jobs
    ]

@app.get("/api/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    session: AsyncSession = Depends(get_session)
):
    """Get detailed status of an import job"""
    try:
        # Get job details
        job_query = text("""
            SELECT ij.*, 
                   COUNT(c.id) as total_processed,
                   COUNT(CASE WHEN c.enriched = true THEN 1 END) as enriched_count,
                   COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
                   COUNT(CASE WHEN c.phone IS NOT NULL THEN 1 END) as phones_found,
                   SUM(c.credits_consumed) as total_credits_used,
                   AVG(c.enrichment_score) as avg_confidence
            FROM import_jobs ij
            LEFT JOIN contacts c ON ij.id = c.job_id
            WHERE ij.id = :job_id
            GROUP BY ij.id
        """)
        
        result = await session.execute(job_query, {"job_id": job_id})
        job_data = await result.first()
        
        if not job_data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Calculate progress and success rate
        total_processed = job_data.total_processed or 0
        enriched_count = job_data.enriched_count or 0
        emails_found = job_data.emails_found or 0
        phones_found = job_data.phones_found or 0
        total_credits_used = job_data.total_credits_used or 0
        
        progress = (total_processed / job_data.total * 100) if job_data.total > 0 else 0
        success_rate = (enriched_count / total_processed * 100) if total_processed > 0 else 0
        email_hit_rate = (emails_found / total_processed * 100) if total_processed > 0 else 0
        phone_hit_rate = (phones_found / total_processed * 100) if total_processed > 0 else 0
        
        return {
            "id": job_data.id,
            "user_id": job_data.user_id,
            "status": job_data.status,
            "file_name": job_data.file_name,
            "total": job_data.total,
            "completed": total_processed,
            "progress": round(progress, 1),
            "success_rate": round(success_rate, 1),
            "email_hit_rate": round(email_hit_rate, 1),
            "phone_hit_rate": round(phone_hit_rate, 1),
            "emails_found": emails_found,
            "phones_found": phones_found,
            "credits_used": total_credits_used,
            "avg_confidence": round(float(job_data.avg_confidence or 0), 2),
            "created_at": job_data.created_at.isoformat() if job_data.created_at else None,
            "updated_at": job_data.updated_at.isoformat() if job_data.updated_at else None
        }
        
    except Exception as e:
        print(f"Error fetching job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jobs")
async def get_user_jobs(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Get all jobs for a user with their current status"""
    try:
        jobs_query = text("""
            SELECT ij.*, 
                   COUNT(c.id) as total_processed,
                   COUNT(CASE WHEN c.enriched = true THEN 1 END) as enriched_count,
                   SUM(c.credits_consumed) as total_credits_used
            FROM import_jobs ij
            LEFT JOIN contacts c ON ij.id = c.job_id
            WHERE ij.user_id = :user_id
            GROUP BY ij.id
            ORDER BY ij.created_at DESC
        """)
        
        result = await session.execute(jobs_query, {"user_id": user_id})
        jobs_data = await result.fetchall()
        
        jobs = []
        for job in jobs_data:
            total_processed = job.total_processed or 0
            enriched_count = job.enriched_count or 0
            total_credits_used = job.total_credits_used or 0
            
            progress = (total_processed / job.total * 100) if job.total > 0 else 0
            success_rate = (enriched_count / total_processed * 100) if total_processed > 0 else 0
            
            jobs.append({
                "id": job.id,
                "status": job.status,
                "file_name": job.file_name,
                "total": job.total,
                "completed": total_processed,
                "progress": round(progress, 1),
                "success_rate": round(success_rate, 1),
                "credits_used": total_credits_used,
                "created_at": job.created_at.isoformat() if job.created_at else None
            })
        
        return {"jobs": jobs}
        
    except Exception as e:
        print(f"Error fetching user jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/credits")
async def get_user_credits(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Get detailed credit information for the authenticated user"""
    try:
        # Get user's current credit balance
        user_query = text("SELECT credits, current_subscription_id FROM users WHERE id = :user_id")
        user_result = await session.execute(user_query, {"user_id": user_id})
        user_row = await user_result.fetchone()
        
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        
        current_credits = user_row[0]
        subscription_id = user_row[1]
        
        # Get subscription details if available
        subscription_data = None
        if subscription_id:
            sub_query = text("""
                SELECT p.credits_monthly, p.display_name, p.price_monthly 
                FROM packages p 
                JOIN user_subscriptions us ON p.id = us.package_id 
                WHERE us.user_id = :user_id AND us.status = 'active'
                ORDER BY us.created_at DESC 
                LIMIT 1
            """)
            sub_result = await session.execute(sub_query, {"user_id": user_id})
            sub_row = await sub_result.fetchone()
            
            if sub_row:
                subscription_data = {
                    "monthly_limit": sub_row[0],
                    "package_name": sub_row[1],
                    "monthly_price": sub_row[2]
                }
        
        # Get usage statistics for current month
        usage_query = text("""
            SELECT 
                SUM(CASE WHEN cl.operation_type = 'enrichment' THEN ABS(cl.change) ELSE 0 END) as used_this_month,
                COUNT(CASE WHEN cl.operation_type = 'enrichment' AND cl.created_at > CURRENT_DATE THEN 1 END) as used_today
            FROM credit_logs cl
            WHERE cl.user_id = :user_id 
            AND cl.created_at >= DATE_TRUNC('month', CURRENT_DATE)
        """)
        usage_result = await session.execute(usage_query, {"user_id": user_id})
        usage_row = await usage_result.fetchone()
        
        used_this_month = usage_row[0] if usage_row[0] else 0
        used_today = usage_row[1] if usage_row[1] else 0
        
        # Get enrichment statistics
        stats_query = text("""
            SELECT 
                COUNT(c.id) as total_enriched,
                COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) as emails_found,
                COUNT(CASE WHEN c.phone IS NOT NULL THEN 1 END) as phones_found,
                AVG(c.enrichment_score) as avg_confidence,
                SUM(c.credits_consumed) as total_credits_used
            FROM contacts c
            WHERE c.user_id = :user_id AND c.enriched = true
        """)
        stats_result = await session.execute(stats_query, {"user_id": user_id})
        stats_row = await stats_result.fetchone()
        
        total_enriched = stats_row[0] if stats_row[0] else 0
        emails_found = stats_row[1] if stats_row[1] else 0
        phones_found = stats_row[2] if stats_row[2] else 0
        avg_confidence = float(stats_row[3]) if stats_row[3] else 0.0
        total_credits_used = stats_row[4] if stats_row[4] else 0
        
        # Calculate success rates
        email_hit_rate = (emails_found / total_enriched * 100) if total_enriched > 0 else 0
        phone_hit_rate = (phones_found / total_enriched * 100) if total_enriched > 0 else 0
        
        return {
            "balance": current_credits,
            "used_today": used_today,
            "used_this_month": used_this_month,
            "limit_daily": None,  # Can be implemented later
            "limit_monthly": subscription_data["monthly_limit"] if subscription_data else 5000,
            "subscription": subscription_data,
            "statistics": {
                "total_enriched": total_enriched,
                "email_hit_rate": round(email_hit_rate, 1),
                "phone_hit_rate": round(phone_hit_rate, 1),
                "avg_confidence": round(avg_confidence, 2),
                "total_credits_used": total_credits_used,
                "success_rate": round((email_hit_rate + phone_hit_rate) / 2, 1) if total_enriched > 0 else 0
            }
        }
        
    except Exception as e:
        print(f"Error fetching user credits: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching credits: {str(e)}")

@app.post("/api/credits/deduct")
async def deduct_credits(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Deduct credits from user balance for enrichment operations"""
    try:
        credits_to_deduct = request.get("credits", 0)
        operation_type = request.get("operation_type", "enrichment")
        reason = request.get("reason", "Enrichment operation")
        
        if credits_to_deduct <= 0:
            raise HTTPException(status_code=400, detail="Credits to deduct must be positive")
        
        # Check user's current balance
        balance_query = text("SELECT credits FROM users WHERE id = :user_id")
        balance_result = await session.execute(balance_query, {"user_id": user_id})
        current_balance = await balance_result.scalar()
        
        if current_balance is None:
            raise HTTPException(status_code=404, detail="User not found")
        
        if current_balance < credits_to_deduct:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. Balance: {current_balance}, Required: {credits_to_deduct}"
            )
        
        # Deduct credits
        update_query = text("UPDATE users SET credits = credits - :credits WHERE id = :user_id")
        await session.execute(update_query, {"credits": credits_to_deduct, "user_id": user_id})
        
        # Log the transaction
        log_query = text("""
            INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at)
            VALUES (:user_id, :operation_type, :cost, :change, :reason, CURRENT_TIMESTAMP)
        """)
        await session.execute(log_query, {
            "user_id": user_id,
            "operation_type": operation_type,
            "cost": credits_to_deduct,
            "change": -credits_to_deduct,
            "reason": reason
        })
        
        await session.commit()
        
        new_balance = current_balance - credits_to_deduct
        print(f"Deducted {credits_to_deduct} credits from user {user_id}. New balance: {new_balance}")
        
        return {
            "success": True,
            "credits_deducted": credits_to_deduct,
            "new_balance": new_balance,
            "reason": reason
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deducting credits: {e}")
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Error deducting credits: {str(e)}")

@app.post("/api/credits/refund")
async def refund_credits(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Refund credits to user balance (e.g., if enrichment fails)"""
    try:
        credits_to_refund = request.get("credits", 0)
        reason = request.get("reason", "Enrichment refund")
        
        if credits_to_refund <= 0:
            raise HTTPException(status_code=400, detail="Credits to refund must be positive")
        
        # Add credits back
        update_query = text("UPDATE users SET credits = credits + :credits WHERE id = :user_id")
        await session.execute(update_query, {"credits": credits_to_refund, "user_id": user_id})
        
        # Log the transaction
        log_query = text("""
            INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at)
            VALUES (:user_id, :operation_type, :cost, :change, :reason, CURRENT_TIMESTAMP)
        """)
        await session.execute(log_query, {
            "user_id": user_id,
            "operation_type": "refund",
            "cost": 0,
            "change": credits_to_refund,
            "reason": reason
        })
        
        await session.commit()
        
        # Get new balance
        balance_query = text("SELECT credits FROM users WHERE id = :user_id")
        balance_result = await session.execute(balance_query, {"user_id": user_id})
        new_balance = await balance_result.scalar()
        
        print(f"Refunded {credits_to_refund} credits to user {user_id}. New balance: {new_balance}")
        
        return {
            "success": True,
            "credits_refunded": credits_to_refund,
            "new_balance": new_balance,
            "reason": reason
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error refunding credits: {e}")
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Error refunding credits: {str(e)}")
