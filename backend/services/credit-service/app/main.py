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
from common.db import get_async_session, SessionLocal
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
    session: AsyncSession = Depends(get_async_session),
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

@app.get("/api/credits/info")
async def get_credit_info(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Get credit information for the authenticated user"""
    try:
        # Get user's current credit balance and subscription info
        user_query = text("""
            SELECT 
                u.credits, 
                u.current_subscription_id, 
                u.plan,
                COALESCE(s.plan_name, u.plan, 'pack-500') as package_name
            FROM users u
            LEFT JOIN subscriptions s ON u.current_subscription_id = s.id
            WHERE u.id = :user_id
        """)
        user_result = await session.execute(user_query, {"user_id": user_id})
        user_row = user_result.fetchone()
        
        if not user_row:
            # Create default user with 500 credits for pack-500 plan if doesn't exist
            await session.execute(
                text("INSERT INTO users (id, credits, plan) VALUES (:user_id, 500, 'pack-500') ON CONFLICT (id) DO NOTHING"),
                {"user_id": user_id}
            )
            await session.commit()
            current_credits = 500
            subscription_id = None
            package_name = "pack-500"
            print(f"✅ Created new user {user_id} with 500 credits (pack-500 plan)")
        else:
            current_credits = user_row[0] if user_row[0] is not None else 500
            subscription_id = user_row[1]
            package_name = user_row[3] if user_row[3] else "pack-500"
            print(f"📊 User {user_id} has {current_credits} credits")
        
        # Get usage statistics for current month
        try:
            usage_query = text("""
                SELECT 
                    COALESCE(SUM(CASE WHEN change < 0 THEN ABS(change) ELSE 0 END), 0) as used_this_month,
                    COALESCE(SUM(CASE WHEN change < 0 AND DATE(created_at) = CURRENT_DATE THEN ABS(change) ELSE 0 END), 0) as used_today
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

        # Get enrichment statistics
        try:
            stats_query = text("""
                SELECT 
                    COUNT(*) as total_enriched,
                    COALESCE(AVG(CASE WHEN email_found = true THEN 1.0 ELSE 0.0 END) * 100, 0) as email_hit_rate,
                    COALESCE(AVG(CASE WHEN phone_found = true THEN 1.0 ELSE 0.0 END) * 100, 0) as phone_hit_rate,
                    COALESCE(AVG(confidence_score), 0) as avg_confidence,
                    COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as success_rate
                FROM contacts 
                WHERE user_id = :user_id 
                AND enriched = true
            """)
            stats_result = await session.execute(stats_query, {"user_id": user_id})
            stats_row = stats_result.fetchone()
            
            if stats_row:
                total_enriched = int(stats_row[0]) if stats_row[0] else 0
                email_hit_rate = float(stats_row[1]) if stats_row[1] else 0.0
                phone_hit_rate = float(stats_row[2]) if stats_row[2] else 0.0
                avg_confidence = float(stats_row[3]) if stats_row[3] else 0.0
                success_rate = float(stats_row[4]) if stats_row[4] else 0.0
            else:
                total_enriched = email_hit_rate = phone_hit_rate = avg_confidence = success_rate = 0
        except Exception as stats_error:
            print(f"⚠️ Could not fetch enrichment stats: {stats_error}")
            total_enriched = email_hit_rate = phone_hit_rate = avg_confidence = success_rate = 0
        
        # Map plan names to display names
        plan_display_names = {
            "pack-500": "Starter",
            "pack-1000": "Professional", 
            "pack-5000": "Business",
            "pack-10000": "Enterprise",
            "free": "Free",
            "guest": "Guest"
        }
        
        # Set monthly limits based on plan
        monthly_limits = {
            "pack-500": 500,
            "pack-1000": 1000,
            "pack-5000": 5000,
            "pack-10000": 10000,
            "free": 50,
            "guest": 0
        }
        
        display_name = plan_display_names.get(package_name, package_name.title())
        monthly_limit = monthly_limits.get(package_name, 500)
        
        response_data = {
            "balance": current_credits,
            "used_today": used_today,
            "used_this_month": used_this_month,
            "limit_daily": 500,  # Default daily limit
            "limit_monthly": monthly_limit,
            "subscription": {
                "package_name": display_name,
                "monthly_limit": monthly_limit
            },
            "statistics": {
                "total_enriched": total_enriched,
                "email_hit_rate": email_hit_rate,
                "phone_hit_rate": phone_hit_rate,
                "avg_confidence": avg_confidence,
                "success_rate": success_rate
            }
        }
        
        print(f"💳 Credit info response for {user_id}: {response_data}")
        return response_data
        
    except Exception as e:
        print(f"❌ Error fetching credit info for user {user_id}: {e}")
        # Return default values with proper structure if database fails
        return {
            "balance": 500,
            "used_today": 0,
            "used_this_month": 0,
            "limit_daily": 500,
            "limit_monthly": 500,
            "subscription": {
                "package_name": "Starter",
                "monthly_limit": 500
            },
            "statistics": {
                "total_enriched": 0,
                "email_hit_rate": 0.0,
                "phone_hit_rate": 0.0,
                "avg_confidence": 0.0,
                "success_rate": 0.0
            }
        }

# ---- Additional credit endpoints (after /info to avoid route conflicts) ----

@app.get("/api/credits/{user_id}", status_code=status.HTTP_200_OK)
async def get_credit_info_by_id(user_id: str, auth=Depends(verify_api_token)):
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
async def check_and_decrement(data: dict, session: AsyncSession = Depends(get_async_session)):
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

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "credit-service"}
