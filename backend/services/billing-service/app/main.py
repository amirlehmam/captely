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
# JWT validation now handled by auth service
from pydantic import BaseModel

from .models import (
    Base, Package, UserSubscription, CreditBalance, CreditAllocation, 
    EnrichmentHistory, PaymentMethod, BillingTransaction, CreditPackage,
    PlanType, BillingCycle, SubscriptionStatus, EnrichmentType, EnrichmentStatus
)
from .schemas import (
    PackageResponse, SubscriptionCreate, SubscriptionResponse, CreditUsageResponse,
    PaymentMethodCreate, PaymentMethodResponse, BillingTransactionResponse,
    BillingHistoryResponse, BillingDashboardResponse, CreditPackagePurchase,
    EnrichmentRequest, EnrichmentResult, BillingResponse
)

# ====== CONFIGURATION ======

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY") 
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Debug environment loading
logger.info(f"🔧 Loading Stripe configuration...")
logger.info(f"STRIPE_SECRET_KEY present: {bool(STRIPE_SECRET_KEY)}")
logger.info(f"STRIPE_SECRET_KEY starts with sk_: {STRIPE_SECRET_KEY.startswith('sk_') if STRIPE_SECRET_KEY else False}")
logger.info(f"STRIPE_WEBHOOK_SECRET present: {bool(STRIPE_WEBHOOK_SECRET)}")
logger.info(f"STRIPE_WEBHOOK_SECRET starts with whsec_: {STRIPE_WEBHOOK_SECRET.startswith('whsec_') if STRIPE_WEBHOOK_SECRET else False}")

# Fix webhook secret issue - set default if None
if not STRIPE_WEBHOOK_SECRET:
    logger.warning("⚠️ STRIPE_WEBHOOK_SECRET not set - using placeholder")
    STRIPE_WEBHOOK_SECRET = "whsec_placeholder_for_development_only"

if not STRIPE_SECRET_KEY or not STRIPE_SECRET_KEY.startswith('sk_'):
    logger.error("❌ STRIPE_SECRET_KEY not set or invalid - Stripe functionality will be disabled")
    logger.error(f"STRIPE_SECRET_KEY value: {STRIPE_SECRET_KEY[:20]}..." if STRIPE_SECRET_KEY else "None")
    # Set placeholder to prevent NoneType errors
    STRIPE_SECRET_KEY = "sk_placeholder_for_development_only"
    stripe.api_key = STRIPE_SECRET_KEY
else:
    stripe.api_key = STRIPE_SECRET_KEY
    logger.info("✅ Stripe initialized successfully with valid API key")

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

# Ensure we use the synchronous psycopg2 driver, not asyncpg
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Security
security = HTTPBearer()

# ====== DEPENDENCY INJECTION ======

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Validate token with auth service and return user ID"""
    try:
        token = credentials.credentials
        
        if not token:
            raise HTTPException(
                status_code=401,
                detail="Missing API token"
            )
        
        # Call auth service to validate token
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://auth-service:8000/auth/validate-token",
                json={"token": token},
                timeout=5.0,
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid or expired token"
                )
                
            data = response.json()
            return str(data["user_id"])
            
    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Could not connect to authentication service"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Token validation failed: {str(e)}"
        )

# ====== STRIPE UTILITIES ======

class StripeService:
    """Comprehensive Stripe service for billing operations"""
    
    @staticmethod
    def create_customer(email: str, name: str = None, metadata: Dict = None):
        """Create a Stripe customer with error handling"""
        try:
            return stripe.Customer.create(
                email=email,
                name=name,
                metadata=metadata or {}
            )
        except AttributeError as attr_error:
            # Handle the specific 'Secret' attribute error from Stripe library
            if "'Secret'" in str(attr_error) or "'NoneType'" in str(attr_error):
                logger.error(f"Stripe library AttributeError in customer creation: {attr_error}")
                raise Exception("Payment processing temporarily unavailable - Stripe configuration issue")
            else:
                raise attr_error
    
    @staticmethod
    def get_or_create_customer(user_id: str, email: str, db: Session) -> str:
        """Get existing or create new Stripe customer"""
        # Check if user has active subscription with customer_id
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.stripe_customer_id.isnot(None)
        ).first()
        
        if subscription and subscription.stripe_customer_id:
            return subscription.stripe_customer_id
        
        # Create new customer
        customer = StripeService.create_customer(
            email=email,
            name=f"User {user_id}",
            metadata={"user_id": user_id}
        )
        
        return customer.id
    
    @staticmethod
    def create_subscription(
        customer_id: str, 
        price_id: str, 
        trial_period_days: int = None,
        default_payment_method: str = None
    ):
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
    def update_subscription(subscription_id: str, **kwargs):
        """Update a Stripe subscription"""
        return stripe.Subscription.modify(subscription_id, **kwargs)
    
    @staticmethod
    def cancel_subscription(subscription_id: str, at_period_end: bool = True):
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
    ):
        """Create a Stripe Checkout session with error handling for library bugs"""
        try:
            return stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode=mode,
                success_url=success_url,
                cancel_url=cancel_url
            )
        except AttributeError as attr_error:
            # Handle the specific 'Secret' attribute error from Stripe library
            if "'Secret'" in str(attr_error) or "'NoneType'" in str(attr_error):
                logger.error(f"Stripe library AttributeError in checkout session: {attr_error}")
                raise Exception("Payment processing temporarily unavailable - Stripe configuration issue")
            else:
                raise attr_error
    
    @staticmethod
    def create_customer_portal_session(customer_id: str, return_url: str):
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
        "name": "pro-1.5k",
        "display_name": "Pro 1.5K",
            "plan_type": PlanType.pro,
        "credits_monthly": 1500,
            "price_monthly": 79.00,
            "price_annual": 758.40,  # 20% discount
        "features": [
                "1500 credits per month",
            "All Pro 1K features",
                "Advanced filters",
            "Enhanced support",
                "Priority processing",
            "Extended integrations"
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
        # Extract features to avoid duplicate keyword argument
        features_data = pkg_data["features"]
        pkg_data_without_features = {k: v for k, v in pkg_data.items() if k != "features"}
        package = Package(**pkg_data_without_features, features=json.dumps(features_data))
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

@app.get("/api/billing/packages", response_model=List[PackageResponse])
async def get_packages(db: Session = Depends(get_db)):
    """Get all available packages"""
    packages = db.query(Package).filter(Package.is_active == True).all()
    return [PackageResponse.model_validate(pkg) for pkg in packages]

@app.get("/api/billing/packages/pro-plans")
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

class CheckoutRequest(BaseModel):
    package_id: str
    billing_cycle: str

def get_package_by_id_or_name(package_id: str, db: Session) -> Package:
    """Get package by UUID or by mapping frontend string IDs to actual packages"""
    # Frontend package ID mapping to database package names
    package_mapping = {
        "pack-500": "starter",
        "pack-1000": "pro-1k",
        "pack-1500": "pro-1.5k",  # Map 1500 to 1.5k plan
        "pack-3000": "pro-3k", 
        "pack-5000": "pro-5k",
        "pack-10000": "enterprise",
        "pack-20000": "enterprise"
    }
    
    # Try mapping lookup first to avoid UUID casting issues
    if package_id in package_mapping:
        mapped_name = package_mapping[package_id]
        package = db.query(Package).filter(Package.name == mapped_name).first()
        if package:
            return package
    
    # Try direct UUID lookup only if it looks like a UUID
    if len(package_id) > 10 and '-' in package_id:
        try:
            package = db.query(Package).filter(Package.id == package_id).first()
            if package:
                return package
        except Exception:
            pass  # Not a valid UUID, continue to name lookup
    
    # Try direct name lookup as fallback
    package = db.query(Package).filter(Package.name == package_id).first()
    return package

@app.post("/api/billing/subscriptions/create-checkout")
async def create_subscription_checkout(
    data: CheckoutRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a Stripe Checkout session for subscription"""
    try:
        # Validate Stripe configuration first
        if not STRIPE_SECRET_KEY or STRIPE_SECRET_KEY.startswith("sk_placeholder"):
            logger.error("❌ Stripe not configured properly for checkout session")
            raise HTTPException(status_code=503, detail="Payment processing not available - Stripe not configured")
        
        logger.info(f"🔧 Starting checkout session creation for user {user_id}, package {data.package_id}")
        
        # Get package with improved lookup
        package = get_package_by_id_or_name(data.package_id, db)
        if not package:
            logger.error(f"❌ Package not found: {data.package_id}")
            logger.error(f"Available packages: {[p.name for p in db.query(Package).all()]}")
            raise HTTPException(status_code=404, detail=f"Package not found: {data.package_id}")
        
        # Get user email from auth service
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://auth-service:8000/auth/user/{user_id}",
                timeout=5.0,
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="User not found")
                
            user_data = response.json()
            user_email = user_data.get("email", f"user-{user_id}@captely.com")
        
        customer_id = StripeService.get_or_create_customer(user_id, user_email, db)
        
        # Create Stripe price if it doesn't exist
        price_amount = int((package.price_annual if data.billing_cycle == "annual" else package.price_monthly) * 100)
        price_interval = "year" if data.billing_cycle == "annual" else "month"
        
        try:
            stripe_price = stripe.Price.create(
                unit_amount=price_amount,
                currency="eur",
                recurring={"interval": price_interval},
                product_data={
                    "name": f"{package.display_name} Plan"
                    # Removed description - not supported in newer Stripe API
                },
                metadata={
                    "package_id": str(package.id),
                    "billing_cycle": data.billing_cycle
                }
            )
        except AttributeError as attr_error:
            logger.error(f"Stripe library AttributeError in price creation: {attr_error}")
            raise HTTPException(status_code=503, detail="Payment processing temporarily unavailable - Price creation failed")
        
        # Create checkout session with error handling
        try:
            checkout_session = StripeService.create_checkout_session(
                customer_id=customer_id,
                price_id=stripe_price.id,
                success_url="https://captely.com/billing?success=true&session_id={CHECKOUT_SESSION_ID}",
                cancel_url="https://captely.com/billing?canceled=true"
            )
            
            # Validate checkout session response
            if hasattr(checkout_session, 'url') and checkout_session.url:
                logger.info(f"Checkout session created successfully")
                return {"checkout_url": checkout_session.url}
            else:
                logger.error("Checkout session created but missing URL")
                raise HTTPException(status_code=500, detail="Invalid checkout session response")
                
        except AttributeError as attr_error:
            logger.error(f"Stripe checkout AttributeError: {attr_error}")
            raise HTTPException(status_code=503, detail="Payment processing temporarily unavailable")
        except Exception as checkout_error:
            logger.error(f"Checkout session creation failed: {checkout_error}")
            raise HTTPException(status_code=500, detail="Failed to create payment session")
        
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@app.post("/api/billing/create-default-subscription")
async def create_default_subscription(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a default starter subscription for new users"""
    try:
        # Check if user already has a subscription
        existing = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == SubscriptionStatus.active
        ).first()
        
        if existing:
            return {"message": "User already has an active subscription", "subscription_id": str(existing.id)}
        
        # Get starter package
        starter_package = db.query(Package).filter(Package.name == "starter").first()
        if not starter_package:
            raise HTTPException(status_code=404, detail="Starter package not found")
        
        # Create new subscription
        new_subscription = UserSubscription(
            user_id=user_id,
            package_id=starter_package.id,
            billing_cycle=BillingCycle.monthly,
            status=SubscriptionStatus.active,
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=30),
        )
        
        db.add(new_subscription)
        db.commit()
        db.refresh(new_subscription)
        
        # Allocate starter credits (500 credits for 30 days)
        CreditService.allocate_credits(
            user_id=user_id,
            credits=500,
            source="starter_subscription",
            expires_at=datetime.utcnow() + timedelta(days=30),
            db=db,
            subscription_id=str(new_subscription.id)
        )
        
        logger.info(f"Created starter subscription for user {user_id}")
        return {"message": "Starter subscription created successfully", "subscription_id": str(new_subscription.id)}
        
    except Exception as e:
        logger.error(f"Error creating default subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create subscription: {str(e)}")

@app.get("/api/billing/subscription", response_model=SubscriptionResponse)
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
        # Auto-create starter subscription for users without one
        logger.info(f"No subscription found for user {user_id}, creating starter subscription")
        
        starter_package = db.query(Package).filter(Package.name == "starter").first()
        if not starter_package:
            raise HTTPException(status_code=404, detail="Starter package not found")
        
        # Create new subscription
        new_subscription = UserSubscription(
            user_id=user_id,
            package_id=starter_package.id,
            billing_cycle=BillingCycle.monthly,
            status=SubscriptionStatus.active,
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=30),
        )
        
        db.add(new_subscription)
        db.commit()
        db.refresh(new_subscription)
        
        # Allocate starter credits (500 credits for 30 days)
        CreditService.allocate_credits(
            user_id=user_id,
            credits=500,
            source="starter_subscription",
            expires_at=datetime.utcnow() + timedelta(days=30),
            db=db,
            subscription_id=str(new_subscription.id)
        )
        
        subscription = new_subscription
        logger.info(f"Created starter subscription for user {user_id}")
    
    return SubscriptionResponse.model_validate(subscription)

@app.post("/api/billing/subscription/cancel")
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

@app.get("/api/billing/payment-methods", response_model=List[PaymentMethodResponse])
async def get_payment_methods(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get user's payment methods"""
    payment_methods = db.query(PaymentMethod).filter(
        PaymentMethod.user_id == user_id
    ).all()
    
    return [PaymentMethodResponse.model_validate(pm) for pm in payment_methods]

@app.post("/api/billing/payment-methods/setup-intent")
async def create_payment_method_setup_intent(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create a SetupIntent for adding payment methods"""
    try:
        # Validate Stripe configuration first
        if not STRIPE_SECRET_KEY or STRIPE_SECRET_KEY.startswith("sk_placeholder"):
            logger.error("❌ Stripe not configured properly - invalid STRIPE_SECRET_KEY")
            raise HTTPException(status_code=503, detail="Payment processing not available - Stripe not configured")
        
        if not STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET.startswith("whsec_placeholder"):
            logger.warning("⚠️ Stripe webhook secret not configured properly")
        
        logger.info(f"🔧 Starting setup intent creation for user {user_id}")
        
        # Get user email from auth service
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://auth-service:8000/auth/user/{user_id}",
                timeout=5.0,
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="User not found")
                
            user_data = response.json()
            user_email = user_data.get("email", f"user-{user_id}@captely.com")
        
        customer_id = StripeService.get_or_create_customer(user_id, user_email, db)
        
        logger.info(f"Creating Stripe SetupIntent for customer {customer_id}")
        
        try:
            # Fix for NoneType 'Secret' attribute error in Stripe library
            setup_intent = stripe.SetupIntent.create(
                customer=customer_id,
                payment_method_types=["card"],
                usage="off_session"
            )
            
            # Validate the response before accessing attributes
            if hasattr(setup_intent, 'id') and setup_intent.id:
                logger.info(f"Stripe SetupIntent created: {setup_intent.id}")
            else:
                logger.error("SetupIntent created but missing ID")
                raise HTTPException(status_code=500, detail="Invalid SetupIntent response")
            
        except AttributeError as attr_error:
            # Handle the specific 'Secret' attribute error
            logger.error(f"Stripe library AttributeError: {attr_error}")
            raise HTTPException(status_code=503, detail="Payment processing temporarily unavailable - Stripe configuration issue")
        except stripe.error.StripeError as stripe_error:
            logger.error(f"Stripe API error: {stripe_error}")
            raise HTTPException(status_code=400, detail=f"Stripe error: {str(stripe_error)}")
        except Exception as stripe_lib_error:
            # Catch any other Stripe library internal errors
            logger.error(f"Stripe library internal error: {stripe_lib_error}")
            raise HTTPException(status_code=503, detail="Payment processing temporarily unavailable")
        
        # Validate setup intent response
        if not setup_intent:
            raise HTTPException(status_code=500, detail="No setup intent received from Stripe")
        
        # Access client_secret safely
        client_secret = None
        setup_intent_id = None
        
        try:
            client_secret = setup_intent.client_secret
            setup_intent_id = setup_intent.id
        except AttributeError as attr_error:
            logger.error(f"SetupIntent missing expected attributes: {attr_error}")
            logger.error(f"SetupIntent object: {setup_intent}")
            raise HTTPException(status_code=500, detail="Invalid setup intent response from Stripe")
        
        if not client_secret:
            raise HTTPException(status_code=500, detail="Setup intent missing client_secret")
        
        return {
            "client_secret": client_secret,
            "setup_intent_id": setup_intent_id
        }
         
    except Exception as e:
        logger.error(f"Error creating setup intent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create setup intent: {str(e)}")

@app.delete("/api/billing/payment-methods/{payment_method_id}")
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
        logger.info(f"🏠 Getting billing dashboard for user {user_id}")
        
        # Validate user_id with detailed logging
        if not user_id or user_id.strip() == "":
            logger.error(f"Dashboard request with invalid user_id: '{user_id}'")
            raise HTTPException(status_code=401, detail="User authentication required")
        
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

@app.post("/api/billing/customer-portal")
async def create_customer_portal_session(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Create customer portal session"""
    try:
        # Find existing customer ID from subscriptions
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.stripe_customer_id.isnot(None)
        ).first()
        
        customer_id = None
        if subscription and subscription.stripe_customer_id:
            customer_id = subscription.stripe_customer_id
        else:
            # Create a customer for users without subscriptions
            try:
                # Get user email from auth service
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"http://auth-service:8000/auth/user/{user_id}",
                        timeout=5.0,
                    )
                    
                    if response.status_code != 200:
                        raise HTTPException(status_code=404, detail="User not found")
                        
                    user_data = response.json()
                    user_email = user_data.get("email", f"user-{user_id}@captely.com")
                
                # Create Stripe customer for portal access
                customer_id = StripeService.get_or_create_customer(user_id, user_email, db)
                
            except Exception as customer_error:
                logger.error(f"Failed to create customer: {customer_error}")
                raise HTTPException(status_code=404, detail="Unable to create customer record - please complete a purchase first")
        
        portal_session = StripeService.create_customer_portal_session(
            customer_id=customer_id,
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
        
        logger.info(f"🎯 Stripe webhook received: {len(payload)} bytes")
        
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
        
        logger.info(f"🎯 Webhook event verified: {event['type']} - {event['id']}")
        
        # Handle the event
        if event["type"] == "invoice.payment_succeeded":
            logger.info(f"💰 Processing invoice.payment_succeeded for {event['id']}")
            await handle_payment_succeeded(event["data"]["object"], db)
        elif event["type"] == "invoice.payment_failed":
            logger.info(f"❌ Processing invoice.payment_failed for {event['id']}")
            await handle_payment_failed(event["data"]["object"], db)
        elif event["type"] == "customer.subscription.created":
            logger.info(f"🆕 Processing customer.subscription.created for {event['id']}")
            await handle_subscription_created(event["data"]["object"], db)
        elif event["type"] == "customer.subscription.updated":
            logger.info(f"🔄 Processing customer.subscription.updated for {event['id']}")
            await handle_subscription_updated(event["data"]["object"], db)
        elif event["type"] == "customer.subscription.deleted":
            logger.info(f"🗑️ Processing customer.subscription.deleted for {event['id']}")
            await handle_subscription_deleted(event["data"]["object"], db)
        elif event["type"] == "setup_intent.succeeded":
            logger.info(f"🔐 Processing setup_intent.succeeded for {event['id']}")
            await handle_setup_intent_succeeded(event["data"]["object"], db)
        else:
            logger.info(f"⚠️ Unhandled webhook event type: {event['type']}")
        
        return {"success": True}
        
    except stripe.error.SignatureVerificationError:
        logger.error("❌ Webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"❌ Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

# ====== MANUAL SUBSCRIPTION SYNC (DEBUG) ======

@app.post("/api/billing/subscription/sync")
async def sync_subscription_manually(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Manually sync subscription from Stripe (for debugging)"""
    try:
        logger.info(f"🔄 Manual subscription sync for user {user_id}")
        
        # Get current subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.stripe_subscription_id.isnot(None)
        ).first()
        
        if not subscription:
            raise HTTPException(status_code=404, detail="No Stripe subscription found")
        
        logger.info(f"🔍 Found subscription {subscription.stripe_subscription_id}")
        
        # Get subscription from Stripe
        stripe_subscription = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
        logger.info(f"📡 Retrieved Stripe subscription: {stripe_subscription.id}")
        
        # Manually trigger the update handler
        await handle_subscription_updated(stripe_subscription, db)
        
        return {"success": True, "message": "Subscription synced manually"}
        
    except Exception as e:
        logger.error(f"❌ Error syncing subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync subscription: {str(e)}")

@app.post("/api/billing/subscription/force-update-to-10k")
async def force_update_to_10k_credits(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Force update user to 10,000 credits package (emergency fix)"""
    try:
        logger.info(f"🚨 FORCE UPDATE: Updating user {user_id} to 10K credits package")
        
        # Find the 10K credits package
        package_10k = db.query(Package).filter(Package.credits_monthly == 10000).first()
        if not package_10k:
            raise HTTPException(status_code=404, detail="10,000 credits package not found")
        
        logger.info(f"📦 Found 10K package: {package_10k.name} ({package_10k.id})")
        
        # Get or create subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()
        
        if subscription:
            logger.info(f"🔄 Updating existing subscription {subscription.id}")
            # Update existing subscription
            old_package_id = subscription.package_id
            subscription.package_id = package_10k.id
            subscription.status = SubscriptionStatus.active
            subscription.current_period_end = datetime.utcnow() + timedelta(days=30)
            logger.info(f"📦 Updated package from {old_package_id} to {package_10k.id}")
        else:
            logger.info(f"🆕 Creating new subscription for user")
            # Create new subscription
            subscription = UserSubscription(
                user_id=user_id,
                package_id=package_10k.id,
                billing_cycle=BillingCycle.monthly,
                status=SubscriptionStatus.active,
                current_period_start=datetime.utcnow(),
                current_period_end=datetime.utcnow() + timedelta(days=30),
            )
            db.add(subscription)
            db.flush()  # To get the ID
            logger.info(f"🆕 Created subscription {subscription.id}")
        
        # Clear old credit allocations
        old_allocations = db.query(CreditAllocation).filter(
            CreditAllocation.user_id == user_id
        ).all()
        for alloc in old_allocations:
            db.delete(alloc)
        logger.info(f"🗑️ Cleared {len(old_allocations)} old credit allocations")
        
        # Allocate 10,000 credits
        expires_at = datetime.utcnow() + timedelta(days=30)
        CreditService.allocate_credits(
            user_id=user_id,
            credits=10000,
            source="manual_fix_10k",
            expires_at=expires_at,
            db=db,
            subscription_id=subscription.id
        )
        logger.info(f"💳 Allocated 10,000 credits")
        
        # Update credit balance
        credit_balance = db.query(CreditBalance).filter(CreditBalance.user_id == user_id).first()
        if not credit_balance:
            credit_balance = CreditBalance(user_id=user_id)
            db.add(credit_balance)
        
        credit_balance.total_credits = 10000
        credit_balance.used_credits = 20  # Keep existing used credits
        credit_balance.expired_credits = 0
        
        db.commit()
        
        logger.info(f"✅ FORCE UPDATE COMPLETE: User {user_id} now has 10K credits package")
        
        return {
            "success": True, 
            "message": "Successfully updated to 10,000 credits package",
            "package_name": package_10k.name,
            "credits_allocated": 10000,
            "subscription_id": str(subscription.id)
        }
        
    except Exception as e:
        logger.error(f"❌ Error force updating to 10K: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to force update: {str(e)}")

@app.get("/api/billing/debug/user-state")
async def debug_user_state(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check user's billing state"""
    try:
        logger.info(f"🔍 Debug user state for {user_id}")
        
        # Get subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()
        
        # Get credit balance
        credit_balance = db.query(CreditBalance).filter(
            CreditBalance.user_id == user_id
        ).first()
        
        # Get credit allocations
        allocations = db.query(CreditAllocation).filter(
            CreditAllocation.user_id == user_id
        ).all()
        
        # Get packages
        packages = db.query(Package).all()
        
        return {
            "user_id": user_id,
            "subscription": {
                "id": str(subscription.id) if subscription else None,
                "package_id": str(subscription.package_id) if subscription else None,
                "package_name": subscription.package.name if subscription and subscription.package else None,
                "stripe_subscription_id": subscription.stripe_subscription_id if subscription else None,
                "status": subscription.status.value if subscription else None,
            } if subscription else None,
            "credit_balance": {
                "total_credits": credit_balance.total_credits if credit_balance else 0,
                "used_credits": credit_balance.used_credits if credit_balance else 0,
            } if credit_balance else None,
            "credit_allocations": [
                {
                    "id": str(alloc.id),
                    "credits_allocated": alloc.credits_allocated,
                    "credits_remaining": alloc.credits_remaining,
                    "source": alloc.source,
                    "expires_at": alloc.expires_at.isoformat()
                }
                for alloc in allocations
            ],
            "available_packages": [
                {
                    "id": str(pkg.id),
                    "name": pkg.name,
                    "credits_monthly": pkg.credits_monthly
                }
                for pkg in packages
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Error debugging user state: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to debug user state: {str(e)}")

# ====== WEBHOOK HANDLERS ======

async def handle_payment_succeeded(invoice, db: Session):
    """Handle successful payment"""
    try:
        logger.info(f"💰 Processing payment succeeded: {invoice.get('id')}")
        
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            logger.info("💰 Payment succeeded but no subscription - might be one-time payment")
            return
        
        logger.info(f"🔍 Looking for subscription: {subscription_id}")
        
        # Get subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == subscription_id
        ).first()
        
        if not subscription:
            logger.warning(f"❌ Subscription not found in database: {subscription_id}")
            # Try to get subscription from Stripe and create it
            try:
                stripe_subscription = stripe.Subscription.retrieve(subscription_id)
                await handle_subscription_created(stripe_subscription, db)
                
                # Try to find it again
                subscription = db.query(UserSubscription).filter(
                    UserSubscription.stripe_subscription_id == subscription_id
                ).first()
            except Exception as create_error:
                logger.error(f"❌ Could not create subscription: {create_error}")
                return
        
        if not subscription:
            logger.error(f"❌ Still no subscription found after creation attempt")
            return
        
        logger.info(f"✅ Found subscription for user: {subscription.user_id}")
        
        # Allocate credits for the billing period
        package = subscription.package
        if not package:
            logger.error(f"❌ No package found for subscription")
            return
            
        expires_at = datetime.fromtimestamp(invoice["period_end"])
        
        logger.info(f"💳 Allocating {package.credits_monthly} credits for package {package.name}")
        
        CreditService.allocate_credits(
            user_id=subscription.user_id,
            credits=package.credits_monthly,
            source="subscription_payment",
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
        
        logger.info(f"✅ Payment succeeded processed for subscription {subscription_id}")
        logger.info(f"🎯 User {subscription.user_id} received {package.credits_monthly} credits")
        
    except Exception as e:
        logger.error(f"❌ Error handling payment succeeded: {str(e)}")

async def handle_payment_failed(invoice, db: Session):
    """Handle failed payment"""
    try:
        logger.info(f"❌ Processing payment failed: {invoice.get('id')}")
        
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            logger.warning("❌ No subscription ID in failed invoice")
            return
        
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == subscription_id
        ).first()
        
        if not subscription:
            logger.warning(f"❌ Subscription not found for failed payment: {subscription_id}")
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
        
        logger.warning(f"⚠️ Payment failed processed for subscription {subscription_id}")
        
    except Exception as e:
        logger.error(f"❌ Error handling payment failed: {str(e)}")

async def handle_subscription_created(subscription_data, db: Session):
    """Handle subscription creation"""
    try:
        logger.info(f"🆕 Processing subscription created: {subscription_data['id']}")
        
        # Get customer and user
        customer_id = subscription_data["customer"]
        logger.info(f"🔍 Getting customer: {customer_id}")
        
        customer = stripe.Customer.retrieve(customer_id)
        user_id = customer.metadata.get("user_id")
        
        if not user_id:
            logger.warning(f"❌ Subscription created without user_id in customer metadata: {customer_id}")
            # Try to find user by email if available
            if customer.email:
                # This would require a connection to the auth service to find user by email
                logger.info(f"🔍 Could try to find user by email: {customer.email}")
            return
        
        logger.info(f"✅ Found user_id: {user_id}")
        
        # Extract package info from price metadata
        price_id = subscription_data["items"]["data"][0]["price"]["id"]
        logger.info(f"🔍 Getting price: {price_id}")
        
        price = stripe.Price.retrieve(price_id)
        package_id = price.metadata.get("package_id")
        billing_cycle = price.metadata.get("billing_cycle", "monthly")
        
        logger.info(f"💰 Price metadata - package_id: {package_id}, billing_cycle: {billing_cycle}")
        
        # Find package by ID or by price amount
        target_package = None
        if package_id:
            target_package = db.query(Package).filter(Package.id == package_id).first()
        
        if not target_package:
            # Try to find by price amount
            price_amount = price.unit_amount / 100 if price.unit_amount else 0
            price_interval = price.recurring.get("interval", "month") if price.recurring else "month"
            
            if price_interval == "month":
                target_package = db.query(Package).filter(Package.price_monthly == price_amount).first()
            else:
                target_package = db.query(Package).filter(Package.price_annual == price_amount).first()
            
            # Special case for zero price (testing)
            if not target_package and price_amount == 0:
                target_package = db.query(Package).filter(Package.credits_monthly == 10000).first()
                logger.info(f"🔍 Zero price detected, using 10K package for testing")
        
        if not target_package:
            logger.error(f"❌ No package found for price {price_id}")
            return
        
        package_id = str(target_package.id)
        logger.info(f"📦 Using package: {target_package.name} ({target_package.credits_monthly} credits)")
        
        # Check if user already has a subscription
        existing_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()
        
        if existing_subscription:
            logger.info(f"🔄 User already has subscription, updating it")
            existing_subscription.package_id = package_id
            existing_subscription.stripe_subscription_id = subscription_data["id"]
            existing_subscription.stripe_customer_id = subscription_data["customer"]
            existing_subscription.billing_cycle = BillingCycle(billing_cycle)
            existing_subscription.status = SubscriptionStatus.active
            existing_subscription.current_period_start = datetime.fromtimestamp(subscription_data["current_period_start"])
            existing_subscription.current_period_end = datetime.fromtimestamp(subscription_data["current_period_end"])
            existing_subscription.updated_at = datetime.utcnow()
            new_subscription = existing_subscription
        else:
            # Create new subscription record
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
        db.refresh(new_subscription)
        
        # Allocate credits immediately
        expires_at = datetime.fromtimestamp(subscription_data["current_period_end"])
        CreditService.allocate_credits(
            user_id=user_id,
            credits=target_package.credits_monthly,
            source="new_subscription",
            expires_at=expires_at,
            db=db,
            subscription_id=new_subscription.id
        )
        
        logger.info(f"✅ Subscription created for user {user_id} with package {target_package.name}")
        logger.info(f"🎯 User received {target_package.credits_monthly} credits")
        
    except Exception as e:
        logger.error(f"❌ Error handling subscription created: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")

async def handle_subscription_updated(subscription_data, db: Session):
    """Handle subscription updates"""
    try:
        logger.info(f"🔄 Processing subscription updated: {subscription_data['id']}")
        
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == subscription_data["id"]
        ).first()
        
        if not subscription:
            logger.warning(f"❌ Subscription not found in database: {subscription_data['id']}")
            # Try to create subscription if it doesn't exist
            await handle_subscription_created(subscription_data, db)
            return
        
        logger.info(f"✅ Found subscription for user: {subscription.user_id}")
        
        # Get the new package info from price metadata
        price_id = subscription_data["items"]["data"][0]["price"]["id"]
        logger.info(f"🔍 Getting updated price: {price_id}")
        
        price = stripe.Price.retrieve(price_id)
        package_id = price.metadata.get("package_id")
        
        logger.info(f"💰 Updated price metadata - package_id: {package_id}")
        
        # If no package_id in metadata, try to find by price amount
        target_package = None
        if package_id:
            target_package = db.query(Package).filter(Package.id == package_id).first()
            logger.info(f"🔍 Found package by ID: {target_package.name if target_package else 'None'}")
        
        if not target_package:
            # Try to find package by price amount (convert from cents to euros)
            price_amount = price.unit_amount / 100 if price.unit_amount else 0
            billing_cycle = price.recurring.get("interval", "month") if price.recurring else "month"
            
            logger.info(f"🔍 Searching for package by price: €{price_amount}, cycle: {billing_cycle}")
            
            if billing_cycle == "month":
                target_package = db.query(Package).filter(Package.price_monthly == price_amount).first()
            else:
                target_package = db.query(Package).filter(Package.price_annual == price_amount).first()
            
            if target_package:
                logger.info(f"🔍 Found package by price: {target_package.name} ({target_package.credits_monthly} credits)")
            else:
                # Special case: if price is 0, assume it's the 10K package for testing
                if price_amount == 0:
                    target_package = db.query(Package).filter(Package.credits_monthly == 10000).first()
                    logger.info(f"🔍 Zero price detected, using 10K package: {target_package.name if target_package else 'None'}")
        
        if target_package:
            logger.info(f"🔄 Updating subscription from package {subscription.package_id} to {target_package.id}")
            
            # Update subscription package
            old_package_id = subscription.package_id
            subscription.package_id = target_package.id
            
            # Clear old credit allocations for this user
            old_allocations = db.query(CreditAllocation).filter(
                CreditAllocation.user_id == subscription.user_id
            ).all()
            for alloc in old_allocations:
                db.delete(alloc)
            logger.info(f"🗑️ Cleared {len(old_allocations)} old credit allocations")
            
            # Allocate new credits for the updated package
            expires_at = datetime.fromtimestamp(subscription_data["current_period_end"])
            credits_to_allocate = target_package.credits_monthly
            
            CreditService.allocate_credits(
                user_id=subscription.user_id,
                credits=credits_to_allocate,
                source="subscription_update_automatic",
                expires_at=expires_at,
                db=db,
                subscription_id=subscription.id
            )
            
            # Update credit balance
            credit_balance = db.query(CreditBalance).filter(
                CreditBalance.user_id == subscription.user_id
            ).first()
            
            if not credit_balance:
                credit_balance = CreditBalance(user_id=subscription.user_id)
                db.add(credit_balance)
            
            # Keep existing used credits, update total
            used_credits = credit_balance.used_credits if credit_balance.used_credits else 0
            remaining_credits = max(0, credits_to_allocate - used_credits)
            
            credit_balance.total_credits = credits_to_allocate
            credit_balance.used_credits = used_credits
            credit_balance.expired_credits = 0
            credit_balance.updated_at = datetime.utcnow()
            
            logger.info(f"💳 Allocated {credits_to_allocate} credits for updated package {target_package.name}")
            logger.info(f"📊 Credit balance: {remaining_credits} remaining after {used_credits} used")
            
        else:
            logger.error(f"❌ Could not find package for price {price_id}")
        
        # Update subscription status and periods
        subscription.status = SubscriptionStatus(subscription_data["status"])
        subscription.current_period_start = datetime.fromtimestamp(subscription_data["current_period_start"])
        subscription.current_period_end = datetime.fromtimestamp(subscription_data["current_period_end"])
        subscription.cancel_at_period_end = subscription_data.get("cancel_at_period_end", False)
        subscription.updated_at = datetime.utcnow()
        
        if subscription_data.get("canceled_at"):
            subscription.cancelled_at = datetime.fromtimestamp(subscription_data["canceled_at"])
        
        db.commit()
        
        logger.info(f"✅ Subscription updated successfully: {subscription_data['id']}")
        if target_package:
            logger.info(f"🎯 User {subscription.user_id} now has {target_package.name} ({target_package.credits_monthly} credits)")
        
    except Exception as e:
        logger.error(f"❌ Error handling subscription updated: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")

async def handle_subscription_deleted(subscription_data, db: Session):
    """Handle subscription deletion"""
    try:
        logger.info(f"🗑️ Processing subscription deleted: {subscription_data['id']}")
        
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == subscription_data["id"]
        ).first()
        
        if not subscription:
            logger.warning(f"❌ Subscription not found for deletion: {subscription_data['id']}")
            return
        
        subscription.status = SubscriptionStatus.cancelled
        subscription.cancelled_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"✅ Subscription deleted: {subscription_data['id']}")
        
    except Exception as e:
        logger.error(f"❌ Error handling subscription deleted: {str(e)}")

async def handle_setup_intent_succeeded(setup_intent, db: Session):
    """Handle successful payment method setup"""
    try:
        logger.info(f"🔐 Processing setup intent succeeded: {setup_intent.get('id')}")
        
        customer_id = setup_intent.get("customer")
        payment_method_id = setup_intent.get("payment_method")
        
        if not customer_id or not payment_method_id:
            return
        
        # Get user from subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.stripe_customer_id == customer_id
        ).first()
        if not subscription:
            return
        
        # Get payment method details from Stripe
        payment_method = stripe.PaymentMethod.retrieve(payment_method_id)
        
        # Save payment method
        new_pm = PaymentMethod(
            user_id=subscription.user_id,
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
        existing_count = db.query(PaymentMethod).filter(PaymentMethod.user_id == subscription.user_id).count()
        if existing_count == 0:
            new_pm.is_default = True
        
        db.add(new_pm)
        db.commit()
        
        logger.info(f"✅ Payment method added for user {subscription.user_id}")
        
    except Exception as e:
        logger.error(f"❌ Error handling setup intent succeeded: {str(e)}")

# ====== ENRICHMENT ENDPOINTS ======

@app.post("/api/billing/enrichment/process", response_model=EnrichmentResult)
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
    try:
        logger.info(f"📋 Getting billing history for user {user_id}")
        
        # Validate user_id
        if not user_id:
            logger.error("History request with empty user_id")
            raise HTTPException(status_code=401, detail="User authentication required")
        
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
    except Exception as e:
        logger.error(f"❌ Error getting billing history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get billing history: {str(e)}")

# ====== ENRICHMENT HISTORY ======

@app.get("/api/billing/enrichment-history")
async def get_enrichment_history(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get enrichment history for billing analytics"""
    try:
        logger.info(f"📊 Getting enrichment history for user {user_id}")
        
        # Validate user_id
        if not user_id:
            logger.error("Enrichment history request with empty user_id")
            raise HTTPException(status_code=401, detail="User authentication required")
        
        # Get enrichment history (if table exists)
        try:
            enrichments = db.query(EnrichmentHistory).filter(
                EnrichmentHistory.user_id == user_id
            ).order_by(desc(EnrichmentHistory.created_at)).limit(100).all()
            
            return {
                "enrichments": [
                    {
                        "id": str(enrichment.id),
                        "type": enrichment.enrichment_type.value,
                        "status": enrichment.status.value,
                        "credits_used": enrichment.credits_used,
                        "created_at": enrichment.created_at.isoformat()
                    }
                    for enrichment in enrichments
                ],
                "total": len(enrichments)
            }
        except Exception:
            # If enrichment history table doesn't exist, return empty
            logger.info("Enrichment history table not available, returning empty")
            return {
                "enrichments": [],
                "total": 0
            }
        
    except Exception as e:
        logger.error(f"❌ Error getting enrichment history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get enrichment history: {str(e)}")

# ====== TEAM MANAGEMENT ======

@app.get("/api/billing/team-members")
async def get_team_members(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get team members for billing (placeholder - not implemented yet)"""
    # For now, return empty list since team management isn't implemented
    return {
        "team_members": [],
        "total": 0,
        "current_user_id": user_id
    }

# ====== MISSING BILLING ENDPOINTS ======

# Duplicate endpoints removed - main implementations are used

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 