# services/billing-service/app/schemas.py

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, Dict, List, Any
from uuid import UUID
import re

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
    billing_cycle: str = Field(default="monthly")
    start_trial: bool = False
    
    @validator('billing_cycle')
    def validate_billing_cycle(cls, v):
        if v not in ['monthly', 'yearly']:
            raise ValueError('billing_cycle must be either monthly or yearly')
        return v

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
    type: str
    provider: str
    provider_payment_method_id: str
    last_four: Optional[str]
    brand: Optional[str]
    is_default: bool = False
    
    @validator('type')
    def validate_type(cls, v):
        if v not in ['card', 'paypal', 'bank_transfer']:
            raise ValueError('type must be one of: card, paypal, bank_transfer')
        return v
    
    @validator('provider')
    def validate_provider(cls, v):
        if v not in ['stripe', 'paypal']:
            raise ValueError('provider must be one of: stripe, paypal')
        return v

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