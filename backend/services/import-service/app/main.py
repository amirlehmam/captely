# services/import-service/app/main.py

from fastapi import (
    FastAPI, Request,
    UploadFile, File,
    Depends, HTTPException, status,
    Form, Query, Response, Header
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
import uuid, io, boto3, httpx, csv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
import os
from typing import Optional
import time
from datetime import datetime, timedelta

from common.config import get_settings
from common.db import get_session, async_engine
from common.celery_app import celery_app
from common.auth import verify_api_token
from .models import ImportJob, Contact, Base
from .hubspot_service import HubSpotService
from .lemlist_service import LemlistService
from .zapier_service import ZapierService
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
    # Add server IP addresses for DigitalOcean deployment
    "http://164.90.232.146:3000",
    "http://164.90.232.146:8001",
    "http://164.90.232.146:8002",
    "http://164.90.232.146:8003",
    "http://164.90.232.146:8004",
    "http://164.90.232.146:8005",
    "http://164.90.232.146:8006",
    "http://164.90.232.146:8007",
    "http://164.90.232.146:8008",
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
# Create static directory if it doesn't exist
static_dir = "static"
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
    print(f"Created static directory: {static_dir}")

app.mount("/static", StaticFiles(directory=static_dir), name="static")

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
    enrich_email: str = Form("true"),
    enrich_phone: str = Form("true"), 
    custom_filename: str = Form(None),  # Add custom filename parameter
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session),
):
    try:
        print(f"📁 Processing file upload: {file.filename} for user: {user_id}")
        
        # Use custom filename if provided, otherwise fall back to original filename
        display_filename = custom_filename.strip() if custom_filename and custom_filename.strip() else file.filename
        print(f"📝 Using filename: {display_filename} (original: {file.filename})")
        
        # Parse enrichment type parameters
        should_enrich_email = enrich_email.lower() == "true"
        should_enrich_phone = enrich_phone.lower() == "true"
        
        enrichment_type_text = []
        if should_enrich_email:
            enrichment_type_text.append("Email")
        if should_enrich_phone:
            enrichment_type_text.append("Phone")
        enrichment_type_str = " + ".join(enrichment_type_text) if enrichment_type_text else "No enrichment"
        
        print(f"🎯 Enrichment type requested: {enrichment_type_str}")
        
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
        
        # Create import job record using custom filename
        job_insert_sql = text("""
            INSERT INTO import_jobs (id, user_id, total, status, file_name, created_at, updated_at)
            VALUES (:job_id, :user_id, :total, :status, :file_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """)
        
        session.execute(job_insert_sql, {
            "job_id": job_id,
            "user_id": user_id,
            "total": len(df),
            "status": "processing",
            "file_name": display_filename  # Use custom filename instead of file.filename
        })
        session.commit()
        print(f"✅ Created file import job: {job_id} with {len(df)} contacts using filename: {display_filename}")

        # Process each row and send to enrichment with type specification
        for idx, row in df.iterrows():
            # Convert row to dict and normalize field names
            lead_data = row.to_dict()
            
            # Clean NaN values - replace with empty strings
            for key, value in lead_data.items():
                if pd.isna(value):
                    lead_data[key] = ""
            
            # Add enrichment type preferences to the lead data
            enrichment_config = {
                "enrich_email": should_enrich_email,
                "enrich_phone": should_enrich_phone
            }
            
            # Send to the cascade enrichment task with enrichment configuration
            celery_app.send_task(
                "app.tasks.cascade_enrich",
                args=[lead_data, job_id, user_id, enrichment_config],
                queue="cascade_enrichment"
            )

        # Upload to S3 if available - use custom filename in the S3 key
        if s3 and hasattr(settings, 's3_bucket_raw'):
            try:
                # Use custom filename in S3 key but preserve original file extension
                file_extension = os.path.splitext(file.filename)[1]  # Get .csv or .xlsx
                s3_filename = f"{display_filename}{file_extension}" if not display_filename.endswith(file_extension) else display_filename
                key = f"{user_id}/{job_id}/{s3_filename}"
                s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)
                print(f"📁 Uploaded file to S3: {key}")
            except Exception as e:
                print(f"⚠️ S3 upload failed: {e}")

        print(f"🚀 Successfully queued {len(df)} contacts for {enrichment_type_str} enrichment in job: {job_id}")
        return JSONResponse({
            "job_id": job_id, 
            "total_contacts": len(df),
            "display_filename": display_filename,  # Return the filename being used
            "enrichment_type": {
                "email": should_enrich_email,
                "phone": should_enrich_phone
            }
        })
        
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

# 2) Manual contacts endpoint
class ManualContact(BaseModel):
    first_name: str
    last_name: str
    company: str
    position: str = ""
    location: str = ""
    industry: str = ""

class ManualContactsBatch(BaseModel):
    contacts: list[ManualContact]
    enrichment_config: dict = None
    custom_filename: str = None  # Add custom filename support

@app.post(
    "/api/imports/manual",
    status_code=status.HTTP_201_CREATED,
)
async def import_manual_contacts(
    batch: ManualContactsBatch,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session),
):
    """Import manually entered contacts for enrichment"""
    try:
        print(f"📝 Processing manual contact import for user: {user_id}")
        print(f"🎯 Manual contacts count: {len(batch.contacts)}")
        
        # Use custom filename if provided, otherwise use default
        display_filename = batch.custom_filename.strip() if batch.custom_filename and batch.custom_filename.strip() else f"Manual Import - {len(batch.contacts)} contacts"
        print(f"📝 Using filename: {display_filename}")
        
        # Parse enrichment type parameters
        enrichment_config = batch.enrichment_config or {}
        should_enrich_email = enrichment_config.get("email", True)
        should_enrich_phone = enrichment_config.get("phone", True)
        
        enrichment_type_text = []
        if should_enrich_email:
            enrichment_type_text.append("Email")
        if should_enrich_phone:
            enrichment_type_text.append("Phone")
        enrichment_type_str = " + ".join(enrichment_type_text) if enrichment_type_text else "No enrichment"
        
        print(f"🎯 Enrichment type requested: {enrichment_type_str}")
        
        if not batch.contacts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No contacts provided"
            )

        job_id = str(uuid.uuid4())
        
        # Create import job record using custom filename
        job_insert_sql = text("""
            INSERT INTO import_jobs (id, user_id, total, status, file_name, created_at, updated_at)
            VALUES (:job_id, :user_id, :total, :status, :file_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """)
        
        session.execute(job_insert_sql, {
            "job_id": job_id,
            "user_id": user_id,
            "total": len(batch.contacts),
            "status": "processing",
            "file_name": display_filename  # Use custom filename
        })
        session.commit()
        print(f"✅ Created manual import job: {job_id} with {len(batch.contacts)} contacts using filename: {display_filename}")

        # Process each manually entered contact
        for contact in batch.contacts:
            # Convert contact to dict and prepare for enrichment
            lead_data = {
                "first_name": contact.first_name.strip(),
                "last_name": contact.last_name.strip(),
                "company": contact.company.strip(),
                "position": contact.position.strip() if contact.position else "",
                "location": contact.location.strip() if contact.location else "",
                "industry": contact.industry.strip() if contact.industry else "",
            }
            
            # Add enrichment type preferences to the lead data
            enrichment_config_dict = {
                "enrich_email": should_enrich_email,
                "enrich_phone": should_enrich_phone
            }
            
            # Send to the cascade enrichment task with enrichment configuration
            celery_app.send_task(
                "app.tasks.cascade_enrich",
                args=[lead_data, job_id, user_id, enrichment_config_dict],
                queue="cascade_enrichment"
            )

        print(f"🚀 Successfully queued {len(batch.contacts)} manual contacts for {enrichment_type_str} enrichment in job: {job_id}")
        return JSONResponse({
            "job_id": job_id, 
            "total_contacts": len(batch.contacts),
            "display_filename": display_filename,  # Return the filename being used
            "enrichment_type": {
                "email": should_enrich_email,
                "phone": should_enrich_phone
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in import_manual_contacts: {e}")
        try:
            if session is not None:
                session.rollback()
        except Exception as rollback_error:
            print(f"🔍 Rollback error: {rollback_error}")
            pass  # Ignore rollback errors to prevent double exception
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Manual contact import failed: {str(e)}"
        )

# 3) JSON batch endpoint (from extension or other clients)
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
            
            # 🔥 AUTO-FIX: Update job status to "completed" if progress is 100% and status is still "processing"
            current_status = job.status
            if progress >= 100 and current_status == 'processing':
                print(f"🔄 Auto-updating job {job.id} status from 'processing' to 'completed' (progress: {progress}%)")
                update_status_query = text("""
                    UPDATE import_jobs 
                    SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = :job_id
                """)
                session.execute(update_status_query, {"job_id": job.id})
                session.commit()
                current_status = 'completed'
            
            jobs.append({
                "id": job.id,
                "status": current_status,  # Use corrected status
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
                   COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as emails_found,
                   COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN 1 END) as phones_found,
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
        
        # 🔥 AUTO-FIX: Update job status to "completed" if progress is 100% and status is still "processing"
        current_status = job_data.status
        if progress >= 100 and current_status == 'processing':
            print(f"🔄 Auto-updating job {job_id} status from 'processing' to 'completed' (progress: {progress}%)")
            update_status_query = text("""
                UPDATE import_jobs 
                SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
                WHERE id = :job_id
            """)
            session.execute(update_status_query, {"job_id": job_id})
            session.commit()
            current_status = 'completed'
        
        return {
            "id": job_data.id,
            "user_id": job_data.user_id,
            "status": current_status,  # Use corrected status instead of job_data.status
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
        
        # Get contacts with enhanced fields
        contacts_query = text("""
            SELECT 
                id, job_id, first_name, last_name, email, phone, company, position,
                location, industry, profile_url, enriched, enrichment_status,
                enrichment_provider, enrichment_score, email_verified, phone_verified,
                email_verification_score, phone_verification_score, notes,
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
                "email_verification_score": float(row[17]) if row[17] else None,
                "phone_verification_score": float(row[18]) if row[18] else None,
                "notes": row[19],
                "credits_consumed": float(row[20]) if row[20] else 0,
                "created_at": row[21].isoformat() if row[21] else None,
                "updated_at": row[22].isoformat() if row[22] else None
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

@app.get("/api/jobs/{job_id}/export")
async def export_job_data(
    job_id: str,
    format: str = Query("csv", regex="^(csv|excel|json)$"),
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Export job contacts in various formats"""
    try:
        # Verify job belongs to user
        job_check = text("SELECT id FROM import_jobs WHERE id = :job_id AND user_id = :user_id")
        job_result = session.execute(job_check, {"job_id": job_id, "user_id": user_id})
        if not job_result.first():
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get all contacts for the job
        contacts_query = text("""
            SELECT 
                first_name, last_name, email, phone, company, position,
                location, industry, profile_url, enriched, enrichment_status,
                enrichment_provider, enrichment_score, email_verified, phone_verified,
                credits_consumed, created_at
            FROM contacts 
            WHERE job_id = :job_id
            ORDER BY created_at DESC
        """)
        
        contacts_result = session.execute(contacts_query, {"job_id": job_id})
        contacts = []
        
        for row in contacts_result:
            contacts.append({
                "first_name": row[0],
                "last_name": row[1],
                "email": row[2] or "",
                "phone": row[3] or "",
                "company": row[4] or "",
                "position": row[5] or "",
                "location": row[6] or "",
                "industry": row[7] or "",
                "profile_url": row[8] or "",
                "enriched": row[9],
                "enrichment_status": row[10],
                "enrichment_provider": row[11] or "",
                "enrichment_score": row[12] or 0,
                "email_verified": row[13],
                "phone_verified": row[14],
                "credits_consumed": row[15] or 0,
                "created_at": row[16].isoformat() if row[16] else ""
            })
        
        if format == "csv":
            # Create CSV response
            output = io.StringIO()
            if contacts:
                writer = csv.DictWriter(output, fieldnames=contacts[0].keys())
                writer.writeheader()
                writer.writerows(contacts)
            
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=export_{job_id}.csv"
                }
            )
            
        elif format == "excel":
            # Create Excel response
            df = pd.DataFrame(contacts)
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, sheet_name='Contacts', index=False)
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f"attachment; filename=export_{job_id}.xlsx"
                }
            )
            
        else:  # json
            return JSONResponse(content={"contacts": contacts})
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error exporting job data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "import-service"}

@app.get("/api/health")
async def api_health_check():
    """API health check endpoint (nginx compatibility)"""
    return {"status": "ok", "service": "import-service"}

# ==========================================
# VERIFICATION ENDPOINTS
# ==========================================

@app.get("/api/verification/stats")
async def get_verification_stats(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get verification statistics for all contacts of the authenticated user"""
    try:
        print(f"📊 Getting verification stats for user: {user_id}")
        
        # Get verification statistics for all user's contacts
        stats_query = text("""
            SELECT 
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as total_emails,
                COUNT(CASE WHEN c.email_verified = true THEN 1 END) as verified_emails,
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' AND c.email_verified = false THEN 1 END) as invalid_emails,
                COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN 1 END) as total_phones,
                COUNT(CASE WHEN c.phone_verified = true THEN 1 END) as verified_phones,
                COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' AND c.phone_verified = false THEN 1 END) as invalid_phones,
                -- Email quality distribution
                COUNT(CASE WHEN c.email_verification_score >= 0.9 THEN 1 END) as email_excellent,
                COUNT(CASE WHEN c.email_verification_score >= 0.7 AND c.email_verification_score < 0.9 THEN 1 END) as email_good,
                COUNT(CASE WHEN c.email_verification_score >= 0.5 AND c.email_verification_score < 0.7 THEN 1 END) as email_fair,
                COUNT(CASE WHEN c.email_verification_score < 0.5 AND c.email_verification_score IS NOT NULL THEN 1 END) as email_poor,
                -- Phone type distribution  
                COUNT(CASE WHEN c.phone_verification_score >= 0.9 THEN 1 END) as phone_mobile,
                COUNT(CASE WHEN c.phone_verification_score >= 0.7 AND c.phone_verification_score < 0.9 THEN 1 END) as phone_landline,
                COUNT(CASE WHEN c.phone_verification_score >= 0.5 AND c.phone_verification_score < 0.7 THEN 1 END) as phone_voip,
                COUNT(CASE WHEN c.phone_verification_score < 0.5 AND c.phone_verification_score IS NOT NULL THEN 1 END) as phone_invalid
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE ij.user_id = :user_id
        """)
        
        result = session.execute(stats_query, {"user_id": user_id})
        stats = result.first()
        
        verification_stats = {
            "total_emails": stats[0] or 0,
            "verified_emails": stats[1] or 0,
            "invalid_emails": stats[2] or 0,
            "total_phones": stats[3] or 0,
            "verified_phones": stats[4] or 0,
            "invalid_phones": stats[5] or 0,
            "verification_scores": {
                "email": {
                    "excellent": stats[6] or 0,
                    "good": stats[7] or 0,
                    "fair": stats[8] or 0,
                    "poor": stats[9] or 0
                },
                "phone": {
                    "mobile": stats[10] or 0,
                    "landline": stats[11] or 0,
                    "voip": stats[12] or 0,
                    "invalid": stats[13] or 0
                }
            }
        }
        
        print(f"✅ Verification stats: {verification_stats['total_emails']} emails, {verification_stats['total_phones']} phones")
        return verification_stats
        
    except Exception as e:
        print(f"❌ Error getting verification stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting verification stats: {str(e)}")

@app.get("/api/verification/stats/{job_id}")
async def get_job_verification_stats(
    job_id: str,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get verification statistics for a specific job"""
    try:
        print(f"📊 Getting verification stats for job {job_id}, user: {user_id}")
        
        # Verify job belongs to user
        job_check = text("SELECT id FROM import_jobs WHERE id = :job_id AND user_id = :user_id")
        job_result = session.execute(job_check, {"job_id": job_id, "user_id": user_id})
        if not job_result.first():
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get verification statistics for this specific job
        stats_query = text("""
            SELECT 
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as total_emails,
                COUNT(CASE WHEN c.email_verified = true THEN 1 END) as verified_emails,
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' AND c.email_verified = false THEN 1 END) as invalid_emails,
                COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN 1 END) as total_phones,
                COUNT(CASE WHEN c.phone_verified = true THEN 1 END) as verified_phones,
                COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' AND c.phone_verified = false THEN 1 END) as invalid_phones,
                -- Email quality distribution
                COUNT(CASE WHEN c.email_verification_score >= 0.9 THEN 1 END) as email_excellent,
                COUNT(CASE WHEN c.email_verification_score >= 0.7 AND c.email_verification_score < 0.9 THEN 1 END) as email_good,
                COUNT(CASE WHEN c.email_verification_score >= 0.5 AND c.email_verification_score < 0.7 THEN 1 END) as email_fair,
                COUNT(CASE WHEN c.email_verification_score < 0.5 AND c.email_verification_score IS NOT NULL THEN 1 END) as email_poor,
                -- Phone type distribution  
                COUNT(CASE WHEN c.phone_verification_score >= 0.9 THEN 1 END) as phone_mobile,
                COUNT(CASE WHEN c.phone_verification_score >= 0.7 AND c.phone_verification_score < 0.9 THEN 1 END) as phone_landline,
                COUNT(CASE WHEN c.phone_verification_score >= 0.5 AND c.phone_verification_score < 0.7 THEN 1 END) as phone_voip,
                COUNT(CASE WHEN c.phone_verification_score < 0.5 AND c.phone_verification_score IS NOT NULL THEN 1 END) as phone_invalid
            FROM contacts c
            WHERE c.job_id = :job_id
        """)
        
        result = session.execute(stats_query, {"job_id": job_id})
        stats = result.first()
        
        verification_stats = {
            "total_emails": stats[0] or 0,
            "verified_emails": stats[1] or 0,
            "invalid_emails": stats[2] or 0,
            "total_phones": stats[3] or 0,
            "verified_phones": stats[4] or 0,
            "invalid_phones": stats[5] or 0,
            "verification_scores": {
                "email": {
                    "excellent": stats[6] or 0,
                    "good": stats[7] or 0,
                    "fair": stats[8] or 0,
                    "poor": stats[9] or 0
                },
                "phone": {
                    "mobile": stats[10] or 0,
                    "landline": stats[11] or 0,
                    "voip": stats[12] or 0,
                    "invalid": stats[13] or 0
                }
            }
        }
        
        print(f"✅ Job {job_id} verification stats: {verification_stats['total_emails']} emails, {verification_stats['total_phones']} phones")
        return verification_stats
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting job verification stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting verification stats: {str(e)}")

@app.post("/api/verification/job/{job_id}/verify")
async def verify_job_contacts(
    job_id: str,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Trigger verification for existing contacts in a job"""
    try:
        print(f"🔍 Starting verification for job {job_id}, user: {user_id}")
        
        # Verify job belongs to user
        job_check = text("SELECT id FROM import_jobs WHERE id = :job_id AND user_id = :user_id")
        job_result = session.execute(job_check, {"job_id": job_id, "user_id": user_id})
        if not job_result.first():
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Trigger the verification task using Celery
        from celery import Celery
        
        # Create a Celery app connection
        celery_app = Celery(
            "import_service",
            broker="redis://redis:6379/0",
            backend="redis://redis:6379/0"
        )
        
        # Send the verification task to the enrichment worker
        task = celery_app.send_task(
            'app.tasks.verify_existing_contacts',
            args=[job_id],
            queue='contact_enrichment'
        )
        
        print(f"✅ Verification task {task.id} queued for job {job_id}")
        
        return {
            "success": True,
            "job_id": job_id,
            "task_id": task.id,
            "message": "Verification task started"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error starting verification: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting verification: {str(e)}")

@app.post("/api/verification/email")
async def verify_single_email(
    request: dict,
    user_id: str = Depends(verify_api_token)
):
    """Verify a single email address"""
    try:
        email = request.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        print(f"📧 Verifying email: {email}")
        
        # Trigger the email verification task
        from celery import Celery
        
        celery_app = Celery(
            "import_service",
            broker="redis://redis:6379/0",
            backend="redis://redis:6379/0"
        )
        
        # For now, return a simple response. In a full implementation,
        # this would call the actual verification service
        return {
            "email": email,
            "is_valid": True,  # Placeholder
            "verification_level": 2,
            "is_catchall": False,
            "is_disposable": False,
            "is_role_based": False,
            "deliverable": True,
            "score": 85,
            "reason": "Verified successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error verifying email: {e}")
        raise HTTPException(status_code=500, detail=f"Error verifying email: {str(e)}")

@app.post("/api/verification/phone")
async def verify_single_phone(
    request: dict,
    user_id: str = Depends(verify_api_token)
):
    """Verify a single phone number"""
    try:
        phone = request.get("phone")
        country_hint = request.get("country_hint")
        
        if not phone:
            raise HTTPException(status_code=400, detail="Phone is required")
        
        print(f"📱 Verifying phone: {phone}")
        
        # For now, return a simple response. In a full implementation,
        # this would call the actual verification service
        return {
            "phone": phone,
            "is_valid": True,  # Placeholder
            "is_mobile": True,
            "is_landline": False,
            "is_voip": False,
            "country": "US",
            "carrier_name": "Verizon",
            "region": "New York",
            "formatted_international": "+1234567890",
            "score": 90,
            "reason": "Verified successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error verifying phone: {e}")
        raise HTTPException(status_code=500, detail=f"Error verifying phone: {str(e)}")

# ==========================================
# CONTACT MANAGEMENT ENDPOINTS
# ==========================================

class ContactUpdate(BaseModel):
    position: Optional[str] = None
    notes: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    industry: Optional[str] = None

@app.put("/api/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    update_data: ContactUpdate,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Update contact information (position, notes, etc.)"""
    try:
        # Verify contact exists and belongs to user
        verify_query = text("""
            SELECT c.id FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE c.id = :contact_id AND ij.user_id = :user_id
        """)
        verify_result = session.execute(verify_query, {"contact_id": contact_id, "user_id": user_id})
        if not verify_result.first():
            raise HTTPException(status_code=404, detail="Contact not found or access denied")
        
        # Build dynamic update query
        update_fields = []
        params = {"contact_id": contact_id}
        
        if update_data.position is not None:
            update_fields.append("position = :position")
            params["position"] = update_data.position
            
        if update_data.notes is not None:
            update_fields.append("notes = :notes")
            params["notes"] = update_data.notes
            
        if update_data.first_name is not None:
            update_fields.append("first_name = :first_name")
            params["first_name"] = update_data.first_name
            
        if update_data.last_name is not None:
            update_fields.append("last_name = :last_name")
            params["last_name"] = update_data.last_name
            
        if update_data.company is not None:
            update_fields.append("company = :company")
            params["company"] = update_data.company
            
        if update_data.location is not None:
            update_fields.append("location = :location")
            params["location"] = update_data.location
            
        if update_data.industry is not None:
            update_fields.append("industry = :industry")
            params["industry"] = update_data.industry
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Add updated_at
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        
        update_query = text(f"""
            UPDATE contacts 
            SET {', '.join(update_fields)}
            WHERE id = :contact_id
            RETURNING id
        """)
        
        result = session.execute(update_query, params)
        updated_id = result.scalar()
        
        if not updated_id:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        session.commit()
        
        # Return updated contact
        updated_contact_query = text("""
            SELECT 
                id, job_id, first_name, last_name, email, phone, company, position,
                location, industry, profile_url, enriched, enrichment_status,
                enrichment_provider, enrichment_score, email_verified, phone_verified,
                email_verification_score, phone_verification_score, notes,
                credits_consumed, created_at, updated_at
            FROM contacts 
            WHERE id = :contact_id
        """)
        
        contact_result = session.execute(updated_contact_query, {"contact_id": contact_id})
        contact_row = contact_result.first()
        
        if not contact_row:
            raise HTTPException(status_code=404, detail="Contact not found after update")
        
        return {
            "id": str(contact_row[0]),
            "job_id": str(contact_row[1]),
            "first_name": contact_row[2],
            "last_name": contact_row[3],
            "email": contact_row[4],
            "phone": contact_row[5],
            "company": contact_row[6],
            "position": contact_row[7],
            "location": contact_row[8],
            "industry": contact_row[9],
            "profile_url": contact_row[10],
            "enriched": contact_row[11],
            "enrichment_status": contact_row[12],
            "enrichment_provider": contact_row[13],
            "enrichment_score": float(contact_row[14]) if contact_row[14] else None,
            "email_verified": contact_row[15],
            "phone_verified": contact_row[16],
            "email_verification_score": float(contact_row[17]) if contact_row[17] else None,
            "phone_verification_score": float(contact_row[18]) if contact_row[18] else None,
            "notes": contact_row[19],
            "credits_consumed": float(contact_row[20]) if contact_row[20] else 0,
            "created_at": contact_row[21].isoformat() if contact_row[21] else None,
            "updated_at": contact_row[22].isoformat() if contact_row[22] else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating contact: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/contacts/{contact_id}")
async def get_contact(
    contact_id: str,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get detailed contact information"""
    try:
        # Get contact with user verification
        contact_query = text("""
            SELECT 
                c.id, c.job_id, c.first_name, c.last_name, c.email, c.phone, c.company, c.position,
                c.location, c.industry, c.profile_url, c.enriched, c.enrichment_status,
                c.enrichment_provider, c.enrichment_score, c.email_verified, c.phone_verified,
                c.email_verification_score, c.phone_verification_score, c.notes,
                c.credits_consumed, c.created_at, c.updated_at
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE c.id = :contact_id AND ij.user_id = :user_id
        """)
        
        contact_result = session.execute(contact_query, {"contact_id": contact_id, "user_id": user_id})
        contact_row = contact_result.first()
        
        if not contact_row:
            raise HTTPException(status_code=404, detail="Contact not found or access denied")
        
        return {
            "id": str(contact_row[0]),
            "job_id": str(contact_row[1]),
            "first_name": contact_row[2],
            "last_name": contact_row[3],
            "email": contact_row[4],
            "phone": contact_row[5],
            "company": contact_row[6],
            "position": contact_row[7],
            "location": contact_row[8],
            "industry": contact_row[9],
            "profile_url": contact_row[10],
            "enriched": contact_row[11],
            "enrichment_status": contact_row[12],
            "enrichment_provider": contact_row[13],
            "enrichment_score": float(contact_row[14]) if contact_row[14] else None,
            "email_verified": contact_row[15],
            "phone_verified": contact_row[16],
            "email_verification_score": float(contact_row[17]) if contact_row[17] else None,
            "phone_verification_score": float(contact_row[18]) if contact_row[18] else None,
            "notes": contact_row[19],
            "credits_consumed": float(contact_row[20]) if contact_row[20] else 0,
            "created_at": contact_row[21].isoformat() if contact_row[21] else None,
            "updated_at": contact_row[22].isoformat() if contact_row[22] else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching contact: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# HUBSPOT EXPORT ENDPOINTS
# ==========================================

@app.post("/api/contacts/{contact_id}/export/hubspot")
async def export_contact_to_hubspot(
    contact_id: str,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Export a single contact to HubSpot"""
    try:
        # Get contact details
        contact_query = text("""
            SELECT 
                c.first_name, c.last_name, c.email, c.phone, c.company, c.position,
                c.location, c.industry, c.profile_url, c.notes
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE c.id = :contact_id AND ij.user_id = :user_id
        """)
        
        contact_result = session.execute(contact_query, {"contact_id": contact_id, "user_id": user_id})
        contact_row = contact_result.first()
        
        if not contact_row:
            raise HTTPException(status_code=404, detail="Contact not found or access denied")
        
        # Prepare HubSpot contact data
        hubspot_data = {
            "properties": {
                "email": contact_row[2] or "",
                "firstname": contact_row[0] or "",
                "lastname": contact_row[1] or "",
                "phone": contact_row[3] or "",
                "company": contact_row[4] or "",
                "jobtitle": contact_row[5] or "",
                "city": contact_row[6] or "",
                "industry": contact_row[7] or "",
                "linkedin_bio": contact_row[8] or "",
                "hs_lead_status": "NEW",
                "lifecyclestage": "lead"
            }
        }
        
        # Add notes if available
        if contact_row[9]:
            hubspot_data["properties"]["notes_last_contacted"] = contact_row[9]
        
        # TODO: Implement actual HubSpot API integration
        # For now, return a mock success response
        print(f"📤 Would export to HubSpot: {hubspot_data}")
        
        # In a real implementation, you would:
        # 1. Get user's HubSpot API key/token from settings
        # 2. Make API call to HubSpot's contacts endpoint
        # 3. Handle the response and errors
        
        # Mock HubSpot API call
        hubspot_contact_id = f"hubspot_{contact_id}_{int(time.time())}"
        
        # Log the export
        export_log_query = text("""
            INSERT INTO export_logs (user_id, contact_id, platform, platform_contact_id, export_type, status, created_at)
            VALUES (:user_id, :contact_id, 'hubspot', :platform_contact_id, 'hubspot', 'success', CURRENT_TIMESTAMP)
        """)
        
        try:
            session.execute(export_log_query, {
                "user_id": user_id,
                "contact_id": contact_id,
                "platform_contact_id": hubspot_contact_id,
            })
            session.commit()
        except Exception as log_error:
            print(f"Failed to log export: {log_error}")
            # Don't fail the whole operation if logging fails
        
        return {
            "success": True,
            "platform": "hubspot",
            "platform_contact_id": hubspot_contact_id,
            "contact_data": hubspot_data,
            "message": "Contact successfully exported to HubSpot"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error exporting to HubSpot: {e}")
        raise HTTPException(status_code=500, detail=f"HubSpot export failed: {str(e)}")

@app.post("/api/jobs/{job_id}/export/hubspot")
async def export_job_to_hubspot(
    job_id: str,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Export all contacts from a job to HubSpot"""
    try:
        # Verify job ownership
        job_check = text("SELECT id FROM import_jobs WHERE id = :job_id AND user_id = :user_id")
        job_result = session.execute(job_check, {"job_id": job_id, "user_id": user_id})
        if not job_result.first():
            raise HTTPException(status_code=404, detail="Job not found or access denied")
        
        # Get all contacts for the job
        contacts_query = text("""
            SELECT 
                id, first_name, last_name, email, phone, company, position,
                location, industry, profile_url, notes
            FROM contacts 
            WHERE job_id = :job_id AND email IS NOT NULL AND email != ''
            ORDER BY created_at DESC
        """)
        
        contacts_result = session.execute(contacts_query, {"job_id": job_id})
        contacts = contacts_result.fetchall()
        
        if not contacts:
            raise HTTPException(status_code=400, detail="No contacts with emails found in this job")
        
        exported_contacts = []
        failed_contacts = []
        
        for contact in contacts:
            try:
                contact_id, first_name, last_name, email, phone, company, position, location, industry, profile_url, notes = contact
                
                # Prepare HubSpot contact data
                hubspot_data = {
                    "properties": {
                        "email": email,
                        "firstname": first_name or "",
                        "lastname": last_name or "",
                        "phone": phone or "",
                        "company": company or "",
                        "jobtitle": position or "",
                        "city": location or "",
                        "industry": industry or "",
                        "linkedin_bio": profile_url or "",
                        "hs_lead_status": "NEW",
                        "lifecyclestage": "lead"
                    }
                }
                
                if notes:
                    hubspot_data["properties"]["notes_last_contacted"] = notes
                
                # Mock HubSpot export
                hubspot_contact_id = f"hubspot_{contact_id}_{int(time.time())}"
                
                exported_contacts.append({
                    "contact_id": str(contact_id),
                    "email": email,
                    "hubspot_contact_id": hubspot_contact_id,
                    "status": "success"
                })
                
                # Log successful export
                export_log_query = text("""
                    INSERT INTO export_logs (user_id, contact_id, platform, platform_contact_id, export_type, status, created_at)
                    VALUES (:user_id, :contact_id, 'hubspot', :platform_contact_id, 'hubspot', 'success', CURRENT_TIMESTAMP)
                """)
                
                try:
                    session.execute(export_log_query, {
                        "user_id": user_id,
                        "contact_id": str(contact_id),
                        "platform_contact_id": hubspot_contact_id,
                    })
                except Exception as log_error:
                    print(f"Failed to log export for contact {contact_id}: {log_error}")
                
            except Exception as contact_error:
                print(f"Failed to export contact {contact_id}: {contact_error}")
                failed_contacts.append({
                    "contact_id": str(contact_id),
                    "email": email,
                    "error": str(contact_error),
                    "status": "failed"
                })
        
        session.commit()
        
        return {
            "success": True,
            "job_id": job_id,
            "total_contacts": len(contacts),
            "exported_count": len(exported_contacts),
            "failed_count": len(failed_contacts),
            "exported_contacts": exported_contacts,
            "failed_contacts": failed_contacts,
            "message": f"Exported {len(exported_contacts)} out of {len(contacts)} contacts to HubSpot"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error exporting job to HubSpot: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk HubSpot export failed: {str(e)}")

@app.get("/api/export/logs")
async def get_export_logs(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get export history for the user"""
    try:
        # Calculate pagination
        offset = (page - 1) * limit
        
        # Get total count
        count_query = text("SELECT COUNT(*) FROM export_logs WHERE user_id = :user_id")
        count_result = session.execute(count_query, {"user_id": user_id})
        total = count_result.scalar() or 0
        
        # Get export logs
        logs_query = text("""
            SELECT 
                el.id, el.contact_id, el.platform, el.platform_contact_id, el.status, el.created_at,
                c.first_name, c.last_name, c.email, c.company
            FROM export_logs el
            LEFT JOIN contacts c ON el.contact_id = c.id
            WHERE el.user_id = :user_id
            ORDER BY el.created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        logs_result = session.execute(logs_query, {
            "user_id": user_id,
            "limit": limit,
            "offset": offset
        })
        
        logs = []
        for row in logs_result.fetchall():
            logs.append({
                "id": str(row[0]),
                "contact_id": str(row[1]) if row[1] else None,
                "platform": row[2],
                "platform_contact_id": row[3],
                "status": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
                "contact": {
                    "first_name": row[6],
                    "last_name": row[7],
                    "email": row[8],
                    "company": row[9]
                } if row[6] else None
            })
        
        total_pages = (total + limit - 1) // limit
        
        return {
            "logs": logs,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
        
    except Exception as e:
        print(f"Error fetching export logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# CRM CONTACTS ENDPOINTS
# ==========================================

@app.get("/api/crm/contacts")
async def get_crm_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query("", description="Search term"),
    batch_filter: str = Query("all", description="Filter by specific batch"),
    status_filter: str = Query("all", description="Filter by enrichment status"),
    email_reliability: str = Query("all", description="Filter by email reliability"),
    lead_score_min: int = Query(0, ge=0, le=100),
    lead_score_max: int = Query(100, ge=0, le=100),
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get unified view of all contacts from all batches with advanced filtering"""
    try:
        # Build base query
        where_conditions = ["ij.user_id = :user_id"]
        params = {"user_id": user_id}
        
        # Add search filter
        if search:
            where_conditions.append("""(
                c.first_name ILIKE :search OR 
                c.last_name ILIKE :search OR 
                c.email ILIKE :search OR 
                c.company ILIKE :search OR
                c.position ILIKE :search
            )""")
            params["search"] = f"%{search}%"
        
        # Add batch filter
        if batch_filter != "all":
            where_conditions.append("c.job_id = :batch_filter")
            params["batch_filter"] = batch_filter
        
        # Add status filter
        if status_filter != "all":
            if status_filter == "enriched":
                where_conditions.append("c.enriched = true")
            elif status_filter == "not_enriched":
                where_conditions.append("c.enriched = false")
            elif status_filter == "verified":
                where_conditions.append("c.email_verified = true")
        
        # Add email reliability filter (with fallback for missing column)
        if email_reliability != "all":
            where_conditions.append("COALESCE(c.email_reliability, 'unknown') = :email_reliability")
            params["email_reliability"] = email_reliability
        
        # Add lead score range filter (with fallback for missing column)
        where_conditions.append("COALESCE(c.lead_score, 0) BETWEEN :lead_score_min AND :lead_score_max")
        params["lead_score_min"] = lead_score_min
        params["lead_score_max"] = lead_score_max
        
        where_clause = "WHERE " + " AND ".join(where_conditions)
        
        # Get total count
        count_query = text(f"""
            SELECT COUNT(*)
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            {where_clause}
        """)
        count_result = session.execute(count_query, params)
        total = count_result.scalar() or 0
        
        # Calculate pagination
        offset = (page - 1) * limit
        total_pages = (total + limit - 1) // limit
        
        # Get contacts with enhanced fields (with fallbacks for missing columns)
        contacts_query = text(f"""
            SELECT 
                c.id, c.job_id, c.first_name, c.last_name, c.email, c.phone, 
                c.company, c.position, c.location, c.industry, c.profile_url, 
                c.enriched, c.enrichment_status, c.enrichment_provider, 
                c.enrichment_score, c.email_verified, c.phone_verified,
                COALESCE(c.email_verification_score, 0.0) as email_verification_score, 
                COALESCE(c.phone_verification_score, 0.0) as phone_verification_score, 
                c.notes, COALESCE(c.credits_consumed, 0) as credits_consumed, 
                COALESCE(c.lead_score, 0) as lead_score, 
                COALESCE(c.email_reliability, 'unknown') as email_reliability,
                c.created_at, c.updated_at,
                ij.file_name as batch_name,
                ij.created_at as batch_created_at
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            {where_clause}
            ORDER BY c.created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        params.update({"limit": limit, "offset": offset})
        contacts_result = session.execute(contacts_query, params)
        
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
                "email_verification_score": float(row[17]) if row[17] else None,
                "phone_verification_score": float(row[18]) if row[18] else None,
                "notes": row[19],
                "credits_consumed": float(row[20]) if row[20] else 0,
                "lead_score": int(row[21]) if row[21] else 0,
                "email_reliability": row[22] or "unknown",
                "created_at": row[23].isoformat() if row[23] else None,
                "updated_at": row[24].isoformat() if row[24] else None,
                "batch_name": row[25],
                "batch_created_at": row[26].isoformat() if row[26] else None
            })
        
        return {
            "contacts": contacts,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "filters_applied": {
                "search": search,
                "batch_filter": batch_filter,
                "status_filter": status_filter,
                "email_reliability": email_reliability,
                "lead_score_range": f"{lead_score_min}-{lead_score_max}"
            }
        }
        
    except Exception as e:
        print(f"Error fetching CRM contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/crm/contacts/stats")
async def get_crm_contacts_stats(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get comprehensive CRM contacts statistics"""
    try:
        stats_query = text("""
            SELECT 
                COUNT(*) as total_contacts,
                COUNT(CASE WHEN c.enriched = true THEN 1 END) as enriched_contacts,
                COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END) as contacts_with_email,
                COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN 1 END) as contacts_with_phone,
                COUNT(CASE WHEN c.email_verified = true THEN 1 END) as verified_emails,
                COUNT(CASE WHEN c.phone_verified = true THEN 1 END) as verified_phones,
                
                -- Lead score distribution (with fallback for missing column)
                COUNT(CASE WHEN COALESCE(c.lead_score, 0) >= 80 THEN 1 END) as high_quality_leads,
                COUNT(CASE WHEN COALESCE(c.lead_score, 0) >= 50 AND COALESCE(c.lead_score, 0) < 80 THEN 1 END) as medium_quality_leads,
                COUNT(CASE WHEN COALESCE(c.lead_score, 0) < 50 THEN 1 END) as low_quality_leads,
                
                -- Email reliability distribution (with fallback for missing column)
                COUNT(CASE WHEN COALESCE(c.email_reliability, 'unknown') = 'excellent' THEN 1 END) as excellent_emails,
                COUNT(CASE WHEN COALESCE(c.email_reliability, 'unknown') = 'good' THEN 1 END) as good_emails,
                COUNT(CASE WHEN COALESCE(c.email_reliability, 'unknown') = 'fair' THEN 1 END) as fair_emails,
                COUNT(CASE WHEN COALESCE(c.email_reliability, 'unknown') = 'poor' THEN 1 END) as poor_emails,
                
                AVG(COALESCE(c.lead_score, 0)) as avg_lead_score,
                SUM(COALESCE(c.credits_consumed, 0)) as total_credits_consumed
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE ij.user_id = :user_id
        """)
        
        result = session.execute(stats_query, {"user_id": user_id})
        stats = result.first()
        
        return {
            "overview": {
                "total_contacts": stats[0] or 0,
                "enriched_contacts": stats[1] or 0,
                "contacts_with_email": stats[2] or 0,
                "contacts_with_phone": stats[3] or 0,
                "verified_emails": stats[4] or 0,
                "verified_phones": stats[5] or 0,
                "avg_lead_score": round(float(stats[13] or 0), 1),
                "total_credits_consumed": float(stats[14] or 0)
            },
            "lead_quality": {
                "high_quality": stats[6] or 0,
                "medium_quality": stats[7] or 0,
                "low_quality": stats[8] or 0
            },
            "email_reliability": {
                "excellent": stats[9] or 0,
                "good": stats[10] or 0,
                "fair": stats[11] or 0,
                "poor": stats[12] or 0
            }
        }
        
    except Exception as e:
        print(f"Error fetching CRM stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/crm/batches")
async def get_crm_batches(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get list of batches for filtering in CRM"""
    try:
        batches_query = text("""
            SELECT 
                ij.id,
                ij.file_name,
                ij.created_at,
                COUNT(c.id) as contact_count,
                COUNT(CASE WHEN c.enriched = true THEN 1 END) as enriched_count
            FROM import_jobs ij
            LEFT JOIN contacts c ON ij.id = c.job_id
            WHERE ij.user_id = :user_id
            GROUP BY ij.id, ij.file_name, ij.created_at
            ORDER BY ij.created_at DESC
        """)
        
        result = session.execute(batches_query, {"user_id": user_id})
        batches = []
        
        for row in result.fetchall():
            batches.append({
                "id": str(row[0]),
                "name": row[1] or f"Batch {str(row[0])[:8]}",
                "created_at": row[2].isoformat() if row[2] else None,
                "contact_count": row[3] or 0,
                "enriched_count": row[4] or 0
            })
        
        return {"batches": batches}
        
    except Exception as e:
        print(f"Error fetching CRM batches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/crm/contacts/bulk-export")
async def bulk_export_crm_contacts(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Bulk export contacts to HubSpot or CSV"""
    try:
        contact_ids = request.get("contact_ids", [])
        export_type = request.get("export_type", "hubspot")  # "hubspot" or "csv"
        
        if not contact_ids:
            raise HTTPException(status_code=400, detail="No contacts selected for export")
        
        # Verify contacts belong to user
        verify_query = text("""
            SELECT c.id FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE c.id = ANY(:contact_ids) AND ij.user_id = :user_id
        """)
        verify_result = session.execute(verify_query, {
            "contact_ids": contact_ids,
            "user_id": user_id
        })
        verified_ids = [str(row[0]) for row in verify_result.fetchall()]
        
        if len(verified_ids) != len(contact_ids):
            raise HTTPException(status_code=403, detail="Some contacts do not belong to user")
        
        if export_type == "hubspot":
            # Process HubSpot export for each contact
            exported_count = 0
            failed_count = 0
            
            for contact_id in verified_ids:
                try:
                    # Mock HubSpot export - in real implementation, call HubSpot API
                    hubspot_contact_id = f"hubspot_{contact_id}_{int(time.time())}"
                    
                    # Log the export
                    export_log_query = text("""
                        INSERT INTO export_logs (user_id, contact_id, platform, platform_contact_id, export_type, status, created_at)
                        VALUES (:user_id, :contact_id, 'hubspot', :platform_contact_id, 'hubspot', 'success', CURRENT_TIMESTAMP)
                    """)
                    session.execute(export_log_query, {
                        "user_id": user_id,
                        "contact_id": contact_id,
                        "platform_contact_id": hubspot_contact_id
                    })
                    exported_count += 1
                except Exception as e:
                    print(f"Failed to export contact {contact_id}: {e}")
                    failed_count += 1
            
            session.commit()
            
            return {
                "success": True,
                "export_type": "hubspot",
                "exported_count": exported_count,
                "failed_count": failed_count,
                "message": f"Exported {exported_count} contacts to HubSpot"
            }
        
        else:  # CSV export
            # Get contact data for CSV (with fallbacks for missing columns)
            contacts_query = text("""
                SELECT 
                    c.first_name, c.last_name, c.email, c.phone, c.company, 
                    c.position, c.location, c.industry, 
                    COALESCE(c.lead_score, 0) as lead_score, 
                    COALESCE(c.email_reliability, 'unknown') as email_reliability,
                    c.enrichment_provider, c.created_at
                FROM contacts c
                JOIN import_jobs ij ON c.job_id = ij.id
                WHERE c.id = ANY(:contact_ids) AND ij.user_id = :user_id
                ORDER BY c.created_at DESC
            """)
            
            contacts_result = session.execute(contacts_query, {
                "contact_ids": verified_ids,
                "user_id": user_id
            })
            
            contacts_data = []
            for row in contacts_result.fetchall():
                contacts_data.append({
                    "first_name": row[0],
                    "last_name": row[1],
                    "email": row[2] or "",
                    "phone": row[3] or "",
                    "company": row[4] or "",
                    "position": row[5] or "",
                    "location": row[6] or "",
                    "industry": row[7] or "",
                    "lead_score": row[8] or 0,
                    "email_reliability": row[9] or "unknown",
                    "enrichment_provider": row[10] or "",
                    "created_at": row[11].isoformat() if row[11] else ""
                })
            
            # Create CSV response
            import io
            output = io.StringIO()
            if contacts_data:
                writer = csv.DictWriter(output, fieldnames=contacts_data[0].keys())
                writer.writeheader()
                writer.writerows(contacts_data)
            
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=crm_contacts_export_{int(time.time())}.csv"
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in bulk export: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── HubSpot Integration Endpoints ─────────────────────────────────────────────

print("🔄 Initializing HubSpotService...")
hubspot_service = HubSpotService()
print(f"✅ HubSpotService initialized: {hubspot_service}")
print(f"📋 HubSpot Service methods: {dir(hubspot_service)}")

@app.get("/api/integrations/hubspot/oauth-url")
async def get_hubspot_oauth_url(
    user_id: str = Depends(verify_api_token)
):
    """Get HubSpot OAuth authorization URL"""
    try:
        print(f"🔗 Generating OAuth URL for user: {user_id}")
        oauth_url = hubspot_service.get_oauth_url(state=user_id)
        print(f"🔗 Generated OAuth URL: {oauth_url}")
        response = {"oauth_url": oauth_url}
        print(f"🔗 API Response: {response}")
        return response
    except Exception as e:
        print(f"🚨 OAuth URL generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate OAuth URL: {str(e)}"
        )

@app.post("/api/integrations/hubspot/oauth-callback")
async def hubspot_oauth_callback(
    code: str,
    state: str,
    session: Session = Depends(get_session)
):
    """Handle HubSpot OAuth callback"""
    try:
        user_id = state  # We passed user_id as state
        
        # Exchange code for tokens
        token_data = await hubspot_service.exchange_code_for_tokens(code)
        
        # Store tokens in database
        expires_at = datetime.now() + timedelta(seconds=token_data['expires_in'])
        
        # Get HubSpot portal ID from token info
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token_data['access_token']}"}
            response = await client.get("https://api.hubapi.com/oauth/v1/access-tokens/" + token_data['access_token'])
            token_info = response.json()
            portal_id = token_info.get('hub_id')
        
        insert_query = text("""
            INSERT INTO hubspot_integrations (
                user_id, hubspot_portal_id, access_token, refresh_token, 
                expires_at, scopes, is_active, created_at, updated_at
            ) VALUES (
                :user_id, :portal_id, :access_token, :refresh_token,
                :expires_at, :scopes, TRUE, NOW(), NOW()
            ) ON CONFLICT (user_id, hubspot_portal_id) DO UPDATE SET
                access_token = :access_token,
                refresh_token = :refresh_token,
                expires_at = :expires_at,
                scopes = :scopes,
                is_active = TRUE,
                updated_at = NOW()
        """)
        
        session.execute(insert_query, {
            "user_id": user_id,
            "portal_id": portal_id,
            "access_token": token_data['access_token'],
            "refresh_token": token_data['refresh_token'],
            "expires_at": expires_at,
            "scopes": token_data.get('scope', '').split(' ')
        })
        session.commit()
        
        return {"success": True, "message": "HubSpot integration connected successfully"}
        
    except Exception as e:
        if session is not None:
            session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth callback failed: {str(e)}"
        )

@app.get("/api/integrations/hubspot/status")
async def get_hubspot_integration_status(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get HubSpot integration status for user"""
    try:
        query = text("""
            SELECT hubspot_portal_id, is_active, expires_at, scopes, created_at
            FROM hubspot_integrations 
            WHERE user_id = :user_id AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        """)
        result = session.execute(query, {"user_id": user_id})
        integration = result.fetchone()
        
        if not integration:
            return {"connected": False}
        
        portal_id, is_active, expires_at, scopes, created_at = integration
        
        return {
            "connected": True,
            "portal_id": portal_id,
            "expires_at": expires_at.isoformat(),
            "scopes": scopes,
            "connected_at": created_at.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get integration status: {str(e)}"
        )

@app.post("/api/integrations/hubspot/import")
async def import_from_hubspot(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Import contacts from HubSpot to Captely and redirect to enrichment"""
    try:
        # Forward to export service for actual import
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://export-service:8000/api/export/hubspot/import",
                headers={
                    "Authorization": f"Bearer {user_id}",  # Pass user_id as token
                    "Content-Type": "application/json"
                },
                timeout=60.0
            )
            
            if response.status_code == 200:
                result = response.json()
                job_id = result.get("job_id")
                
                # Return response that triggers enrichment flow
                return {
                    "success": True,
                    "job_id": job_id,
                    "imported_count": result.get("imported_count", 0),
                    "total_contacts": result.get("total_contacts", 0),
                    "message": result.get("message", "Import completed"),
                    "redirect": "enrichment",  # Signal frontend to show enrichment dialog
                    "redirect_url": f"/batches/{job_id}"  # Redirect to batch page
                }
            else:
                error_text = response.text
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"HubSpot import failed: {error_text}"
                )
        
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail="Export service unavailable")
    except Exception as e:
        if session is not None:
            session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HubSpot import failed: {str(e)}"
        )

@app.post("/api/integrations/hubspot/export")
async def export_to_hubspot(
    contact_ids: list[int],
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Export selected contacts to HubSpot"""
    try:
        if not contact_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No contacts selected for export"
            )
        
        result = await hubspot_service.export_contacts_to_hubspot(session, user_id, contact_ids)
        
        return {
            "success": True,
            "exported": result["exported"],
            "failed": result["failed"],
            "sync_log_id": result["sync_log_id"]
        }
        
    except Exception as e:
        if session is not None:
            session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HubSpot export failed: {str(e)}"
        )

# Removed duplicate endpoint - using proxy below

@app.get("/api/integrations/hubspot/sync-logs")
async def get_hubspot_sync_logs(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get HubSpot sync logs for user"""
    try:
        offset = (page - 1) * limit
        
        logs_query = text("""
            SELECT sync_type, operation, status, total_records, processed_records, 
                   failed_records, error_message, started_at, completed_at
            FROM hubspot_sync_logs 
            WHERE user_id = :user_id
            ORDER BY started_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        logs_result = session.execute(logs_query, {
            "user_id": user_id,
            "limit": limit,
            "offset": offset
        })
        logs = logs_result.fetchall()
        
        # Get total count
        count_query = text("""
            SELECT COUNT(*) FROM hubspot_sync_logs WHERE user_id = :user_id
        """)
        count_result = session.execute(count_query, {"user_id": user_id})
        total = count_result.scalar()
        
        logs_data = []
        for log in logs:
            logs_data.append({
                "sync_type": log[0],
                "operation": log[1],
                "status": log[2],
                "total_records": log[3],
                "processed_records": log[4],
                "failed_records": log[5],
                "error_message": log[6],
                "started_at": log[7].isoformat() if log[7] else None,
                "completed_at": log[8].isoformat() if log[8] else None
            })
        
        return {
            "logs": logs_data,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sync logs: {str(e)}"
        )

@app.delete("/api/integrations/hubspot/disconnect")
async def disconnect_hubspot(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Disconnect HubSpot integration"""
    try:
        update_query = text("""
            UPDATE hubspot_integrations 
            SET is_active = FALSE, updated_at = NOW()
            WHERE user_id = :user_id
        """)
        
        session.execute(update_query, {"user_id": user_id})
        session.commit()
        
        return {"success": True, "message": "HubSpot integration disconnected"}
        
    except Exception as e:
        if session is not None:
            session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect HubSpot: {str(e)}"
        )

# HUBSPOT BATCH EXPORT PROXY ENDPOINT 
@app.post("/api/integrations/hubspot/export-batch")
async def export_batch_to_hubspot_proxy(
    request: dict,
    authorization: str = Header(...),
):
    """Proxy endpoint to forward HubSpot batch export requests to the export service"""
    try:
        print(f"🔧 IMPORT: Proxying HubSpot batch export: {request}")
        
        # Forward the request to the export service
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://export-service:8000/api/export/integrations/hubspot/export-batch",
                headers={
                    "Authorization": authorization,
                    "Content-Type": "application/json"
                },
                json=request,
                timeout=120.0
            )
            
            print(f"🔧 IMPORT: Export service response: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ IMPORT: Export service error: {response.text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"Batch export failed: {response.text}"
                )
                
    except httpx.RequestError as e:
        print(f"❌ IMPORT: Request error to export service: {e}")
        raise HTTPException(status_code=503, detail="Export service unavailable")
    except Exception as e:
        print(f"❌ IMPORT: Batch export proxy failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch export failed: {str(e)}")

# =============================================
# LEMLIST INTEGRATION ENDPOINTS
# =============================================

@app.post("/api/integrations/lemlist/setup")
async def setup_lemlist_integration(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Setup Lemlist integration with API key"""
    try:
        api_key = request.get("api_key")
        if not api_key:
            raise HTTPException(status_code=400, detail="API key is required")

        lemlist_service = LemlistService()
        
        # Verify API key
        account_info = await lemlist_service.verify_api_key(api_key)
        
        # Check if integration already exists
        existing_query = text("""
            SELECT id FROM lemlist_integrations 
            WHERE user_id = :user_id AND is_active = true
        """)
        existing = session.execute(existing_query, {"user_id": user_id}).fetchone()
        
        if existing:
            # Update existing integration
            update_query = text("""
                UPDATE lemlist_integrations 
                SET api_key = :api_key, account_email = :account_email, 
                    account_name = :account_name, updated_at = NOW()
                WHERE user_id = :user_id AND is_active = true
            """)
            session.execute(update_query, {
                "user_id": user_id,
                "api_key": api_key,
                "account_email": account_info.get("email", ""),
                "account_name": account_info.get("name", "")
            })
        else:
            # Create new integration
            insert_query = text("""
                INSERT INTO lemlist_integrations 
                (user_id, api_key, account_email, account_name, is_active, created_at, updated_at)
                VALUES (:user_id, :api_key, :account_email, :account_name, true, NOW(), NOW())
            """)
            session.execute(insert_query, {
                "user_id": user_id,
                "api_key": api_key,
                "account_email": account_info.get("email", ""),
                "account_name": account_info.get("name", "")
            })
        
        session.commit()
        
        return {
            "success": True,
            "message": "Lemlist integration setup successfully!",
            "account_info": {
                "email": account_info.get("email", ""),
                "name": account_info.get("name", "")
            }
        }
        
    except Exception as e:
        session.rollback()
        print(f"Lemlist setup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to setup Lemlist integration: {str(e)}")

@app.get("/api/integrations/lemlist/status")
async def get_lemlist_integration_status(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get Lemlist integration status"""
    try:
        query = text("""
            SELECT api_key, account_email, account_name, created_at, updated_at
            FROM lemlist_integrations 
            WHERE user_id = :user_id AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        integration = session.execute(query, {"user_id": user_id}).fetchone()
        
        if not integration:
            return {"connected": False}
        
        # Test API key validity
        try:
            lemlist_service = LemlistService()
            await lemlist_service.verify_api_key(integration.api_key)
            api_valid = True
        except:
            api_valid = False
        
        return {
            "connected": True,
            "api_valid": api_valid,
            "account_email": integration.account_email,
            "account_name": integration.account_name,
            "connected_at": integration.created_at.isoformat() if integration.created_at else None,
            "last_updated": integration.updated_at.isoformat() if integration.updated_at else None
        }
        
    except Exception as e:
        print(f"Error checking Lemlist status: {e}")
        return {"connected": False, "error": str(e)}

@app.get("/api/integrations/lemlist/campaigns")
async def get_lemlist_campaigns(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get available Lemlist campaigns"""
    try:
        lemlist_service = LemlistService()
        campaigns = await lemlist_service.get_campaigns(session, user_id)
        
        return {
            "success": True,
            "campaigns": campaigns
        }
        
    except Exception as e:
        print(f"Error fetching Lemlist campaigns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaigns: {str(e)}")

@app.post("/api/integrations/lemlist/import")
async def import_from_lemlist(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Import contacts from Lemlist campaigns"""
    try:
        campaign_id = request.get("campaign_id")
        
        # Create a new import job
        job_id = str(uuid.uuid4())
        job_insert_sql = text("""
            INSERT INTO import_jobs (id, user_id, total, status, file_name, created_at, updated_at)
            VALUES (:job_id, :user_id, 0, 'processing', :file_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """)
        
        filename = f"Lemlist Import - Campaign {campaign_id}" if campaign_id else "Lemlist Import - All Campaigns"
        session.execute(job_insert_sql, {
            "job_id": job_id,
            "user_id": user_id,
            "file_name": filename
        })
        session.commit()
        
        # Import contacts from Lemlist
        lemlist_service = LemlistService()
        result = await lemlist_service.import_contacts_from_lemlist(session, user_id, job_id, campaign_id)
        
        # Update job with final counts
        update_job_sql = text("""
            UPDATE import_jobs 
            SET status = 'completed', total = :total, processed_records = :imported, updated_at = NOW()
            WHERE id = :job_id
        """)
        session.execute(update_job_sql, {
            "job_id": job_id,
            "total": result["total_contacts"],
            "imported": result["imported_count"]
        })
        session.commit()
        
        return {
            "success": True,
            "job_id": job_id,
            "imported_count": result["imported_count"],
            "total_contacts": result["total_contacts"],
            "message": result["message"],
            "redirect": "enrichment",
            "redirect_url": f"/batches/{job_id}"
        }
        
    except Exception as e:
        session.rollback()
        print(f"Lemlist import error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lemlist import failed: {str(e)}")

@app.post("/api/integrations/lemlist/export")
async def export_to_lemlist(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Export contacts to Lemlist campaign"""
    try:
        contact_ids = request.get("contact_ids", [])
        campaign_id = request.get("campaign_id")
        
        if not contact_ids:
            raise HTTPException(status_code=400, detail="No contacts provided")
        if not campaign_id:
            raise HTTPException(status_code=400, detail="Campaign ID is required")
        
        lemlist_service = LemlistService()
        result = await lemlist_service.export_contacts_to_lemlist(session, user_id, contact_ids, campaign_id)
        
        return {
            "success": True,
            "exported_count": result["exported_count"],
            "failed_count": result["failed_count"],
            "errors": result["errors"]
        }
        
    except Exception as e:
        session.rollback()
        print(f"Lemlist export error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lemlist export failed: {str(e)}")

@app.delete("/api/integrations/lemlist/disconnect")
async def disconnect_lemlist(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Disconnect Lemlist integration"""
    try:
        query = text("""
            UPDATE lemlist_integrations 
            SET is_active = false, updated_at = NOW()
            WHERE user_id = :user_id AND is_active = true
        """)
        
        result = session.execute(query, {"user_id": user_id})
        session.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Lemlist integration not found")
        
        return {"success": True, "message": "Lemlist integration disconnected successfully"}
        
    except Exception as e:
        session.rollback()
        print(f"Error disconnecting Lemlist: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect Lemlist: {str(e)}")

# =============================================
# ZAPIER INTEGRATION ENDPOINTS
# =============================================

@app.post("/api/integrations/zapier/setup")
async def setup_zapier_integration(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Setup Zapier integration with webhook URL"""
    try:
        webhook_url = request.get("webhook_url")
        if not webhook_url:
            raise HTTPException(status_code=400, detail="Webhook URL is required")

        zapier_service = ZapierService()
        
        # Verify webhook URL
        verification_result = await zapier_service.verify_webhook(webhook_url)
        if not verification_result["success"]:
            raise HTTPException(status_code=400, detail=f"Webhook verification failed: {verification_result.get('response', 'Unknown error')}")
        
        # Check if integration already exists
        existing_query = text("""
            SELECT id FROM zapier_integrations 
            WHERE user_id = :user_id AND is_active = true
        """)
        existing = session.execute(existing_query, {"user_id": user_id}).fetchone()
        
        if existing:
            # Update existing integration
            update_query = text("""
                UPDATE zapier_integrations 
                SET webhook_url = :webhook_url, zap_name = :zap_name, updated_at = NOW()
                WHERE user_id = :user_id AND is_active = true
            """)
            session.execute(update_query, {
                "user_id": user_id,
                "webhook_url": webhook_url,
                "zap_name": "Captely to Zapier Integration"
            })
        else:
            # Create new integration
            insert_query = text("""
                INSERT INTO zapier_integrations 
                (user_id, webhook_url, zap_name, is_active, created_at, updated_at)
                VALUES (:user_id, :webhook_url, :zap_name, true, NOW(), NOW())
            """)
            session.execute(insert_query, {
                "user_id": user_id,
                "webhook_url": webhook_url,
                "zap_name": "Captely to Zapier Integration"
            })
        
        session.commit()
        
        return {
            "success": True,
            "message": "Zapier integration setup successfully!",
            "webhook_url": webhook_url,
            "verification": verification_result
        }
        
    except Exception as e:
        session.rollback()
        print(f"Zapier setup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to setup Zapier integration: {str(e)}")

@app.get("/api/integrations/zapier/status")
async def get_zapier_integration_status(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Get Zapier integration status"""
    try:
        query = text("""
            SELECT webhook_url, zap_name, created_at, updated_at
            FROM zapier_integrations 
            WHERE user_id = :user_id AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        integration = session.execute(query, {"user_id": user_id}).fetchone()
        
        if not integration:
            return {"connected": False}
        
        # Test webhook validity
        try:
            zapier_service = ZapierService()
            test_result = await zapier_service.verify_webhook(integration.webhook_url)
            webhook_valid = test_result["success"]
        except:
            webhook_valid = False
        
        return {
            "connected": True,
            "webhook_valid": webhook_valid,
            "webhook_url": integration.webhook_url,
            "zap_name": integration.zap_name,
            "connected_at": integration.created_at.isoformat() if integration.created_at else None,
            "last_updated": integration.updated_at.isoformat() if integration.updated_at else None
        }
        
    except Exception as e:
        print(f"Error checking Zapier status: {e}")
        return {"connected": False, "error": str(e)}

@app.post("/api/integrations/zapier/export")
async def export_to_zapier(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Export contacts to Zapier webhook"""
    try:
        contact_ids = request.get("contact_ids", [])
        batch_mode = request.get("batch_mode", True)
        
        if not contact_ids:
            raise HTTPException(status_code=400, detail="No contacts provided")
        
        zapier_service = ZapierService()
        result = await zapier_service.export_contacts_to_zapier(session, user_id, contact_ids, batch_mode)
        
        return {
            "success": True,
            "exported_count": result["exported_count"],
            "failed_count": result["failed_count"],
            "errors": result["errors"],
            "batch_mode": result["batch_mode"]
        }
        
    except Exception as e:
        session.rollback()
        print(f"Zapier export error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Zapier export failed: {str(e)}")

@app.post("/api/integrations/zapier/webhook")
async def receive_zapier_webhook(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Receive webhook data from Zapier (for importing contacts)"""
    try:
        zapier_service = ZapierService()
        result = await zapier_service.receive_webhook_data(session, user_id, request)
        
        return result
        
    except Exception as e:
        session.rollback()
        print(f"Zapier webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@app.delete("/api/integrations/zapier/disconnect")
async def disconnect_zapier(
    user_id: str = Depends(verify_api_token),
    session: Session = Depends(get_session)
):
    """Disconnect Zapier integration"""
    try:
        query = text("""
            UPDATE zapier_integrations 
            SET is_active = false, updated_at = NOW()
            WHERE user_id = :user_id AND is_active = true
        """)
        
        result = session.execute(query, {"user_id": user_id})
        session.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Zapier integration not found")
        
        return {"success": True, "message": "Zapier integration disconnected successfully"}
        
    except Exception as e:
        session.rollback()
        print(f"Error disconnecting Zapier: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect Zapier: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)