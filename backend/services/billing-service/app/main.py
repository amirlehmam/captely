# services/billing-service/app/main.py

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, func
from datetime import datetime, timedelta
from typing import List, Optional
import stripe
import uuid

from common.config import get_settings
from common.db import get_async_session
from common.auth import verify_api_token

from app.models import (
    Package, UserSubscription, PaymentMethod, BillingTransaction,
    CreditPackage, User
)
from app.schemas import (
    PackageResponse, SubscriptionCreate, SubscriptionResponse,
    PaymentMethodCreate, PaymentMethodResponse,
    CreditPackagePurchase, BillingResponse
)

# ---- app setup ----

app = FastAPI(
    title="Captely Billing Service",
    description="Handles subscriptions, payments, and credit packages",
    version="1.0.0",
)

settings = get_settings()

# Configure Stripe
stripe.api_key = settings.stripe_secret_key if hasattr(settings, 'stripe_secret_key') else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Package Management ----

@app.get("/api/packages", response_model=List[PackageResponse])
async def get_packages(session: AsyncSession = Depends(get_async_session)):
    """Get all available packages"""
    result = await session.execute(
        select(Package).where(Package.is_active == True).order_by(Package.price_monthly)
    )
    packages = result.scalars().all()
    return packages

@app.get("/api/packages/{package_id}", response_model=PackageResponse)
async def get_package(
    package_id: str,
    session: AsyncSession = Depends(get_async_session)
):
    """Get a specific package by ID"""
    result = await session.execute(
        select(Package).where(Package.id == package_id)
    )
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    return package

# ---- Subscription Management ----

@app.post("/api/subscriptions", response_model=SubscriptionResponse)
async def create_subscription(
    subscription: SubscriptionCreate,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Create a new subscription for a user"""
    # Check if package exists
    package_result = await session.execute(
        select(Package).where(Package.id == subscription.package_id)
    )
    package = package_result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Cancel existing active subscription
    existing_sub = await session.execute(
        select(UserSubscription).where(
            and_(
                UserSubscription.user_id == user_id,
                UserSubscription.status == 'active'
            )
        )
    )
    existing = existing_sub.scalar_one_or_none()
    if existing:
        existing.status = 'cancelled'
        existing.cancelled_at = datetime.utcnow()
        existing.cancel_at_period_end = True
    
    # Calculate subscription periods
    start_date = datetime.utcnow()
    if subscription.billing_cycle == 'monthly':
        end_date = start_date + timedelta(days=30)
    else:
        end_date = start_date + timedelta(days=365)
    
    # Create new subscription
    new_subscription = UserSubscription(
        user_id=user_id,
        package_id=subscription.package_id,
        billing_cycle=subscription.billing_cycle,
        current_period_start=start_date,
        current_period_end=end_date,
        status='active'
    )
    
    # Add trial period for new users
    if subscription.start_trial:
        new_subscription.trial_end = start_date + timedelta(days=14)
    
    session.add(new_subscription)
    
    # Update user's current subscription
    user_result = await session.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if user:
        user.current_subscription_id = new_subscription.id
        # Add monthly credits
        user.credits += package.credits_monthly
    
    await session.commit()
    return new_subscription

@app.get("/api/subscriptions/current", response_model=SubscriptionResponse)
async def get_current_subscription(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Get current subscription for a user"""
    result = await session.execute(
        select(UserSubscription).where(
            and_(
                UserSubscription.user_id == user_id,
                UserSubscription.status.in_(['active', 'trial'])
            )
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")
    return subscription

@app.post("/api/subscriptions/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: str,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Cancel a subscription"""
    result = await session.execute(
        select(UserSubscription).where(
            and_(
                UserSubscription.id == subscription_id,
                UserSubscription.user_id == user_id
            )
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    subscription.cancel_at_period_end = True
    await session.commit()
    
    return {"message": "Subscription will be cancelled at the end of the current period"}

# ---- Payment Methods ----

@app.post("/api/payment-methods", response_model=PaymentMethodResponse)
async def add_payment_method(
    payment_method: PaymentMethodCreate,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Add a payment method for a user"""
    # Create Stripe customer if needed
    if payment_method.provider == 'stripe' and stripe.api_key:
        try:
            # Get or create Stripe customer
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if not user.stripe_customer_id:
                customer = stripe.Customer.create(
                    email=user.email,
                    metadata={'user_id': str(user_id)}
                )
                user.stripe_customer_id = customer.id
            
            # Attach payment method to customer
            stripe.PaymentMethod.attach(
                payment_method.provider_payment_method_id,
                customer=user.stripe_customer_id
            )
            
            # Set as default if requested
            if payment_method.is_default:
                stripe.Customer.modify(
                    user.stripe_customer_id,
                    invoice_settings={
                        'default_payment_method': payment_method.provider_payment_method_id
                    }
                )
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # Save payment method to database
    new_payment_method = PaymentMethod(
        user_id=user_id,
        type=payment_method.type,
        provider=payment_method.provider,
        provider_payment_method_id=payment_method.provider_payment_method_id,
        last_four=payment_method.last_four,
        brand=payment_method.brand,
        is_default=payment_method.is_default
    )
    
    # If setting as default, unset other defaults
    if payment_method.is_default:
        await session.execute(
            select(PaymentMethod).where(
                and_(
                    PaymentMethod.user_id == user_id,
                    PaymentMethod.is_default == True
                )
            ).update({'is_default': False})
        )
    
    session.add(new_payment_method)
    await session.commit()
    
    return new_payment_method

@app.get("/api/payment-methods", response_model=List[PaymentMethodResponse])
async def get_payment_methods(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all payment methods for a user"""
    result = await session.execute(
        select(PaymentMethod).where(PaymentMethod.user_id == user_id)
    )
    methods = result.scalars().all()
    return methods

# ---- Credit Packages ----

@app.get("/api/credit-packages", response_model=List[CreditPackageResponse])
async def get_credit_packages(session: AsyncSession = Depends(get_async_session)):
    """Get all available credit packages"""
    result = await session.execute(
        select(CreditPackage).where(CreditPackage.is_active == True).order_by(CreditPackage.credits)
    )
    packages = result.scalars().all()
    return packages

@app.post("/api/credit-packages/purchase")
async def purchase_credit_package(
    purchase: CreditPackagePurchase,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Purchase a credit package"""
    # Get package
    package_result = await session.execute(
        select(CreditPackage).where(CreditPackage.id == purchase.package_id)
    )
    package = package_result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=404, detail="Credit package not found")
    
    # Get payment method
    payment_result = await session.execute(
        select(PaymentMethod).where(
            and_(
                PaymentMethod.id == purchase.payment_method_id,
                PaymentMethod.user_id == user_id
            )
        )
    )
    payment_method = payment_result.scalar_one_or_none()
    if not payment_method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    # Process payment with Stripe
    if payment_method.provider == 'stripe' and stripe.api_key:
        try:
            # Create payment intent
            intent = stripe.PaymentIntent.create(
                amount=int(package.price * 100),  # Convert to cents
                currency='usd',
                customer=payment_method.provider_customer_id,
                payment_method=payment_method.provider_payment_method_id,
                confirm=True,
                metadata={
                    'user_id': str(user_id),
                    'package_id': str(package.id),
                    'credits': str(package.credits)
                }
            )
            
            # Record transaction
            transaction = BillingTransaction(
                user_id=user_id,
                payment_method_id=payment_method.id,
                type='credit_topup',
                amount=package.price,
                currency='USD',
                status='succeeded',
                provider_transaction_id=intent.id,
                description=f"Purchase of {package.name} - {package.credits} credits"
            )
            session.add(transaction)
            
            # Add credits to user
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                user.credits += package.credits
                user.credits_purchased += package.credits
            
            await session.commit()
            
            return {
                "success": True,
                "credits_added": package.credits,
                "new_balance": user.credits,
                "transaction_id": str(transaction.id)
            }
            
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    raise HTTPException(status_code=400, detail="Payment processing not available")

# ---- Billing History ----

@app.get("/api/billing/history")
async def get_billing_history(
    user_id: str = Depends(verify_api_token),
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_async_session)
):
    """Get billing history for a user"""
    result = await session.execute(
        select(BillingTransaction)
        .where(BillingTransaction.user_id == user_id)
        .order_by(BillingTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    transactions = result.scalars().all()
    
    # Get total count
    count_result = await session.execute(
        select(func.count()).select_from(BillingTransaction)
        .where(BillingTransaction.user_id == user_id)
    )
    total = count_result.scalar()
    
    return {
        "transactions": transactions,
        "total": total,
        "limit": limit,
        "offset": offset
    }

# ---- Webhooks ----

@app.post("/api/webhooks/stripe")
async def stripe_webhook(
    request: dict,
    session: AsyncSession = Depends(get_async_session)
):
    """Handle Stripe webhooks"""
    # Verify webhook signature
    # Process events (payment succeeded, subscription updated, etc.)
    # Update database accordingly
    return {"received": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 