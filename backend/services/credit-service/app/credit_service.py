# credit_service.py

from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, func

from common.db import get_session
from app.models import User, CreditLog, UserSubscription, Package

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
        Check if user has enough credits and is within limits
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
        
        # Get user's current subscription
        if user.current_subscription_id:
            sub_result = await session.execute(
                select(UserSubscription, Package).join(Package).where(
                    UserSubscription.id == user.current_subscription_id
                )
            )
            result = sub_result.first()
            if result:
                subscription, package = result
                
                # Check package limits
                limits = package.limits or {}
                
                # Check daily enrichment limit
                today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
                daily_used = await session.execute(
                    select(func.sum(CreditLog.cost)).where(
                        and_(
                            CreditLog.user_id == user_id,
                            CreditLog.created_at >= today_start,
                            CreditLog.operation_type == 'enrichment'
                        )
                    )
                )
                daily_total = daily_used.scalar() or 0
                
                daily_limit = limits.get('daily_enrichment', float('inf'))
                if daily_total + required_credits > daily_limit:
                    return False, "Daily enrichment limit exceeded", {
                        "daily_limit": daily_limit,
                        "daily_used": daily_total,
                        "remaining_today": max(0, daily_limit - daily_total)
                    }
                
                # Check provider-specific limits
                if provider and provider in limits:
                    provider_limit = limits[provider]
                    if provider_limit == 0:
                        return False, f"{provider} not available in your plan", {
                            "plan": package.display_name,
                            "upgrade_required": True
                        }
                    
                    # Check monthly provider usage
                    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    provider_used = await session.execute(
                        select(func.sum(CreditLog.cost)).where(
                            and_(
                                CreditLog.user_id == user_id,
                                CreditLog.provider == provider,
                                CreditLog.created_at >= month_start
                            )
                        )
                    )
                    provider_total = provider_used.scalar() or 0
                    
                    if provider_total + required_credits > provider_limit:
                        return False, f"Monthly {provider} limit exceeded", {
                            "provider": provider,
                            "monthly_limit": provider_limit,
                            "monthly_used": provider_total,
                            "remaining_this_month": max(0, provider_limit - provider_total)
                        }
        
        return True, "Credits available", {
            "current_balance": user.credits,
            "will_remain": user.credits - required_credits
        }
    
    async def deduct_credits(
        self,
        user_id: str,
        amount: int,
        operation_type: str = "enrichment",
        provider: Optional[str] = None,
        contact_id: Optional[int] = None,
        details: Optional[Dict] = None,
        session: AsyncSession = None
    ) -> bool:
        """Deduct credits from user account and log the transaction"""
        if not session:
            async with get_session() as session:
                return await self._deduct_credits_internal(
                    user_id, amount, operation_type, provider, contact_id, details, session
                )
        return await self._deduct_credits_internal(
            user_id, amount, operation_type, provider, contact_id, details, session
        )
    
    async def _deduct_credits_internal(
        self,
        user_id: str,
        amount: int,
        operation_type: str,
        provider: Optional[str],
        contact_id: Optional[int],
        details: Optional[Dict],
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
        user.total_spent += amount
        
        # Log transaction
        credit_log = CreditLog(
            user_id=user_id,
            contact_id=contact_id,
            provider=provider,
            operation_type=operation_type,
            cost=amount,
            success=True,
            details=details or {}
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
            
            # Get subscription info
            subscription_info = None
            if user.current_subscription_id:
                sub_result = await session.execute(
                    select(UserSubscription, Package).join(Package).where(
                        UserSubscription.id == user.current_subscription_id
                    )
                )
                result = sub_result.first()
                if result:
                    subscription, package = result
                    subscription_info = {
                        "package_name": package.display_name,
                        "status": subscription.status,
                        "billing_cycle": subscription.billing_cycle,
                        "current_period_end": subscription.current_period_end.isoformat(),
                        "credits_monthly": package.credits_monthly,
                        "features": package.features,
                        "limits": package.limits
                    }
            
            # Get usage stats
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # Daily usage
            daily_usage = await session.execute(
                select(func.sum(CreditLog.cost)).where(
                    and_(
                        CreditLog.user_id == user_id,
                        CreditLog.created_at >= today_start
                    )
                )
            )
            
            # Monthly usage
            monthly_usage = await session.execute(
                select(func.sum(CreditLog.cost)).where(
                    and_(
                        CreditLog.user_id == user_id,
                        CreditLog.created_at >= month_start
                    )
                )
            )
            
            # Provider breakdown
            provider_usage = await session.execute(
                select(
                    CreditLog.provider,
                    func.sum(CreditLog.cost).label('total')
                ).where(
                    and_(
                        CreditLog.user_id == user_id,
                        CreditLog.created_at >= month_start,
                        CreditLog.provider.isnot(None)
                    )
                ).group_by(CreditLog.provider)
            )
            
            return {
                "balance": user.credits,
                "total_spent": user.total_spent,
                "credits_purchased": user.credits_purchased,
                "subscription": subscription_info,
                "usage": {
                    "daily": daily_usage.scalar() or 0,
                    "monthly": monthly_usage.scalar() or 0,
                    "by_provider": {
                        row.provider: row.total 
                        for row in provider_usage
                    }
                }
            }

# Example usage
if __name__ == "__main__":
    service = CreditService(name="Captely Credit Service")
    result = service.process_credit_application(user_id=12345)
    print(result)
