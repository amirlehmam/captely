# services/credit-service/app/main.py

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, APIRouter, Header
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import uuid, io, boto3
from sqlalchemy import insert, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from common.config import get_settings
from common.db import get_session, SessionLocal
from common.celery_app import celery_app
from common.auth import verify_api_token

from app.models import ImportJob, User, CreditLog  # your SQLAlchemy models
from app.credit_service import CreditService

# ---- app setup ----

app = FastAPI(
    title="Captely Import & Credit Service",
    description="Handles CSV/Excel imports, enqueues enrichment tasks, and provides credit info.",
    version="1.0.0",
)

settings = get_settings()

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://localhost:8001",
    "http://localhost:8002",
    "http://localhost:8003",
    "http://localhost:8004",
    "http://localhost:8005",
    "http://localhost:8006",
    # add any other origins (e.g. production hostname) here
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,           # allow cookies/auth headers
    allow_methods=["*"],              # GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],              # allow any request headers
)

# S3 client (if AWS credentials are available)
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

# JWT auth via HTTPBearer
security = HTTPBearer()

# ---- import endpoint ----

@app.post("/api/imports/file", status_code=status.HTTP_201_CREATED)
async def import_file(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_api_token),
    session = Depends(get_session),
):
    """
    1) Read CSV or Excel; 
    2) record job in ImportJob; 
    3) enqueue a Celery task per row; 
    4) upload raw file to S3.
    """
    data = await file.read()
    if file.filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(data))
    else:
        df = pd.read_excel(io.BytesIO(data))

    missing = [c for c in ("first_name","company") if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing columns: {', '.join(missing)}"
        )

    job_id = str(uuid.uuid4())
    await session.execute(
        insert(ImportJob).values(id=job_id, user_id=user_id, total=df.shape[0])
    )
    await session.commit()

    # enqueue each row
    for _, row in df.iterrows():
        celery_app.send_task(
            # match the name you gave in enrichment-worker/tasks.py
            "enrichment_worker.tasks.enrich_contact",
            args=[row.to_dict(), job_id, user_id],
        )

    # upload raw file if S3 is available
    if s3 and hasattr(settings, 's3_bucket_raw'):
        key = f"{user_id}/{job_id}/{file.filename}"
        s3.upload_fileobj(io.BytesIO(data), settings.s3_bucket_raw, key)

    return JSONResponse({"job_id": job_id})

# ---- credit endpoint ----

credit_service = CreditService(name="Captely Credit Service")

@app.get("/api/credits/{user_id}", status_code=status.HTTP_200_OK)
async def get_credit_info(user_id: str, auth=Depends(verify_api_token)):
    """
    Return credit info for a given user_id.
    Note: we depend on verify_api_token above so only valid tokens can query.
    """
    return await credit_service.get_credit_info(user_id)

@app.get("/api/credits/{user_id}/balance", status_code=status.HTTP_200_OK)
async def get_credit_balance(user_id: str, auth=Depends(verify_api_token)):
    """
    Return credit balance for a given user_id (frontend expects this endpoint).
    Simple standalone implementation without async session issues.
    """
    try:
        # Use sync session for simplicity
        session = SessionLocal()
        
        # Get user directly from database  
        result = session.execute(text("SELECT credits FROM users WHERE id = :user_id"), {"user_id": user_id})
        user_credits = result.scalar()
        
        session.close()
        
        if user_credits is None:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "balance": user_credits or 0,
            "used_today": 0,  # Simplified for now
            "limit_daily": 1000,  # Default limit
            "limit_monthly": 30000  # Default limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

router = APIRouter(prefix="/api/credits")

@router.post("/check_and_decrement")
async def check_and_decrement(data: dict, session: AsyncSession = Depends(get_session)):
    user_id = data.get("user_id")
    count = int(data.get("count", 0))
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.credits < count:
        raise HTTPException(402, "Not enough credits")
    user.credits -= count
    session.add(CreditLog(user_id=user_id, change=-count, reason="enrichment"))
    await session.commit()
    return {"ok": True, "remaining": user.credits}

app.include_router(router)

@app.get("/api/credits/info")
async def get_credit_info(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Get credit information for the authenticated user"""
    try:
        # Get user's current credit balance - Use sync queries to avoid async issues
        user_query = text("SELECT credits, current_subscription_id FROM users WHERE id = :user_id")
        user_result = await session.execute(user_query, {"user_id": user_id})
        user_row = user_result.fetchone()
        
        if not user_row:
            # Create default user with 5000 credits if doesn't exist
            await session.execute(
                text("INSERT INTO users (id, credits) VALUES (:user_id, 5000) ON CONFLICT (id) DO NOTHING"),
                {"user_id": user_id}
            )
            await session.commit()
            current_credits = 5000
            subscription_id = None
            print(f"✅ Created new user {user_id} with 5000 credits")
        else:
            current_credits = user_row[0] if user_row[0] is not None else 5000
            subscription_id = user_row[1]
            print(f"📊 User {user_id} has {current_credits} credits")
        
        # Get usage statistics for current month
        try:
            usage_query = text("""
                SELECT 
                    COALESCE(SUM(CASE WHEN change < 0 THEN ABS(change) ELSE 0 END), 0) as used_this_month,
                    COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as used_today
                FROM credit_logs 
                WHERE user_id = :user_id 
                AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
            """)
            usage_result = await session.execute(usage_query, {"user_id": user_id})
            usage_row = usage_result.fetchone()
            
            used_this_month = int(usage_row[0]) if usage_row and usage_row[0] else 0
            used_today = int(usage_row[1]) if usage_row and usage_row[1] else 0
        except Exception as usage_error:
            print(f"⚠️ Could not fetch usage stats: {usage_error}")
            used_this_month = 0
            used_today = 0
        
        response_data = {
            "balance": current_credits,
            "used_today": used_today,
            "used_this_month": used_this_month,
            "limit_daily": None,
            "limit_monthly": 5000,
            "subscription": subscription_id
        }
        
        print(f"💳 Credit info response for {user_id}: {response_data}")
        return response_data
        
    except Exception as e:
        print(f"❌ Error fetching credit info for user {user_id}: {e}")
        # Return default values if database fails
        return {
            "balance": 5000,
            "used_today": 0,
            "used_this_month": 0,
            "limit_daily": None,
            "limit_monthly": 5000,
            "subscription": None
        }

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "credit-service"}
