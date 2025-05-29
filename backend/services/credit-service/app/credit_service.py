# credit_service.py

from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, func

from common.db import get_session
from app.models import User, CreditLog

class CreditService:
    def __init__(self, name: str = "Credit Service"):
        self.name = name
        self._cache = {}  # Simple in-memory cache
        
    async def check_credits(
        self, 
        user_id: str, 
        required_credits: int,
        provider: Optional[str] = None,
        session: AsyncSession = None
    ) -> Tuple[bool, str, Dict]:
        """
        Check if user has enough credits
        Returns: (has_credits, reason, details)
        """
        if not session:
            async with get_session() as session:
                return await self._check_credits_internal(
                    user_id, required_credits, provider, session
                )
        return await self._check_credits_internal(
            user_id, required_credits, provider, session
        )
    
    async def _check_credits_internal(
        self,
        user_id: str,
        required_credits: int,
        provider: Optional[str],
        session: AsyncSession
    ) -> Tuple[bool, str, Dict]:
        # Get user
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            return False, "User not found", {}
        
        # Check basic credit balance
        if user.credits < required_credits:
            return False, "Insufficient credits", {
                "current_balance": user.credits,
                "required": required_credits
            }
        
        # Check daily usage limit (simplified)
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        daily_used = await session.execute(
            select(func.sum(CreditLog.change)).where(
                and_(
                    CreditLog.user_id == user_id,
                    CreditLog.created_at >= today_start,
                    CreditLog.change < 0  # Only count deductions
                )
            )
        )
        daily_total = abs(daily_used.scalar() or 0)
        
        # Simple daily limit based on plan
        daily_limits = {
            "free": 50,
            "starter": 500,
            "professional": 2000,
            "enterprise": 10000
        }
        daily_limit = daily_limits.get(user.plan, 50)
        
        if daily_total + required_credits > daily_limit:
            return False, "Daily enrichment limit exceeded", {
                "daily_limit": daily_limit,
                "daily_used": daily_total,
                "remaining_today": max(0, daily_limit - daily_total)
            }
        
        return True, "Credits available", {
            "current_balance": user.credits,
            "will_remain": user.credits - required_credits
        }
    
    async def deduct_credits(
        self,
        user_id: str,
        amount: int,
        reason: str = "enrichment",
        provider: Optional[str] = None,
        job_id: Optional[str] = None,
        session: AsyncSession = None
    ) -> bool:
        """Deduct credits from user account and log the transaction"""
        if not session:
            async with get_session() as session:
                return await self._deduct_credits_internal(
                    user_id, amount, reason, provider, job_id, session
                )
        return await self._deduct_credits_internal(
            user_id, amount, reason, provider, job_id, session
        )
    
    async def _deduct_credits_internal(
        self,
        user_id: str,
        amount: int,
        reason: str,
        provider: Optional[str],
        job_id: Optional[str],
        session: AsyncSession
    ) -> bool:
        # Get user
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user or user.credits < amount:
            return False
        
        # Deduct credits
        user.credits -= amount
        
        # Log transaction
        credit_log = CreditLog(
            user_id=user_id,
            change=-amount,  # negative for deduction
            reason=f"{reason} - {provider}" if provider else reason,
            job_id=job_id
        )
        
        session.add(credit_log)
        await session.commit()
        
        # Clear cache
        self._cache.pop(user_id, None)
        
        return True
    
    async def add_credits(
        self,
        user_id: str,
        amount: int,
        reason: str = "topup",
        session: AsyncSession = None
    ) -> bool:
        """Add credits to user account"""
        if not session:
            async with get_session() as session:
                return await self._add_credits_internal(
                    user_id, amount, reason, session
                )
        return await self._add_credits_internal(
            user_id, amount, reason, session
        )
    
    async def _add_credits_internal(
        self,
        user_id: str,
        amount: int,
        reason: str,
        session: AsyncSession
    ) -> bool:
        # Get user
        user_result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            return False
        
        # Add credits
        user.credits += amount
        
        # Log transaction
        credit_log = CreditLog(
            user_id=user_id,
            change=amount,  # positive for addition
            reason=reason
        )
        
        session.add(credit_log)
        await session.commit()
        
        # Clear cache
        self._cache.pop(user_id, None)
        
        return True
    
    async def get_credit_info(self, user_id: str) -> Dict:
        """Get comprehensive credit information for a user"""
        async with get_session() as session:
            # Get user
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if not user:
                return {"error": "User not found"}
            
            # Get usage stats
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Daily usage
            daily_usage = await session.execute(
                select(func.sum(CreditLog.change)).where(
                    and_(
                        CreditLog.user_id == user_id,
                        CreditLog.created_at >= today_start,
                        CreditLog.change < 0
                    )
                )
            )
            
            # Monthly usage
            monthly_usage = await session.execute(
                select(func.sum(CreditLog.change)).where(
                    and_(
                        CreditLog.user_id == user_id,
                        CreditLog.created_at >= month_start,
                        CreditLog.change < 0
                    )
                )
            )
            
            # Recent transactions
            recent_logs = await session.execute(
                select(CreditLog).where(
                    CreditLog.user_id == user_id
                ).order_by(CreditLog.created_at.desc()).limit(10)
            )
            
            return {
                "balance": user.credits,
                "plan": user.plan,
                "usage": {
                    "daily": abs(daily_usage.scalar() or 0),
                    "monthly": abs(monthly_usage.scalar() or 0)
                },
                "recent_transactions": [
                    {
                        "amount": log.change,
                        "reason": log.reason,
                        "created_at": log.created_at.isoformat()
                    } for log in recent_logs.scalars()
                ]
            }

# Example usage
if __name__ == "__main__":
    service = CreditService(name="Captely Credit Service")
    print("Credit Service initialized")
