# services/billing-service/app/main.py

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from decimal import Decimal

import stripe
from fastapi import FastAPI, HTTPException, Depends, Request, BackgroundTasks, Header
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine, desc, func
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError
from jose import jwt, JWTError
from pydantic import BaseModel

from models import (
    Base, Package, UserSubscription, CreditBalance, CreditAllocation, 
    EnrichmentHistory, PaymentMethod, BillingTransaction, CreditPackage, User,
    PlanType, BillingCycle, SubscriptionStatus, EnrichmentType, EnrichmentStatus
)
from schemas import (
    PackageResponse, SubscriptionCreate, SubscriptionResponse, CreditUsageResponse,
    PaymentMethodCreate, PaymentMethodResponse, BillingTransactionResponse,
    BillingHistoryResponse, BillingDashboardResponse, CreditPackagePurchase,
    EnrichmentRequest, EnrichmentResult, BillingResponse
)

# ====== CONFIGURATION ======

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

app = FastAPI(
    title="Captely Billing Service",
    description="Production-ready billing service with Stripe integration",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/captely_billing"
)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Security
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "your-secret-key-here")

# ====== DEPENDENCY INJECTION ======

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract user ID from JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        return user_id
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ====== STRIPE UTILITIES ======

class StripeService:
    """Comprehensive Stripe service for billing operations"""
    
    @staticmethod
    def create_customer(email: str, name: str = None, metadata: Dict = None) -> stripe.Customer:
        """Create a Stripe customer"""
        return stripe.Customer.create(
            email=email,
            name=name,
            metadata=metadata or {}
        )
    
    @staticmethod
    def get_or_create_customer(user_id: str, email: str, db: Session) -> str:
        """Get existing or create new Stripe customer"""
        user = db.query(User).filter(User.id == user_id).first()
        
        if user and user.stripe_customer_id:
            return user.stripe_customer_id
        
        # Create new customer
        customer = StripeService.create_customer(
            email=email,
            name=f"User {user_id}",
            metadata={"user_id": user_id}
        )
        
        # Update user record
        if user:
            user.stripe_customer_id = customer.id
        else:
            new_user = User(id=user_id, email=email, stripe_customer_id=customer.id)
            db.add(new_user)
        
        db.commit()
        return customer.id
    
    @staticmethod
    def create_subscription(
        customer_id: str, 
        price_id: str, 
        trial_period_days: int = None,
        default_payment_method: str = None
    ) -> stripe.Subscription:
        """Create a Stripe subscription"""
        params = {
            "customer": customer_id,
            "items": [{"price": price_id}],
            "payment_behavior": "default_incomplete",
            "payment_settings": {"save_default_payment_method": "on_subscription"},
            "expand": ["latest_invoice.payment_intent"],
        }
        
        if trial_period_days:
            params["trial_period_days"] = trial_period_days
        
        if default_payment_method:
            params["default_payment_method"] = default_payment_method
        
        return stripe.Subscription.create(**params)
    
    @staticmethod
    def update_subscription(subscription_id: str, **kwargs) -> stripe.Subscription:
        """Update a Stripe subscription"""
        return stripe.Subscription.modify(subscription_id, **kwargs)
    
    @staticmethod
    def cancel_subscription(subscription_id: str, at_period_end: bool = True) -> stripe.Subscription:
        """Cancel a Stripe subscription"""
        return stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=at_period_end
        )
    
    @staticmethod
    def create_checkout_session(
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        mode: str = "subscription"
    ) -> stripe.checkout.Session:
        """Create a Stripe Checkout session"""
        return stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode=mode,
            success_url=success_url,
            cancel_url=cancel_url
        )
    
    @staticmethod
    def create_customer_portal_session(customer_id: str, return_url: str) -> stripe.billing_portal.Session:
        """Create a customer portal session"""
        return stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url
        )

# ====== CREDIT MANAGEMENT ======

class CreditService:
    """Service for managing user credits"""
    
    @staticmethod
    def get_credit_balance(user_id: str, db: Session) -> CreditBalance:
        """Get user's current credit balance"""
        balance = db.query(CreditBalance).filter(CreditBalance.user_id == user_id).first()
        if not balance:
            balance = CreditBalance(user_id=user_id)
            db.add(balance)
            db.commit()
        return balance
    
    @staticmethod
    def allocate_credits(
        user_id: str, 
        credits: int, 
        source: str, 
        expires_at: datetime,
        db: Session,
        subscription_id: str = None
    ) -> CreditAllocation:
        """Allocate credits to a user"""
        allocation = CreditAllocation(
            user_id=user_id,
            credits_allocated=credits,
            credits_remaining=credits,
            source=source,
            expires_at=expires_at,
            subscription_id=subscription_id
        )
        db.add(allocation)
        
        # Update total balance
        balance = CreditService.get_credit_balance(user_id, db)
        balance.total_credits += credits
        
        db.commit()
        return allocation
    
    @staticmethod
    def consume_credits(user_id: str, credits_needed: int, db: Session) -> bool:
        """Consume credits from user's balance"""
        allocations = db.query(CreditAllocation).filter(
            CreditAllocation.user_id == user_id,
            CreditAllocation.credits_remaining > 0,
            CreditAllocation.expires_at > datetime.utcnow()
        ).order_by(CreditAllocation.expires_at).all()
        
        total_available = sum(a.credits_remaining for a in allocations)
        if total_available < credits_needed:
            return False
        
        # Consume credits from oldest allocations first (FIFO)
        remaining_to_consume = credits_needed
        for allocation in allocations:
            if remaining_to_consume <= 0:
                break
                
            consume_from_this = min(allocation.credits_remaining, remaining_to_consume)
            allocation.credits_remaining -= consume_from_this
            remaining_to_consume -= consume_from_this
        
        # Update balance
        balance = CreditService.get_credit_balance(user_id, db)
        balance.used_credits += credits_needed
        
        db.commit()
        return True

# ====== PACKAGE MANAGEMENT ======

def initialize_packages(db: Session):
    """Initialize default packages if they don't exist"""
    existing_packages = db.query(Package).count()
    if existing_packages > 0:
        return
    
    default_packages = [
        {
            "name": "starter",
            "display_name": "Starter",
            "plan_type": PlanType.starter,
            "credits_monthly": 500,
            "price_monthly": 25.00,
            "price_annual": 240.00,  # 20% discount
            "features": [
                "500 credits per month",
                "Email enrichment",
                "Phone enrichment", 
                "CSV import/export",
                "Chrome extension",
                "Basic support"
            ]
        },
        {
            "name": "pro-1k",
            "display_name": "Pro 1K",
            "plan_type": PlanType.pro,
            "credits_monthly": 1000,
            "price_monthly": 49.00,
            "price_annual": 470.40,  # 20% discount
            "features": [
                "1000 credits per month",
                "All Starter features",
                "Advanced analytics",
                "Priority support",
                "API access",
                "Custom integrations"
            ]
        },
        {
            "name": "pro-3k",
            "display_name": "Pro 3K",
            "plan_type": PlanType.pro,
            "credits_monthly": 3000,
            "price_monthly": 129.00,
            "price_annual": 1238.40,  # 20% discount
            "features": [
                "3000 credits per month",
                "All Pro 1K features",
                "Bulk operations",
                "Advanced filters",
                "CRM integrations",
                "Dedicated support"
            ],
            "popular": True
        },
        {
            "name": "pro-5k",
            "display_name": "Pro 5K",
            "plan_type": PlanType.pro,
            "credits_monthly": 5000,
            "price_monthly": 199.00,
            "price_annual": 1910.40,  # 20% discount
            "features": [
                "5000 credits per month",
                "All Pro 3K features",
                "White-label options",
                "Custom workflows",
                "Team collaboration",
                "Premium support"
            ]
        },
        {
            "name": "enterprise",
            "display_name": "Enterprise",
            "plan_type": PlanType.enterprise,
            "credits_monthly": 0,  # Custom
            "price_monthly": 0.00,  # Custom pricing
            "price_annual": 0.00,
            "features": [
                "Custom credit allocation",
                "All Pro features",
                "SSO integration",
                "Advanced security",
                "Custom SLA",
                "Dedicated account manager"
            ]
        }
    ]
    
    for pkg_data in default_packages:
        package = Package(**pkg_data, features=json.dumps(pkg_data["features"]))
        db.add(package)
    
    db.commit()
    logger.info("Initialized default packages")

# ====== API ENDPOINTS ======

@app.on_event("startup")
async def startup_event():
    """Initialize database and default data"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        initialize_packages(db)
    finally:
        db.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "billing-service", "version": "3.0.0"}

@app.get("/api/health")
async def api_health_check():
    return {"status": "healthy", "service": "billing-service", "version": "3.0.0"}

# ====== PACKAGE ENDPOINTS ======

@app.get("/api/packages", response_model=List[PackageResponse])
async def get_packages(db: Session = Depends(get_db)):
    """Get all available packages"""
    packages = db.query(Package).filter(Package.is_active == True).all()
    return [PackageResponse.model_validate(pkg) for pkg in packages]

@app.get("/api/packages/pro-plans")
async def get_pro_plans(db: Session = Depends(get_db)):
    """Get all Pro plan options"""
    pro_plans = db.query(Package).filter(
        Package.plan_type == PlanType.pro,
        Package.is_active == True
    ).all()
    
    return {
        "plans": [
            {
                "id": str(plan.id),
                "name": plan.display_name,
                "credits_monthly": plan.credits_monthly,
                "price_monthly": plan.price_monthly,
                "price_annual": plan.price_annual,
                "popular": plan.popular
            }
            for plan in pro_plans
        ]
    }

# ====== SUBSCRIPTION ENDPOINTS ======

@app.post("/api/subscriptions/create-checkout")
async def create_subscription_checkout(
    package_id: str,
    billing_cycle: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a Stripe Checkout session for subscription"""
    try:
        # Get package
        package = db.query(Package).filter(Package.id == package_id).first()
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
        
        # Get or create Stripe customer
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        customer_id = StripeService.get_or_create_customer(user_id, user.email, db)
        
        # Create Stripe price if it doesn't exist
        price_amount = int((package.price_annual if billing_cycle == "annual" else package.price_monthly) * 100)
        price_interval = "year" if billing_cycle == "annual" else "month"
        
        stripe_price = stripe.Price.create(
            unit_amount=price_amount,
            currency="eur",
            recurring={"interval": price_interval},
            product_data={
                "name": f"{package.display_name} Plan",
                "description": f"{package.credits_monthly} credits per month"
            },
            metadata={
                "package_id": str(package.id),
                "billing_cycle": billing_cycle
            }
        )
        
        # Create checkout session
        checkout_session = StripeService.create_checkout_session(
            customer_id=customer_id,
            price_id=stripe_price.id,
            success_url="https://captely.com/billing?success=true&session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://captely.com/billing?canceled=true"
        )
        
        return {"checkout_url": checkout_session.url}
        
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@app.get("/api/subscription", response_model=SubscriptionResponse)
async def get_current_subscription(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get current user subscription"""
    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status == SubscriptionStatus.active
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")
    
    return SubscriptionResponse.model_validate(subscription)

@app.post("/api/subscription/cancel")
async def cancel_subscription(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Cancel current subscription"""
    try:
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == SubscriptionStatus.active
        ).first()
        
        if not subscription:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        # Cancel in Stripe
        if subscription.stripe_subscription_id:
            StripeService.cancel_subscription(subscription.stripe_subscription_id)
        
        # Update local record
        subscription.cancel_at_period_end = True
        db.commit()
        
        return {"success": True, "message": "Subscription will be canceled at period end"}
        
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")

# ====== PAYMENT METHOD ENDPOINTS ======

@app.get("/api/payment-methods", response_model=List[PaymentMethodResponse])
async def get_payment_methods(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get user's payment methods"""
    payment_methods = db.query(PaymentMethod).filter(
        PaymentMethod.user_id == user_id
    ).all()
    
    return [PaymentMethodResponse.model_validate(pm) for pm in payment_methods]

@app.post("/api/payment-methods/setup-intent")
async def create_payment_method_setup_intent(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a SetupIntent for adding payment methods"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        customer_id = StripeService.get_or_create_customer(user_id, user.email, db)
        
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
            usage="off_session"
        )
        
        return {
            "client_secret": setup_intent.client_secret,
            "setup_intent_id": setup_intent.id
        }
        
    except Exception as e:
        logger.error(f"Error creating setup intent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create setup intent: {str(e)}")

@app.delete("/api/payment-methods/{payment_method_id}")
async def remove_payment_method(
    payment_method_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Remove a payment method"""
    try:
        payment_method = db.query(PaymentMethod).filter(
            PaymentMethod.id == payment_method_id,
            PaymentMethod.user_id == user_id
        ).first()
        
        if not payment_method:
            raise HTTPException(status_code=404, detail="Payment method not found")
        
        # Detach from Stripe
        stripe.PaymentMethod.detach(payment_method.provider_payment_method_id)
        
        # Remove from database
        db.delete(payment_method)
        db.commit()
        
        return {"success": True, "message": "Payment method removed"}
        
    except Exception as e:
        logger.error(f"Error removing payment method: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove payment method: {str(e)}")

# ====== BILLING DASHBOARD ======

@app.get("/api/billing/dashboard")
async def get_billing_dashboard(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get complete billing dashboard"""
    try:
        # Get current subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == SubscriptionStatus.active
        ).first()
        
        current_plan = None
        if subscription:
            current_plan = PackageResponse.model_validate(subscription.package)
        
        # Get credit usage
        credit_balance = CreditService.get_credit_balance(user_id, db)
        credit_allocations = db.query(CreditAllocation).filter(
            CreditAllocation.user_id == user_id,
            CreditAllocation.expires_at > datetime.utcnow()
        ).all()
        
        credit_usage = {
            "total_credits": credit_balance.total_credits,
            "used_credits": credit_balance.used_credits,
            "remaining_credits": sum(a.credits_remaining for a in credit_allocations),
            "expired_credits": credit_balance.expired_credits,
            "credits_by_month": [
                {
                    "month": allocation.allocated_at.strftime("%b %Y"),
                    "allocated": allocation.credits_allocated,
                    "remaining": allocation.credits_remaining,
                    "expires_at": allocation.expires_at.isoformat()
                }
                for allocation in credit_allocations
            ]
        }
        
        # Get recent transactions
        recent_transactions = db.query(BillingTransaction).filter(
            BillingTransaction.user_id == user_id
        ).order_by(desc(BillingTransaction.created_at)).limit(10).all()
        
        # Get payment methods
        payment_methods = db.query(PaymentMethod).filter(
            PaymentMethod.user_id == user_id
        ).all()
        
        return {
            "current_plan": current_plan,
            "subscription": SubscriptionResponse.model_validate(subscription) if subscription else None,
            "credit_usage": credit_usage,
            "recent_transactions": [BillingTransactionResponse.model_validate(tx) for tx in recent_transactions],
            "payment_methods": [PaymentMethodResponse.model_validate(pm) for pm in payment_methods]
        }
        
    except Exception as e:
        logger.error(f"Error getting billing dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get billing dashboard: {str(e)}")

# ====== CUSTOMER PORTAL ======

@app.post("/api/customer-portal")
async def create_customer_portal_session(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create customer portal session"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.stripe_customer_id:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        portal_session = StripeService.create_customer_portal_session(
            customer_id=user.stripe_customer_id,
            return_url="https://captely.com/billing"
        )
        
        return {"portal_url": portal_session.url}
        
    except Exception as e:
        logger.error(f"Error creating customer portal: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create customer portal: {str(e)}")

# ====== WEBHOOKS ======

@app.post("/api/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="stripe-signature"),
    db: Session = Depends(get_db)
):
    """Handle Stripe webhooks"""
    try:
        payload = await request.body()
        
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, stripe_webhook_secret
        )
        
        # Handle the event
        if event["type"] == "invoice.payment_succeeded":
            await handle_payment_succeeded(event["data"]["object"], db)
        elif event["type"] == "invoice.payment_failed":
            await handle_payment_failed(event["data"]["object"], db)
        elif event["type"] == "customer.subscription.created":
            await handle_subscription_created(event["data"]["object"], db)
        elif event["type"] == "customer.subscription.updated":
            await handle_subscription_updated(event["data"]["object"], db)
        elif event["type"] == "customer.subscription.deleted":
            await handle_subscription_deleted(event["data"]["object"], db)
        elif event["type"] == "setup_intent.succeeded":
            await handle_setup_intent_succeeded(event["data"]["object"], db)
        
        return {"success": True}
        
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

# ====== WEBHOOK HANDLERS ======

async def handle_payment_succeeded(invoice, db: Session):
    """Handle successful payment"""
    try:
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return
        
        # Get subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == subscription_id
        ).first()
        
        if not subscription:
            return
        
        # Allocate credits for the billing period
        package = subscription.package
        expires_at = datetime.fromtimestamp(invoice["period_end"])
        
        CreditService.allocate_credits(
            user_id=subscription.user_id,
            credits=package.credits_monthly,
            source="subscription",
            expires_at=expires_at,
            db=db,
            subscription_id=subscription.id
        )
        
        # Record transaction
        transaction = BillingTransaction(
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            type="subscription",
            amount=invoice["amount_paid"] / 100,  # Convert from cents
            currency=invoice["currency"],
            status="succeeded",
            provider="stripe",
            provider_transaction_id=invoice["id"],
            description=f"Subscription payment for {package.display_name}",
            credits_added=package.credits_monthly
        )
        db.add(transaction)
        db.commit()
        
        logger.info(f"Payment succeeded for subscription {subscription_id}")
        
    except Exception as e:
        logger.error(f"Error handling payment succeeded: {str(e)}")

async def handle_payment_failed(invoice, db: Session):
    """Handle failed payment"""
    try:
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return
        
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == subscription_id
        ).first()
        
        if not subscription:
            return
        
        # Record failed transaction
        transaction = BillingTransaction(
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            type="subscription",
            amount=invoice["amount_due"] / 100,
            currency=invoice["currency"],
            status="failed",
            provider="stripe",
            provider_transaction_id=invoice["id"],
            description=f"Failed subscription payment for {subscription.package.display_name}",
            failure_reason=invoice.get("last_finalization_error", {}).get("message", "Payment failed")
        )
        db.add(transaction)
        db.commit()
        
        logger.warning(f"Payment failed for subscription {subscription_id}")
        
    except Exception as e:
        logger.error(f"Error handling payment failed: {str(e)}")

async def handle_subscription_created(subscription_data, db: Session):
    """Handle subscription creation"""
    try:
        # Get customer and user
        customer = stripe.Customer.retrieve(subscription_data["customer"])
        user_id = customer.metadata.get("user_id")
        
        if not user_id:
            logger.warning("Subscription created without user_id in customer metadata")
            return
        
        # Extract package info from price metadata
        price_id = subscription_data["items"]["data"][0]["price"]["id"]
        price = stripe.Price.retrieve(price_id)
        package_id = price.metadata.get("package_id")
        billing_cycle = price.metadata.get("billing_cycle", "monthly")
        
        if not package_id:
            logger.warning("Subscription created without package_id in price metadata")
            return
        
        # Create subscription record
        new_subscription = UserSubscription(
            user_id=user_id,
            package_id=package_id,
            billing_cycle=BillingCycle(billing_cycle),
            status=SubscriptionStatus.active,
            stripe_subscription_id=subscription_data["id"],
            stripe_customer_id=subscription_data["customer"],
            current_period_start=datetime.fromtimestamp(subscription_data["current_period_start"]),
            current_period_end=datetime.fromtimestamp(subscription_data["current_period_end"])
        )
        
        db.add(new_subscription)
        db.commit()
        
        logger.info(f"Subscription created for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error handling subscription created: {str(e)}")

async def handle_subscription_updated(subscription_data, db: Session):
    """Handle subscription updates"""
    try:
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == subscription_data["id"]
        ).first()
        
        if not subscription:
            return
        
        # Update status and periods
        subscription.status = SubscriptionStatus(subscription_data["status"])
        subscription.current_period_start = datetime.fromtimestamp(subscription_data["current_period_start"])
        subscription.current_period_end = datetime.fromtimestamp(subscription_data["current_period_end"])
        subscription.cancel_at_period_end = subscription_data.get("cancel_at_period_end", False)
        
        if subscription_data.get("canceled_at"):
            subscription.cancelled_at = datetime.fromtimestamp(subscription_data["canceled_at"])
        
        db.commit()
        
        logger.info(f"Subscription updated: {subscription_data['id']}")
        
    except Exception as e:
        logger.error(f"Error handling subscription updated: {str(e)}")

async def handle_subscription_deleted(subscription_data, db: Session):
    """Handle subscription deletion"""
    try:
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == subscription_data["id"]
        ).first()
        
        if not subscription:
            return
        
        subscription.status = SubscriptionStatus.cancelled
        subscription.cancelled_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Subscription deleted: {subscription_data['id']}")
        
    except Exception as e:
        logger.error(f"Error handling subscription deleted: {str(e)}")

async def handle_setup_intent_succeeded(setup_intent, db: Session):
    """Handle successful payment method setup"""
    try:
        customer_id = setup_intent.get("customer")
        payment_method_id = setup_intent.get("payment_method")
        
        if not customer_id or not payment_method_id:
            return
        
        # Get user
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if not user:
            return
        
        # Get payment method details from Stripe
        payment_method = stripe.PaymentMethod.retrieve(payment_method_id)
        
        # Save payment method
        new_pm = PaymentMethod(
            user_id=user.id,
            type="card",
            provider="stripe",
            provider_payment_method_id=payment_method_id,
            provider_customer_id=customer_id,
            last_four=payment_method.card.last4,
            brand=payment_method.card.brand,
            exp_month=payment_method.card.exp_month,
            exp_year=payment_method.card.exp_year,
            is_verified=True
        )
        
        # Set as default if it's the first payment method
        existing_count = db.query(PaymentMethod).filter(PaymentMethod.user_id == user.id).count()
        if existing_count == 0:
            new_pm.is_default = True
        
        db.add(new_pm)
        db.commit()
        
        logger.info(f"Payment method added for user {user.id}")
        
    except Exception as e:
        logger.error(f"Error handling setup intent succeeded: {str(e)}")

# ====== ENRICHMENT ENDPOINTS ======

@app.post("/api/enrichment/process", response_model=EnrichmentResult)
async def process_enrichment(
    request: EnrichmentRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Process enrichment and consume credits"""
    try:
        # Calculate credits needed
        credits_needed = 10 if request.enrichment_type == EnrichmentType.phone else 1
        
        # Check and consume credits
        if not CreditService.consume_credits(user_id, credits_needed, db):
            raise HTTPException(status_code=402, detail="Insufficient credits")
        
        # Record enrichment history
        enrichment = EnrichmentHistory(
            user_id=user_id,
            contact_id=request.contact_id,
            contact_name=request.contact_name,
            contact_email=request.contact_email,
            enrichment_type=request.enrichment_type,
            status=EnrichmentStatus.success,
            source=request.source,
            result_data="example@email.com" if request.enrichment_type == EnrichmentType.email else "+33123456789",
            credits_used=credits_needed,
            batch_id=request.batch_id
        )
        db.add(enrichment)
        db.commit()
        
        return EnrichmentResult(
            success=True,
            credits_used=credits_needed,
            result_data=enrichment.result_data,
            status=EnrichmentStatus.success,
            message="Enrichment completed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing enrichment: {str(e)}")
        raise HTTPException(status_code=500, detail="Enrichment processing failed")

# ====== BILLING HISTORY ======

@app.get("/api/billing/history", response_model=BillingHistoryResponse)
async def get_billing_history(
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get billing transaction history"""
    transactions = db.query(BillingTransaction).filter(
        BillingTransaction.user_id == user_id
    ).order_by(desc(BillingTransaction.created_at)).offset(offset).limit(limit).all()
    
    total = db.query(BillingTransaction).filter(
        BillingTransaction.user_id == user_id
    ).count()
    
    return BillingHistoryResponse(
        transactions=[BillingTransactionResponse.model_validate(tx) for tx in transactions],
        total=total,
        limit=limit,
        offset=offset
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 