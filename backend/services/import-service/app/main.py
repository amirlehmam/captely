# services/import-service/app/main.py

from fastapi import (
    FastAPI, Request,
    UploadFile, File,
    Depends, HTTPException, status,
    Form, Query
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
from sqlalchemy.orm import Session

from common.config import get_settings
from common.db import get_session, async_engine
from common.celery_app import celery_app
from common.auth import verify_api_token
from .models import ImportJob, Contact, Base
# from .routers import jobs, salesnav, enrichment

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
    "chrome-extension://*",
    "null"  # For file:// protocol and some dev scenarios
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Specific origins for credentials
    allow_credentials=True,           # allow cookies/auth headers
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],  # Include OPTIONS explicitly
    allow_headers=["*"],              # allow any request headers
    expose_headers=["*"],             # expose response headers
)

# mount static files (e.g. your extension UI under /static)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Include routers
# app.include_router(jobs.router)  # DISABLED - causing async/await issues
# app.include_router(salesnav.router)  # DISABLED - causing async/await issues  
# app.include_router(enrichment.router)  # DISABLED - causing async/await issues

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
    session: Session = Depends(get_session),
):
    try:
        print(f"📁 Processing file upload: {file.filename} for user: {user_id}")
        
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
        
        # Create import job record using text SQL to avoid async issues
        job_insert_sql = text("""
            INSERT INTO import_jobs (id, user_id, total, status, file_name, created_at, updated_at)
            VALUES (:job_id, :user_id, :total, :status, :file_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """)
        
        session.execute(job_insert_sql, {
            "job_id": job_id,
            "user_id": user_id,
            "total": len(df),
            "status": "processing",
            "file_name": file.filename
        })
        session.commit()
        print(f"✅ Created file import job: {job_id} with {len(df)} contacts")

        # Process each row and send to enrichment
        for idx, row in df.iterrows():
            # Convert row to dict and normalize field names
            lead_data = row.to_dict()
            
            # Clean NaN values - replace with empty strings
            for key, value in lead_data.items():
                if pd.isna(value):
                    lead_data[key] = ""
            
            # Send to the cascade enrichment task
            celery_app.send_task(
                "app.tasks.cascade_enrich",
                args=[lead_data, job_id, user_id],
                queue="cascade_enrichment"
            )

        # Upload to S3 if available
        if s3 and hasattr(settings, 's3_bucket_raw'):
            try:
                key = f"{user_id}/{job_id}/{file.filename}"
                s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)
                print(f"📁 Uploaded file to S3: {key}")
            except Exception as e:
                print(f"⚠️ S3 upload failed: {e}")

        print(f"🚀 Successfully queued {len(df)} contacts for enrichment in job: {job_id}")
        return JSONResponse({"job_id": job_id, "total_contacts": len(df)})
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in import_file: {e}")
        try:
            if session is not None:
                session.rollback()
        except Exception as rollback_error:
            print(f"🔍 Rollback error: {rollback_error}")
            pass  # Ignore rollback errors to prevent double exception
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"File processing failed: {str(e)}"
        )

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
    session: Session = Depends(get_session),
):
    try:
        job_id = str(uuid.uuid4())
        total = len(batch.leads)

        # Create import job record using text SQL to avoid async issues
        job_insert_sql = text("""
            INSERT INTO import_jobs (id, user_id, total, status, created_at, updated_at)
            VALUES (:job_id, :user_id, :total, :status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """)
        
        session.execute(job_insert_sql, {
            "job_id": job_id,
            "user_id": user_id,
            "total": total,
            "status": "processing"
        })
        session.commit()
        print(f"✅ Created batch job: {job_id} with {total} leads")

        for lead in batch.leads:
            print(f"📤 Sending batch lead to enrichment: {lead.get('first_name', '')} {lead.get('last_name', '')} at {lead.get('company', '')}")
            celery_app.send_task(
                "app.tasks.cascade_enrich",
                args=[lead, job_id, user_id],
                queue="cascade_enrichment"
            )

        return {"job_id": job_id}
        
    except Exception as e:
        print(f"❌ Error in import_leads: {e}")
        try:
            if session is not None:
                session.rollback()
        except:
            pass  # Ignore rollback errors to prevent double exception
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch processing failed: {str(e)}"
        )

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
    session: Session = Depends(get_session),
):
    try:
        job_id = str(uuid.uuid4())
        
        # Create import job record using text SQL to avoid async issues
        job_insert_sql = text("""
            INSERT INTO import_jobs (id, user_id, total, status, created_at, updated_at)
            VALUES (:job_id, :user_id, :total, :status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """)
        
        session.execute(job_insert_sql, {
            "job_id": job_id,
            "user_id": user_id,
            "total": len(leads),
            "status": "processing"
        })
        session.commit()
        print(f"✅ Created scraper job: {job_id} with {len(leads)} leads")

        for lead in leads:
            lead_dict = lead.dict()
            print(f"📤 Sending scraper lead to enrichment: {lead_dict.get('first_name', '')} {lead_dict.get('last_name', '')} at {lead_dict.get('company', '')}")
            celery_app.send_task(
                "app.tasks.cascade_enrich",
                args=[lead_dict, job_id, user_id],
                queue="cascade_enrichment"
            )

        return {"job_id": job_id}
        
    except Exception as e:
        print(f"❌ Error in scraper_leads: {e}")
        try:
            if session is not None:
                session.rollback()
        except:
            pass  # Ignore rollback errors to prevent double exception
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scraper processing failed: {str(e)}"
        )

# 4) Get all jobs for this user with comprehensive statistics
@app.get(
    "/api/jobs",
)
async def get_user_jobs(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get all jobs for a user with their current status and statistics"""
    try:
        print(f"📋 Fetching jobs for user: {user_id}")
        
        jobs_query = text("""
            SELECT ij.*, 
                   COUNT(c.id) as total_processed,
                   COUNT(CASE WHEN c.enriched = true THEN 1 END) as enriched_count,
                   COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as emails_found,
                   COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN 1 END) as phones_found,
                   SUM(c.credits_consumed) as total_credits_used
            FROM import_jobs ij
            LEFT JOIN contacts c ON ij.id = c.job_id
            WHERE ij.user_id = :user_id
            GROUP BY ij.id, ij.user_id, ij.total, ij.completed, ij.status, ij.file_name, ij.created_at, ij.updated_at
            ORDER BY ij.created_at DESC
        """)
        
        result = session.execute(jobs_query, {"user_id": user_id})
        jobs_data = result.fetchall()
        
        jobs = []
        for job in jobs_data:
            total_processed = job.total_processed or 0
            enriched_count = job.enriched_count or 0
            emails_found = job.emails_found or 0
            phones_found = job.phones_found or 0
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
                "emails_found": emails_found,
                "phones_found": phones_found,
                "credits_used": total_credits_used,
                "created_at": job.created_at.isoformat() if job.created_at else None
            })
        
        print(f"📋 Found {len(jobs)} jobs for user {user_id}")
        return {"jobs": jobs}
        
    except Exception as e:
        print(f"❌ Error fetching user jobs: {e}")
        return {"jobs": []}

@app.get("/api/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    session: Session = Depends(get_session)
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
        
        result = session.execute(job_query, {"job_id": job_id})
        job_data = result.first()
        
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

@app.get("/api/jobs/{job_id}/contacts")
async def get_job_contacts(
    job_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session)
):
    """Get contacts for a specific job with pagination"""
    try:
        # Check if job exists
        job_query = text("SELECT id FROM import_jobs WHERE id = :job_id")
        job_result = session.execute(job_query, {"job_id": job_id})
        if not job_result.first():
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get total count
        count_query = text("SELECT COUNT(*) FROM contacts WHERE job_id = :job_id")
        count_result = session.execute(count_query, {"job_id": job_id})
        total = count_result.scalar() or 0
        
        # Calculate pagination
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit
        
        # Get contacts
        contacts_query = text("""
            SELECT 
                id, job_id, first_name, last_name, email, phone, company, position,
                location, industry, profile_url, enriched, enrichment_status,
                enrichment_provider, enrichment_score, email_verified, phone_verified,
                credits_consumed, created_at, updated_at
            FROM contacts 
            WHERE job_id = :job_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        contacts_result = session.execute(contacts_query, {
            "job_id": job_id,
            "limit": limit,
            "offset": offset
        })
        
        contacts = []
        for row in contacts_result.fetchall():
            contacts.append({
                "id": str(row[0]),
                "job_id": str(row[1]),
                "first_name": row[2],
                "last_name": row[3],
                "email": row[4],
                "phone": row[5],
                "company": row[6],
                "position": row[7],
                "location": row[8],
                "industry": row[9],
                "profile_url": row[10],
                "enriched": row[11],
                "enrichment_status": row[12],
                "enrichment_provider": row[13],
                "enrichment_score": float(row[14]) if row[14] else None,
                "email_verified": row[15],
                "phone_verified": row[16],
                "credits_consumed": float(row[17]) if row[17] else 0,
                "created_at": row[18].isoformat() if row[18] else None,
                "updated_at": row[19].isoformat() if row[19] else None
            })
        
        return {
            "contacts": contacts,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching job contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/credits")
async def get_user_credits(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get detailed credit information for the authenticated user - REAL DATABASE DATA"""
    try:
        print(f"💳 Fetching real credits for user: {user_id}")
        
        # Get user's current credits from database
        user_credits_query = text("SELECT credits FROM users WHERE id = :user_id")
        user_result = session.execute(user_credits_query, {"user_id": user_id})
        user_data = user_result.first()
        
        if not user_data:
            # User doesn't exist - this shouldn't happen as they should be created during auth
            print(f"❌ User {user_id} not found in database")
            raise HTTPException(status_code=404, detail="User not found. Please ensure you are properly authenticated.")
        else:
            current_credits = user_data.credits or 5000

        # Get usage statistics
        stats_query = text("""
            SELECT 
                COUNT(*) as total_processed,
                COUNT(CASE WHEN enriched = true THEN 1 END) as total_enriched,
                SUM(credits_consumed) as total_credits_used,
                AVG(CASE WHEN enrichment_score > 0 THEN enrichment_score END) as avg_confidence,
                COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as emails_found,
                COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as phones_found
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE ij.user_id = :user_id
        """)
        
        stats_result = session.execute(stats_query, {"user_id": user_id})
        stats_data = stats_result.first()
        
        total_processed = stats_data.total_processed or 0
        total_enriched = stats_data.total_enriched or 0
        total_credits_used = stats_data.total_credits_used or 0
        avg_confidence = float(stats_data.avg_confidence or 0)
        emails_found = stats_data.emails_found or 0
        phones_found = stats_data.phones_found or 0
        
        # Calculate rates
        email_hit_rate = (emails_found / total_processed * 100) if total_processed > 0 else 0
        phone_hit_rate = (phones_found / total_processed * 100) if total_processed > 0 else 0
        success_rate = (total_enriched / total_processed * 100) if total_processed > 0 else 0
        
        # Get today's usage
        today_query = text("""
            SELECT SUM(credits_consumed) as used_today
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE ij.user_id = :user_id 
            AND DATE(c.created_at) = CURRENT_DATE
        """)
        
        today_result = session.execute(today_query, {"user_id": user_id})
        today_data = today_result.first()
        used_today = today_data.used_today or 0
        
        credit_data = {
            "balance": current_credits,
            "used_today": int(used_today),
            "used_this_month": int(total_credits_used),  # Simplified for now
            "limit_daily": 1000,
            "limit_monthly": 5000,
            "subscription": {
                "package_name": "Professional",
                "monthly_limit": 5000,
                "status": "active"
            },
            "statistics": {
                "total_enriched": total_enriched,
                "total_processed": total_processed,
                "email_hit_rate": round(email_hit_rate, 1),
                "phone_hit_rate": round(phone_hit_rate, 1),
                "avg_confidence": round(avg_confidence, 1),
                "success_rate": round(success_rate, 1)
            }
        }
        
        print(f"📊 Real credit data for user {user_id}: {current_credits} balance, {total_processed} processed")
        return credit_data
        
    except Exception as e:
        print(f"❌ Error fetching real user credits: {e}")
        # Return safe fallback data
        return {
            "balance": 5000,
            "used_today": 0,
            "used_this_month": 0,
            "limit_daily": 1000,
            "limit_monthly": 5000,
            "subscription": {
                "package_name": "Professional",
                "monthly_limit": 5000,
                "status": "active"
            },
            "statistics": {
                "total_enriched": 0,
                "total_processed": 0,
                "email_hit_rate": 0.0,
                "phone_hit_rate": 0.0,
                "avg_confidence": 0.0,
                "success_rate": 0.0
            }
        }

@app.post("/api/credits/deduct")
async def deduct_credits(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Deduct credits from user balance for enrichment operations"""
    try:
        credits_to_deduct = request.get("credits", 0)
        operation_type = request.get("operation_type", "enrichment")
        reason = request.get("reason", "Enrichment operation")
        
        if credits_to_deduct <= 0:
            raise HTTPException(status_code=400, detail="Credits to deduct must be positive")
        
        # Check current balance
        balance_query = text("SELECT credits FROM users WHERE id = :user_id")
        balance_result = session.execute(balance_query, {"user_id": user_id})
        balance_data = balance_result.first()
        
        if not balance_data:
            # User doesn't exist - this shouldn't happen as they should be created during auth
            print(f"❌ User {user_id} not found in database")
            raise HTTPException(status_code=404, detail="User not found. Please ensure you are properly authenticated.")
        else:
            current_balance = balance_data.credits or 0
        
        if current_balance < credits_to_deduct:
            raise HTTPException(status_code=400, detail="Insufficient credits")
        
        # Deduct credits
        new_balance = current_balance - credits_to_deduct
        deduct_query = text("""
            UPDATE users 
            SET credits = :new_balance, updated_at = CURRENT_TIMESTAMP 
            WHERE id = :user_id
        """)
        session.execute(deduct_query, {
            "new_balance": new_balance,
            "user_id": user_id
        })
        session.commit()
        
        print(f"💳 Deducted {credits_to_deduct} credits from user {user_id}. New balance: {new_balance}")
        
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
        raise HTTPException(status_code=500, detail=f"Error deducting credits: {str(e)}")

@app.post("/api/credits/refund")
async def refund_credits(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Refund credits to user balance (e.g., if enrichment fails)"""
    try:
        credits_to_refund = request.get("credits", 0)
        reason = request.get("reason", "Enrichment refund")
        
        if credits_to_refund <= 0:
            raise HTTPException(status_code=400, detail="Credits to refund must be positive")
        
        # Get current balance
        balance_query = text("SELECT credits FROM users WHERE id = :user_id")
        balance_result = session.execute(balance_query, {"user_id": user_id})
        balance_data = balance_result.first()
        
        if not balance_data:
            # User doesn't exist - this shouldn't happen as they should be created during auth
            print(f"❌ User {user_id} not found in database")
            raise HTTPException(status_code=404, detail="User not found. Please ensure you are properly authenticated.")
        else:
            current_balance = balance_data.credits or 0
        
        # Refund credits
        new_balance = current_balance + credits_to_refund
        refund_query = text("""
            UPDATE users 
            SET credits = :new_balance, updated_at = CURRENT_TIMESTAMP 
            WHERE id = :user_id
        """)
        session.execute(refund_query, {
            "new_balance": new_balance,
            "user_id": user_id
        })
        session.commit()
        
        print(f"💳 Refunded {credits_to_refund} credits to user {user_id}. New balance: {new_balance}")
        
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
        raise HTTPException(status_code=500, detail=f"Error refunding credits: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "import-service"}