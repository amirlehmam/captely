# services/billing-service/app/models.py

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey, Enum, create_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import uuid
import enum

# Create standalone base for billing service
Base = declarative_base()

class PlanType(str, enum.Enum):
    starter = "starter"
    pro = "pro"
    enterprise = "enterprise"

class BillingCycle(str, enum.Enum):
    monthly = "monthly"
    annual = "annual"

class SubscriptionStatus(str, enum.Enum):
    trial = "trial"
    active = "active"
    cancelled = "cancelled"
    expired = "expired"

class EnrichmentType(str, enum.Enum):
    email = "email"
    phone = "phone"

class EnrichmentStatus(str, enum.Enum):
    success = "success"
    failed = "failed"
    cached = "cached"

class EnrichmentSource(str, enum.Enum):
    internal = "internal"
    apollo = "apollo"
    hunter = "hunter"
    clearbit = "clearbit"
    zoominfo = "zoominfo"
    lusha = "lusha"
    snov = "snov"

class Package(Base):
    __tablename__ = "packages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)  # starter, pro-1k, pro-2k, etc.
    display_name = Column(String, nullable=False)
    plan_type = Column(Enum(PlanType), nullable=False)
    credits_monthly = Column(Integer, nullable=False)
    price_monthly = Column(Float, nullable=False)  # in EUR
    price_annual = Column(Float, nullable=False)   # in EUR with 20% discount
    features = Column(Text)  # JSON array of features
    
    # Stripe integration
    stripe_price_id_monthly = Column(String)  # Stripe price ID for monthly billing
    stripe_price_id_annual = Column(String)   # Stripe price ID for annual billing
    
    is_active = Column(Boolean, default=True)
    popular = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False)
    billing_cycle = Column(Enum(BillingCycle), nullable=False)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.trial)
    
    # Stripe integration
    stripe_subscription_id = Column(String)
    stripe_customer_id = Column(String)
    
    # Subscription periods
    current_period_start = Column(DateTime, nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    trial_start = Column(DateTime)
    trial_end = Column(DateTime)
    cancelled_at = Column(DateTime)
    cancel_at_period_end = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    package = relationship("Package")

class CreditBalance(Base):
    __tablename__ = "credit_balances"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    total_credits = Column(Integer, default=0)
    used_credits = Column(Integer, default=0)
    expired_credits = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CreditAllocation(Base):
    __tablename__ = "credit_allocations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    credits_allocated = Column(Integer, nullable=False)
    credits_remaining = Column(Integer, nullable=False)
    allocated_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    source = Column(String, nullable=False)  # 'subscription', 'purchase', 'bonus'
    billing_cycle = Column(Enum(BillingCycle))
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("user_subscriptions.id"))
    
    # Relationships
    subscription = relationship("UserSubscription")

class EnrichmentHistory(Base):
    __tablename__ = "enrichment_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    contact_id = Column(UUID(as_uuid=True))
    contact_name = Column(String)
    contact_email = Column(String)
    
    # Enrichment details
    enrichment_type = Column(Enum(EnrichmentType), nullable=False)
    status = Column(Enum(EnrichmentStatus), nullable=False)
    source = Column(Enum(EnrichmentSource), nullable=False)
    result_data = Column(Text)  # The actual email/phone found
    credits_used = Column(Integer, default=0)
    
    # Metadata
    batch_id = Column(UUID(as_uuid=True))  # For bulk operations
    api_request_id = Column(String)
    ip_address = Column(String)
    user_agent = Column(String)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(String, nullable=False)  # card, bank_account, etc.
    provider = Column(String, nullable=False)  # stripe, paypal
    provider_payment_method_id = Column(String, nullable=False)
    provider_customer_id = Column(String)
    
    # Card details (for cards)
    last_four = Column(String)
    brand = Column(String)
    exp_month = Column(Integer)
    exp_year = Column(Integer)
    
    # Metadata
    payment_metadata = Column(Text)  # JSON for additional data
    is_default = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BillingTransaction(Base):
    __tablename__ = "billing_transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("user_subscriptions.id"))
    payment_method_id = Column(UUID(as_uuid=True), ForeignKey("payment_methods.id"))
    
    # Transaction details
    type = Column(String, nullable=False)  # subscription, credit_topup, refund
    amount = Column(Float, nullable=False)
    currency = Column(String, default="EUR")
    status = Column(String, nullable=False)  # pending, succeeded, failed, cancelled
    
    # Provider details
    provider = Column(String)  # stripe, paypal
    provider_transaction_id = Column(String)
    provider_fee = Column(Float)
    
    # Metadata
    description = Column(String)
    transaction_metadata = Column(Text)  # JSON for additional data
    failure_reason = Column(String)
    
    # Credits (for credit purchases)
    credits_added = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    subscription = relationship("UserSubscription")
    payment_method = relationship("PaymentMethod")

class CreditPackage(Base):
    __tablename__ = "credit_packages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    credits = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)  # in EUR
    discount_percentage = Column(Float, default=0)
    is_active = Column(Boolean, default=True)
    popular = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# Note: User model removed - using auth service for user data 