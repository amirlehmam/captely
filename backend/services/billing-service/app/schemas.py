# services/billing-service/app/schemas.py

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import json

class PlanType(str, Enum):
    starter = "starter"
    pro = "pro"
    enterprise = "enterprise"

class BillingCycle(str, Enum):
    monthly = "monthly"
    annual = "annual"

class SubscriptionStatus(str, Enum):
    trial = "trial"
    active = "active"
    cancelled = "cancelled"
    expired = "expired"

class EnrichmentType(str, Enum):
    email = "email"
    phone = "phone"

class EnrichmentStatus(str, Enum):
    success = "success"
    failed = "failed"
    cached = "cached"

class EnrichmentSource(str, Enum):
    internal = "internal"
    apollo = "apollo"
    hunter = "hunter"
    clearbit = "clearbit"
    zoominfo = "zoominfo"
    lusha = "lusha"
    snov = "snov"

# Package Schemas
class PackageResponse(BaseModel):
    id: str
    name: str
    display_name: str
    plan_type: PlanType
    credits_monthly: int
    price_monthly: float
    price_annual: float
    features: Optional[List[str]] = None
    is_active: bool
    popular: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('features', mode='before')
    @classmethod
    def parse_features(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        elif v is None:
            return []
        return v

    @field_validator('id', mode='before')
    @classmethod
    def parse_id(cls, v):
        return str(v)

# Subscription Schemas
class SubscriptionCreate(BaseModel):
    package_id: str
    billing_cycle: BillingCycle
    payment_method_id: Optional[str] = None
    start_trial: bool = False

class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    package_id: str
    billing_cycle: BillingCycle
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancel_at_period_end: bool
    created_at: datetime
    package: Optional[PackageResponse] = None

    model_config = {"from_attributes": True}

    @field_validator('id', 'user_id', 'package_id', mode='before')
    @classmethod
    def parse_ids(cls, v):
        return str(v)

# Credit Schemas
class CreditUsageResponse(BaseModel):
    total_credits: int
    used_credits: int
    remaining_credits: int
    expired_credits: int
    credits_by_month: List[Dict[str, Any]]

class CreditAllocationResponse(BaseModel):
    id: str
    credits_allocated: int
    credits_remaining: int
    allocated_at: datetime
    expires_at: datetime
    source: str
    billing_cycle: Optional[BillingCycle] = None

    model_config = {"from_attributes": True}

    @field_validator('id', mode='before')
    @classmethod
    def parse_id(cls, v):
        return str(v)

class EnrichmentRequest(BaseModel):
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    enrichment_type: EnrichmentType
    source: EnrichmentSource
    batch_id: Optional[str] = None

class EnrichmentResult(BaseModel):
    success: bool
    credits_used: int
    result_data: Optional[str] = None
    status: EnrichmentStatus
    message: Optional[str] = None

class EnrichmentHistoryResponse(BaseModel):
    id: str
    contact_name: Optional[str]
    contact_email: Optional[str]
    enrichment_type: EnrichmentType
    status: EnrichmentStatus
    source: EnrichmentSource
    result_data: Optional[str]
    credits_used: int
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('id', mode='before')
    @classmethod
    def parse_id(cls, v):
        return str(v)

# Payment Method Schemas
class PaymentMethodCreate(BaseModel):
    type: str
    provider: str
    provider_payment_method_id: str
    last_four: Optional[str] = None
    brand: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    is_default: bool = False

class PaymentMethodResponse(BaseModel):
    id: str
    type: str
    provider: str
    last_four: Optional[str]
    brand: Optional[str]
    exp_month: Optional[int]
    exp_year: Optional[int]
    is_default: bool
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('id', mode='before')
    @classmethod
    def parse_id(cls, v):
        return str(v)

# Credit Package Schemas
class CreditPackageResponse(BaseModel):
    id: str
    name: str
    credits: int
    price: float
    discount_percentage: float
    is_active: bool
    popular: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('id', mode='before')
    @classmethod
    def parse_id(cls, v):
        return str(v)

class CreditPackagePurchase(BaseModel):
    package_id: str
    payment_method_id: str

# Transaction Schemas
class BillingTransactionResponse(BaseModel):
    id: str
    type: str
    amount: float
    currency: str
    status: str
    description: Optional[str]
    credits_added: int
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('id', mode='before')
    @classmethod
    def parse_id(cls, v):
        return str(v)

class BillingHistoryResponse(BaseModel):
    transactions: List[BillingTransactionResponse]
    total: int
    limit: int
    offset: int

# Pro Plan Selection
class ProPlanOption(BaseModel):
    id: str
    name: str
    credits_monthly: int
    price_monthly: float
    price_annual: float
    popular: bool = False

class ProPlansResponse(BaseModel):
    plans: List[ProPlanOption]

# Billing Dashboard
class BillingDashboardResponse(BaseModel):
    current_plan: Optional[PackageResponse]
    subscription: Optional[SubscriptionResponse] 
    credit_usage: CreditUsageResponse
    recent_transactions: List[BillingTransactionResponse]
    payment_methods: List[PaymentMethodResponse]

# General response
class BillingResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None 