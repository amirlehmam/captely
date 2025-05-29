# services/billing-service/app/schemas.py

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, List
from uuid import UUID

# Package schemas
class PackageResponse(BaseModel):
    id: UUID
    name: str
    display_name: str
    price_monthly: float
    price_yearly: float
    credits_monthly: int
    credits_rollover: bool
    features: Dict
    limits: Dict
    is_active: bool
    
    class Config:
        orm_mode = True

# Subscription schemas
class SubscriptionCreate(BaseModel):
    package_id: UUID
    billing_cycle: str = Field(default="monthly", regex="^(monthly|yearly)$")
    start_trial: bool = False

class SubscriptionResponse(BaseModel):
    id: UUID
    user_id: UUID
    package_id: UUID
    status: str
    billing_cycle: str
    current_period_start: datetime
    current_period_end: datetime
    trial_end: Optional[datetime]
    cancel_at_period_end: bool
    cancelled_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        orm_mode = True

# Payment method schemas
class PaymentMethodCreate(BaseModel):
    type: str = Field(..., regex="^(card|paypal|bank_transfer)$")
    provider: str = Field(..., regex="^(stripe|paypal)$")
    provider_payment_method_id: str
    last_four: Optional[str]
    brand: Optional[str]
    is_default: bool = False

class PaymentMethodResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    is_default: bool
    provider: Optional[str]
    last_four: Optional[str]
    brand: Optional[str]
    exp_month: Optional[int]
    exp_year: Optional[int]
    created_at: datetime
    
    class Config:
        orm_mode = True

# Credit package schemas
class CreditPackageResponse(BaseModel):
    id: UUID
    name: str
    credits: int
    price: float
    price_per_credit: float
    is_active: bool
    
    class Config:
        orm_mode = True

class CreditPackagePurchase(BaseModel):
    package_id: UUID
    payment_method_id: UUID

# Billing schemas
class BillingResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    status: str
    amount: float
    currency: str
    description: Optional[str]
    created_at: datetime
    
    class Config:
        orm_mode = True 