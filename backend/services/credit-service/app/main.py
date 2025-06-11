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
        print(f"🔍 Getting credit info for user {user_id}")
        
        # Get user's subscription info for plan details
        subscription_query = text("""
            SELECT 
                p.name as package_name,
                p.credits_monthly,
                p.display_name,
                us.status as subscription_status
            FROM user_subscriptions us
            LEFT JOIN packages p ON p.id = us.package_id
            WHERE us.user_id = :user_id AND us.status = 'active'
            ORDER BY us.created_at DESC
            LIMIT 1
        """)
        subscription_result = await session.execute(subscription_query, {"user_id": user_id})
        subscription_row = subscription_result.fetchone()
        
        # Get TOTAL allocated credits and remaining credits from allocations
        allocation_query = text("""
            SELECT 
                COALESCE(SUM(credits_allocated), 0) as total_allocated,
                COALESCE(SUM(credits_remaining), 0) as total_remaining
            FROM credit_allocations 
            WHERE user_id = :user_id AND expires_at > CURRENT_TIMESTAMP
        """)
        allocation_result = await session.execute(allocation_query, {"user_id": user_id})
        allocation_row = allocation_result.fetchone()
        
        if allocation_row:
            total_credits = int(allocation_row[0]) if allocation_row[0] else 500
            remaining_credits = int(allocation_row[1]) if allocation_row[1] else 500
            used_credits = total_credits - remaining_credits
        else:
            # Fallback: check old users table and create allocations
            print(f"❌ No credit allocations found for user {user_id}, checking fallback")
            fallback_query = text("""
                SELECT credits, COALESCE(plan, 'pack-500') as plan
                FROM users 
                WHERE id = :user_id
            """)
            fallback_result = await session.execute(fallback_query, {"user_id": user_id})
            fallback_row = fallback_result.fetchone()
            
            if fallback_row and fallback_row[0] is not None:
                remaining_credits = int(fallback_row[0])
                total_credits = 500  # Default starter plan
                used_credits = total_credits - remaining_credits
                print(f"📊 User {user_id} (fallback): {remaining_credits} remaining of {total_credits}")
            else:
                # Create default allocation if user doesn't exist
                total_credits = 500
                remaining_credits = 500
                used_credits = 0
                
                # Create default credit allocation
                await session.execute(
                    text("""
                        INSERT INTO credit_allocations (user_id, credits_allocated, credits_remaining, expires_at, source, billing_cycle)
                        VALUES (:user_id, 500, 500, CURRENT_TIMESTAMP + INTERVAL '30 days', 'starter_plan', 'monthly')
                        ON CONFLICT DO NOTHING
                    """),
                    {"user_id": user_id}
                )
                await session.commit()
                print(f"✅ Created default allocation for user {user_id}: 500 credits")
        
        # Get today's usage from credit_logs
        try:
            today_usage_query = text("""
                SELECT COALESCE(SUM(CASE WHEN change < 0 THEN ABS(change) ELSE 0 END), 0) as used_today
                FROM credit_logs 
                WHERE user_id = :user_id 
                AND DATE(created_at) = CURRENT_DATE
            """)
            today_result = await session.execute(today_usage_query, {"user_id": user_id})
            today_row = today_result.fetchone()
            used_today = int(today_row[0]) if today_row and today_row[0] else 0
        except Exception as usage_error:
            print(f"⚠️ Could not fetch today's usage: {usage_error}")
            used_today = 0

        # Get enrichment statistics
        try:
            stats_query = text("""
                SELECT 
                    COUNT(*) as total_enriched,
                    COALESCE(AVG(CASE WHEN email IS NOT NULL AND email != '' THEN 1.0 ELSE 0.0 END) * 100, 0) as email_hit_rate,
                    COALESCE(AVG(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1.0 ELSE 0.0 END) * 100, 0) as phone_hit_rate
                FROM contacts 
                WHERE job_id IN (
                    SELECT id FROM import_jobs WHERE user_id = :user_id
                )
            """)
            stats_result = await session.execute(stats_query, {"user_id": user_id})
            stats_row = stats_result.fetchone()
            
            if stats_row and stats_row[0] is not None:
                total_enriched = int(stats_row[0])
                email_hit_rate = float(stats_row[1]) if stats_row[1] else 0.0
                phone_hit_rate = float(stats_row[2]) if stats_row[2] else 0.0
            else:
                total_enriched = 0
                email_hit_rate = 0.0
                phone_hit_rate = 0.0
        except Exception as stats_error:
            print(f"⚠️ Could not fetch enrichment stats: {stats_error}")
            total_enriched = 0
            email_hit_rate = 0.0
            phone_hit_rate = 0.0
        
        # Determine plan info
        if subscription_row:
            package_name = subscription_row[0] or "starter"
            monthly_limit = subscription_row[1] or 500
            display_name = subscription_row[2] or "Starter"
        else:
            # Default plan info
            package_name = "starter"
            monthly_limit = 500
            display_name = "Starter"
        
        # Calculate percentage correctly
        usage_percentage = (used_credits / total_credits * 100) if total_credits > 0 else 0
        
        response_data = {
            "balance": remaining_credits,
            "used_today": used_today,
            "used_this_month": used_credits,  # Total used from allocations
            "limit_daily": 500,
            "limit_monthly": monthly_limit,
            "subscription": {
                "package_name": display_name,
                "monthly_limit": monthly_limit
            },
            "statistics": {
                "total_enriched": total_enriched,
                "email_hit_rate": email_hit_rate,
                "phone_hit_rate": phone_hit_rate,
                "avg_confidence": 75.0,
                "success_rate": email_hit_rate
            },
            # Add debug info for verification
            "debug": {
                "total_allocated": total_credits,
                "used_credits": used_credits,
                "remaining_credits": remaining_credits,
                "usage_percentage": round(usage_percentage, 1)
            }
        }
        
        print(f"💳 Credit info for {user_id}:")
        print(f"   📊 Total: {total_credits}, Used: {used_credits}, Remaining: {remaining_credits}")
        print(f"   📈 Usage: {usage_percentage:.1f}%")
        print(f"   🔄 Math check: {used_credits} + {remaining_credits} = {used_credits + remaining_credits} (should equal {total_credits})")
        
        return response_data
        
    except Exception as e:
        print(f"❌ Error fetching credit info for user {user_id}: {e}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        # Return safe defaults
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
    
    try:
        print(f"🔍 Credit deduction request: {count} credits for user {user_id}")
        
        # Check available credits from credit_allocations (NEW BILLING SYSTEM)
        available_query = text("""
            SELECT COALESCE(SUM(credits_remaining), 0) as available_credits
            FROM credit_allocations 
            WHERE user_id = :user_id AND expires_at > CURRENT_TIMESTAMP
        """)
        available_result = await session.execute(available_query, {"user_id": user_id})
        available_credits = available_result.scalar() or 0
        
        print(f"💳 Available credits: {available_credits}")
        
        if available_credits < count:
            print(f"❌ Insufficient credits: need {count}, have {available_credits}")
            raise HTTPException(402, f"Not enough credits. Available: {available_credits}, Required: {count}")
        
        # Deduct credits from allocations (FIFO - oldest expiration first)
        remaining_to_deduct = count
        deduction_query = text("""
            SELECT id, credits_remaining, expires_at
            FROM credit_allocations 
            WHERE user_id = :user_id AND credits_remaining > 0 AND expires_at > CURRENT_TIMESTAMP
            ORDER BY expires_at ASC
        """)
        allocations_result = await session.execute(deduction_query, {"user_id": user_id})
        allocations = allocations_result.fetchall()
        
        for allocation in allocations:
            if remaining_to_deduct <= 0:
                break
                
            allocation_id, credits_remaining, expires_at = allocation
            deduct_from_this = min(remaining_to_deduct, credits_remaining)
            
            # Update the allocation
            update_query = text("""
                UPDATE credit_allocations 
                SET credits_remaining = credits_remaining - :deduct_amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :allocation_id
            """)
            await session.execute(update_query, {
                "deduct_amount": deduct_from_this,
                "allocation_id": allocation_id
            })
            
            remaining_to_deduct -= deduct_from_this
            print(f"💰 Deducted {deduct_from_this} from allocation {allocation_id}")
        
        # Log the transaction in credit_logs
        log_query = text("""
            INSERT INTO credit_logs (user_id, operation_type, cost, change, reason, created_at)
            VALUES (:user_id, 'enrichment', :cost, :change, :reason, CURRENT_TIMESTAMP)
        """)
        await session.execute(log_query, {
            "user_id": user_id,
            "operation_type": "enrichment",
            "cost": count,
            "change": -count,
            "reason": "Credit deduction via API"
        })
        
        # Update used_credits in credit_balances
        balance_update_query = text("""
            UPDATE credit_balances 
            SET used_credits = used_credits + :credits_used,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = :user_id
        """)
        await session.execute(balance_update_query, {
            "credits_used": count,
            "user_id": user_id
        })
        
        await session.commit()
        
        # Calculate remaining credits
        remaining_credits = available_credits - count
        print(f"✅ Successfully deducted {count} credits. Remaining: {remaining_credits}")
        
        return {"ok": True, "remaining": remaining_credits, "deducted": count}
        
    except HTTPException:
        await session.rollback()
        raise
    except Exception as e:
        await session.rollback()
        print(f"❌ Credit deduction error: {e}")
        raise HTTPException(500, f"Credit deduction failed: {str(e)}")

app.include_router(router)

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "credit-service"}
