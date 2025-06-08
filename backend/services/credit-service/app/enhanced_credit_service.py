"""
Enhanced Credit Management Service for Captely
Tracks credit consumption per provider and implements intelligent limits
"""
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import insert, update, func
from datetime import datetime, timedelta
import httpx
from jose import jwt, JWTError

from common.config import get_settings
from common.db import get_session
from common.utils import logger

app = FastAPI(
    title="Captely Enhanced Credit Service",
    description="Advanced credit management with provider tracking and smart limits",
    version="2.0.0"
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

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return user ID"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Pydantic models
class CreditCheckRequest(BaseModel):
    user_id: str
    provider: str
    operation_type: str = "enrichment"  # enrichment, verification, export
    estimated_cost: float = 1.0

class CreditConsumptionRequest(BaseModel):
    user_id: str
    contact_id: int
    provider: str
    operation_type: str
    cost: float
    success: bool = True
    details: Optional[Dict] = None

class CreditTopUpRequest(BaseModel):
    user_id: str
    amount: int
    payment_method: str = "stripe"
    transaction_id: Optional[str] = None

class CreditLimitRequest(BaseModel):
    user_id: str
    daily_limit: Optional[int] = None
    monthly_limit: Optional[int] = None
    provider_limits: Optional[Dict[str, int]] = None

# Provider costs per operation
PROVIDER_COSTS = {
    'icypeas': {'enrichment': 0.05, 'verification': 0.01},
    'dropcontact': {'enrichment': 0.08, 'verification': 0.02},
    'hunter': {'enrichment': 0.20, 'verification': 0.05},
    'apollo': {'enrichment': 0.40, 'verification': 0.10},
}

@app.post("/api/credits/check")
async def check_credits_before_operation(
    request: CreditCheckRequest,
    session: AsyncSession = Depends(get_session)
):
    """Check if user has enough credits for an operation"""
    
    # Get user's current credits
    query = """
        SELECT credits, daily_limit, monthly_limit, provider_limits 
        FROM users WHERE id = :user_id
    """
    result = await session.execute(query, {"user_id": request.user_id})
    user_data = result.fetchone()
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_credits = user_data[0]
    daily_limit = user_data[1] or float('inf')
    monthly_limit = user_data[2] or float('inf')
    provider_limits = user_data[3] or {}
    
    # Calculate estimated cost
    provider_cost = PROVIDER_COSTS.get(request.provider, {}).get(request.operation_type, 1.0)
    estimated_cost = provider_cost * request.estimated_cost
    
    # Check basic credit availability
    if current_credits < estimated_cost:
        return {
            "allowed": False,
            "reason": "insufficient_credits",
            "current_credits": current_credits,
            "required_credits": estimated_cost,
            "deficit": estimated_cost - current_credits
        }
    
    # Check daily limit
    today = datetime.now().date()
    daily_usage_query = """
        SELECT COALESCE(SUM(cost), 0) FROM credit_logs 
        WHERE user_id = :user_id AND DATE(created_at) = :today
    """
    daily_result = await session.execute(daily_usage_query, {
        "user_id": request.user_id, 
        "today": today
    })
    daily_usage = daily_result.scalar() or 0
    
    if daily_usage + estimated_cost > daily_limit:
        return {
            "allowed": False,
            "reason": "daily_limit_exceeded",
            "daily_usage": daily_usage,
            "daily_limit": daily_limit,
            "would_exceed_by": (daily_usage + estimated_cost) - daily_limit
        }
    
    # Check monthly limit
    month_start = datetime.now().replace(day=1).date()
    monthly_usage_query = """
        SELECT COALESCE(SUM(cost), 0) FROM credit_logs 
        WHERE user_id = :user_id AND DATE(created_at) >= :month_start
    """
    monthly_result = await session.execute(monthly_usage_query, {
        "user_id": request.user_id,
        "month_start": month_start
    })
    monthly_usage = monthly_result.scalar() or 0
    
    if monthly_usage + estimated_cost > monthly_limit:
        return {
            "allowed": False,
            "reason": "monthly_limit_exceeded",
            "monthly_usage": monthly_usage,
            "monthly_limit": monthly_limit,
            "would_exceed_by": (monthly_usage + estimated_cost) - monthly_limit
        }
    
    # Check provider-specific limits
    provider_limit = provider_limits.get(request.provider, float('inf'))
    provider_usage_query = """
        SELECT COALESCE(SUM(cost), 0) FROM credit_logs 
        WHERE user_id = :user_id AND provider = :provider AND DATE(created_at) >= :month_start
    """
    provider_result = await session.execute(provider_usage_query, {
        "user_id": request.user_id,
        "provider": request.provider,
        "month_start": month_start
    })
    provider_usage = provider_result.scalar() or 0
    
    if provider_usage + estimated_cost > provider_limit:
        return {
            "allowed": False,
            "reason": "provider_limit_exceeded",
            "provider": request.provider,
            "provider_usage": provider_usage,
            "provider_limit": provider_limit,
            "would_exceed_by": (provider_usage + estimated_cost) - provider_limit
        }
    
    return {
        "allowed": True,
        "estimated_cost": estimated_cost,
        "remaining_credits": current_credits - estimated_cost,
        "daily_remaining": daily_limit - daily_usage,
        "monthly_remaining": monthly_limit - monthly_usage,
        "provider_remaining": provider_limit - provider_usage
    }

@app.post("/api/credits/consume")
async def consume_credits(
    request: CreditConsumptionRequest,
    session: AsyncSession = Depends(get_session)
):
    """Record credit consumption after an operation"""
    
    # Deduct credits from user
    update_credits_query = """
        UPDATE users SET 
            credits = credits - :cost,
            total_spent = total_spent + :cost,
            updated_at = :updated_at
        WHERE id = :user_id
    """
    await session.execute(update_credits_query, {
        "cost": request.cost,
        "user_id": request.user_id,
        "updated_at": datetime.now()
    })
    
    # Log the transaction
    log_entry = {
        "user_id": request.user_id,
        "contact_id": request.contact_id,
        "provider": request.provider,
        "operation_type": request.operation_type,
        "cost": request.cost,
        "success": request.success,
        "details": request.details or {},
        "created_at": datetime.now()
    }
    
    await session.execute(
        insert(CreditLog).values(**log_entry)
    )
    
    # Update contact with credits consumed
    update_contact_query = """
        UPDATE contacts SET 
            credits_consumed = credits_consumed + :cost,
            updated_at = :updated_at
        WHERE id = :contact_id
    """
    await session.execute(update_contact_query, {
        "cost": request.cost,
        "contact_id": request.contact_id,
        "updated_at": datetime.now()
    })
    
    await session.commit()
    
    # Get updated user credits
    user_query = "SELECT credits FROM users WHERE id = :user_id"
    result = await session.execute(user_query, {"user_id": request.user_id})
    remaining_credits = result.scalar()
    
    logger.info(f"Credits consumed: {request.cost} for user {request.user_id}, remaining: {remaining_credits}")
    
    return {
        "success": True,
        "consumed": request.cost,
        "remaining_credits": remaining_credits,
        "transaction_logged": True
    }

@app.get("/api/credits/{user_id}/balance")
async def get_credit_balance(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    auth_user: str = Depends(verify_jwt)
):
    """Get detailed credit balance and usage statistics"""
    
    # Basic user info
    user_query = """
        SELECT credits, daily_limit, monthly_limit, provider_limits, total_spent, created_at
        FROM users WHERE id = :user_id
    """
    result = await session.execute(user_query, {"user_id": user_id})
    user_data = result.fetchone()
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Daily usage
    today = datetime.now().date()
    daily_usage_query = """
        SELECT COALESCE(SUM(cost), 0), COUNT(*) FROM credit_logs 
        WHERE user_id = :user_id AND DATE(created_at) = :today
    """
    daily_result = await session.execute(daily_usage_query, {
        "user_id": user_id, 
        "today": today
    })
    daily_usage, daily_operations = daily_result.fetchone()
    
    # Monthly usage
    month_start = datetime.now().replace(day=1).date()
    monthly_usage_query = """
        SELECT COALESCE(SUM(cost), 0), COUNT(*) FROM credit_logs 
        WHERE user_id = :user_id AND DATE(created_at) >= :month_start
    """
    monthly_result = await session.execute(monthly_usage_query, {
        "user_id": user_id,
        "month_start": month_start
    })
    monthly_usage, monthly_operations = monthly_result.fetchone()
    
    # Provider breakdown
    provider_usage_query = """
        SELECT provider, SUM(cost), COUNT(*) FROM credit_logs 
        WHERE user_id = :user_id AND DATE(created_at) >= :month_start
        GROUP BY provider
    """
    provider_result = await session.execute(provider_usage_query, {
        "user_id": user_id,
        "month_start": month_start
    })
    provider_breakdown = {
        row[0]: {"cost": row[1], "operations": row[2]} 
        for row in provider_result.fetchall()
    }
    
    return {
        "user_id": user_id,
        "current_credits": user_data[0],
        "total_spent": user_data[4] or 0,
        "member_since": user_data[5],
        "limits": {
            "daily": user_data[1],
            "monthly": user_data[2],
            "providers": user_data[3] or {}
        },
        "usage": {
            "today": {
                "cost": daily_usage or 0,
                "operations": daily_operations or 0
            },
            "this_month": {
                "cost": monthly_usage or 0,
                "operations": monthly_operations or 0
            },
            "by_provider": provider_breakdown
        }
    }

@app.post("/api/credits/{user_id}/topup")
async def topup_credits(
    user_id: str,
    request: CreditTopUpRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    auth_user: str = Depends(verify_jwt)
):
    """Add credits to user account"""
    
    # Update user credits
    topup_query = """
        UPDATE users SET 
            credits = credits + :amount,
            updated_at = :updated_at
        WHERE id = :user_id
    """
    await session.execute(topup_query, {
        "amount": request.amount,
        "user_id": user_id,
        "updated_at": datetime.now()
    })
    
    # Log the topup
    log_entry = {
        "user_id": user_id,
        "operation_type": "topup",
        "cost": -request.amount,  # Negative cost for credit addition
        "success": True,
        "details": {
            "payment_method": request.payment_method,
            "transaction_id": request.transaction_id
        },
        "created_at": datetime.now()
    }
    
    await session.execute(
        insert(CreditLog).values(**log_entry)
    )
    
    await session.commit()
    
    # Send notification email in background
    background_tasks.add_task(send_topup_notification, user_id, request.amount)
    
    return {
        "success": True,
        "added_credits": request.amount,
        "transaction_id": request.transaction_id
    }

@app.post("/api/credits/{user_id}/limits")
async def set_credit_limits(
    user_id: str,
    request: CreditLimitRequest,
    session: AsyncSession = Depends(get_session),
    auth_user: str = Depends(verify_jwt)
):
    """Set credit limits for a user"""
    
    limits_query = """
        UPDATE users SET 
            daily_limit = :daily_limit,
            monthly_limit = :monthly_limit,
            provider_limits = :provider_limits,
            updated_at = :updated_at
        WHERE id = :user_id
    """
    
    await session.execute(limits_query, {
        "daily_limit": request.daily_limit,
        "monthly_limit": request.monthly_limit,
        "provider_limits": request.provider_limits,
        "user_id": user_id,
        "updated_at": datetime.now()
    })
    
    await session.commit()
    
    return {
        "success": True,
        "limits_updated": {
            "daily": request.daily_limit,
            "monthly": request.monthly_limit,
            "providers": request.provider_limits
        }
    }

@app.get("/api/credits/{user_id}/history")
async def get_credit_history(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    provider: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    auth_user: str = Depends(verify_jwt)
):
    """Get credit usage history"""
    
    base_query = """
        SELECT cl.*, c.first_name, c.last_name, c.company, c.email
        FROM credit_logs cl
        LEFT JOIN contacts c ON cl.contact_id = c.id
        WHERE cl.user_id = :user_id
    """
    params = {"user_id": user_id}
    
    if provider:
        base_query += " AND cl.provider = :provider"
        params["provider"] = provider
    
    base_query += " ORDER BY cl.created_at DESC LIMIT :limit OFFSET :offset"
    params.update({"limit": limit, "offset": offset})
    
    result = await session.execute(base_query, params)
    
    history = []
    for row in result.fetchall():
        history.append({
            "id": row[0],
            "contact_id": row[2],
            "provider": row[3],
            "operation_type": row[4],
            "cost": row[5],
            "success": row[6],
            "details": row[7],
            "created_at": row[8],
            "contact": {
                "name": f"{row[9] or ''} {row[10] or ''}".strip(),
                "company": row[11],
                "email": row[12]
            } if row[9] or row[10] else None
        })
    
    return {
        "history": history,
        "pagination": {
            "limit": limit,
            "offset": offset,
            "has_more": len(history) == limit
        }
    }

async def send_topup_notification(user_id: str, amount: int):
    """Send email notification for credit topup"""
    # Implementation for sending email notification
    logger.info(f"Sending topup notification to user {user_id} for {amount} credits")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 