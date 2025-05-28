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
from sqlalchemy import insert, select
import pandas as pd
import uuid, io, boto3, httpx

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
