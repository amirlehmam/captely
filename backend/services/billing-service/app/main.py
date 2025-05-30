# services/billing-service/app/main.py

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import json

# ---- App Setup ----

app = FastAPI(
    title="Captely Billing Service",
    description="Simple billing system that actually works",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Mock Data ---- 

PACKAGES = [
    {
        "id": "starter",
        "name": "starter",
        "display_name": "Starter",
        "plan_type": "starter",
        "credits_monthly": 500,
        "price_monthly": 19.00,
        "price_annual": 182.40,
        "features": [
            "Import CSV files",
            "API enrichment", 
            "Chrome extension",
            "Shared database access",
            "Standard support",
            "All platform features"
        ],
        "is_active": True,
        "popular": False,
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "pro-1k",
        "name": "pro-1k",
        "display_name": "Pro 1K",
        "plan_type": "pro",
        "credits_monthly": 1000,
        "price_monthly": 38.00,
        "price_annual": 364.80,
        "features": [
            "All Starter features",
            "Modular credit volumes",
            "Priority support",
            "Advanced analytics",
            "Bulk operations",
            "Custom integrations"
        ],
        "is_active": True,
        "popular": False,
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "pro-2k",
        "name": "pro-2k", 
        "display_name": "Pro 2K",
        "plan_type": "pro",
        "credits_monthly": 2000,
        "price_monthly": 76.00,
        "price_annual": 729.60,
        "features": [
            "All Starter features",
            "Modular credit volumes",
            "Priority support",
            "Advanced analytics",
            "Bulk operations",
            "Custom integrations"
        ],
        "is_active": True,
        "popular": False,
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "pro-5k",
        "name": "pro-5k",
        "display_name": "Pro 5K", 
        "plan_type": "pro",
        "credits_monthly": 5000,
        "price_monthly": 186.00,
        "price_annual": 1785.60,
        "features": [
            "All Starter features",
            "Modular credit volumes",
            "Priority support",
            "Advanced analytics",
            "Bulk operations",
            "Custom integrations"
        ],
        "is_active": True,
        "popular": True,
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "enterprise",
        "name": "enterprise",
        "display_name": "Enterprise",
        "plan_type": "enterprise",
        "credits_monthly": 0,
        "price_monthly": 0.00,
        "price_annual": 0.00,
        "features": [
            "All Pro features",
            "Custom credit volumes",
            "SSO integration",
            "Enhanced security",
            "Dedicated support",
            "Custom API endpoints",
            "White-label options"
        ],
        "is_active": True,
        "popular": False,
        "created_at": "2024-01-01T00:00:00Z"
    }
]

CREDIT_USAGE = {
    "total_credits": 15000,
    "used_credits": 8240,
    "remaining_credits": 6760,
    "expired_credits": 120,
    "credits_by_month": [
        {
            "month": "Jan 2024",
            "allocated": 5000,
            "remaining": 1200,
            "expires_at": "2024-04-30T00:00:00Z"
        },
        {
            "month": "Feb 2024", 
            "allocated": 5000,
            "remaining": 2560,
            "expires_at": "2024-05-31T00:00:00Z"
        },
        {
            "month": "Mar 2024",
            "allocated": 5000,
            "remaining": 3000,
            "expires_at": "2024-06-30T00:00:00Z"
        }
    ],
    "email_hit_rate": 85,
    "phone_hit_rate": 72,
    "success_stats": {
        "total_searches": 25,
        "successful_searches": 22,
        "failed_searches": 3,
        "success_rate": 88
    }
}

ENRICHMENT_HISTORY = [
    {
        "id": "1",
        "contact_name": "Alexis Martel",
        "contact_email": "alexis@pharow.com",
        "enrichment_type": "email",
        "status": "success",
        "source": "apollo",
        "result_data": "alexis.martel@pharow.com",
        "credits_used": 1,
        "created_at": "2024-03-15T10:30:00Z"
    },
    {
        "id": "2",
        "contact_name": "Charlotte Cadé",
        "contact_email": "charlotte@selency.com", 
        "enrichment_type": "email",
        "status": "success",
        "source": "hunter",
        "result_data": "charlotte.cade@selency.com",
        "credits_used": 1,
        "created_at": "2024-03-15T10:29:00Z"
    },
    {
        "id": "3",
        "contact_name": "Corentin Sannié",
        "contact_email": "corentin@benefiz.com",
        "enrichment_type": "phone",
        "status": "success",
        "source": "apollo",
        "result_data": "+33-1-23-45-67-89",
        "credits_used": 10,
        "created_at": "2024-03-15T10:28:00Z"
    },
    {
        "id": "4",
        "contact_name": "Guillaume DOKI-THONON",
        "contact_email": "guillaume@reech.com",
        "enrichment_type": "email",
        "status": "success",
        "source": "dropcontact",
        "result_data": "guillaume.doki-thonon@reech.com",
        "credits_used": 1,
        "created_at": "2024-03-15T10:27:00Z"
    },
    {
        "id": "5",
        "contact_name": "Erwan Fleury",
        "contact_email": "erwan@cashflowpositif.com",
        "enrichment_type": "email",
        "status": "success",
        "source": "hunter",
        "result_data": "erwan.fleury@cashflowpositif.com",
        "credits_used": 1,
        "created_at": "2024-03-15T10:26:00Z"
    },
    {
        "id": "6",
        "contact_name": "Denis Ladegaillerie",
        "contact_email": "denis@believe.com",
        "enrichment_type": "phone",
        "status": "success",
        "source": "apollo",
        "result_data": "+33-1-45-67-89-12",
        "credits_used": 10,
        "created_at": "2024-03-15T10:25:00Z"
    },
    {
        "id": "7",
        "contact_name": "Guillaume Odier",
        "contact_email": "guillaume@captaindata.co",
        "enrichment_type": "email",
        "status": "success",
        "source": "apollo",
        "result_data": "guillaume.odier@captaindata.co",
        "credits_used": 1,
        "created_at": "2024-03-15T10:24:00Z"
    },
    {
        "id": "8",
        "contact_name": "Paul Riberolle",
        "contact_email": "paul@metalyde.com",
        "enrichment_type": "phone",
        "status": "success",
        "source": "hunter",
        "result_data": "+33-6-78-90-12-34",
        "credits_used": 10,
        "created_at": "2024-03-15T10:23:00Z"
    },
    {
        "id": "9",
        "contact_name": "Nicolas Sayer",
        "contact_email": "nicolas@stoik.co",
        "enrichment_type": "email",
        "status": "success",
        "source": "dropcontact",
        "result_data": "nicolas.sayer@stoik.co",
        "credits_used": 1,
        "created_at": "2024-03-15T10:22:00Z"
    },
    {
        "id": "10",
        "contact_name": "Matteo Mariat",
        "contact_email": "matteo@ledger.com",
        "enrichment_type": "email",
        "status": "success",
        "source": "apollo",
        "result_data": "matteo.mariat@ledger.com",
        "credits_used": 1,
        "created_at": "2024-03-15T10:21:00Z"
    }
]

# ---- API Endpoints ----

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "billing-service", "version": "2.0.0"}

@app.get("/api/packages")
async def get_packages():
    """Get all available packages"""
    return JSONResponse(content=PACKAGES)

@app.get("/api/packages/pro-plans")
async def get_pro_plans():
    """Get all Pro plan options"""
    pro_plans = [pkg for pkg in PACKAGES if pkg["plan_type"] == "pro"]
    return JSONResponse(content={
        "plans": [
            {
                "id": plan["id"],
                "name": plan["display_name"],
                "credits_monthly": plan["credits_monthly"],
                "price_monthly": plan["price_monthly"],
                "price_annual": plan["price_annual"],
                "popular": plan["popular"]
            }
            for plan in pro_plans
        ]
    })

@app.get("/api/credits/usage")
async def get_credit_usage():
    """Get credit usage for user"""
    return JSONResponse(content=CREDIT_USAGE)

@app.get("/api/enrichment/history")
async def get_enrichment_history():
    """Get enrichment history for billing/analytics"""
    return JSONResponse(content=ENRICHMENT_HISTORY)

@app.get("/api/billing/dashboard")
async def get_billing_dashboard():
    """Get complete billing dashboard"""
    current_plan = next((pkg for pkg in PACKAGES if pkg["id"] == "pro-5k"), None)
    
    return JSONResponse(content={
        "current_plan": current_plan,
        "subscription": {
            "id": "sub-123",
            "status": "active",
            "current_period_start": "2024-03-01T00:00:00Z",
            "current_period_end": "2024-04-01T00:00:00Z",
            "billing_cycle": "monthly"
        },
        "credit_usage": CREDIT_USAGE,
        "recent_transactions": [
            {
                "id": "tx-123",
                "type": "subscription",
                "amount": 186.00,
                "currency": "EUR",
                "status": "succeeded",
                "description": "Pro 5K Monthly Subscription",
                "credits_added": 5000,
                "created_at": "2024-03-01T00:00:00Z"
            }
        ],
        "payment_methods": [
            {
                "id": "pm-123",
                "type": "card",
                "provider": "stripe",
                "last_four": "4242",
                "brand": "visa",
                "exp_month": 12,
                "exp_year": 2025,
                "is_default": True,
                "is_verified": True,
                "created_at": "2024-01-01T00:00:00Z"
            }
        ]
    })

@app.post("/api/enrichment/process")
async def process_enrichment():
    """Mock enrichment processing"""
    return JSONResponse(content={
        "success": True,
        "credits_used": 1,
        "result_data": "test@example.com",
        "status": "success",
        "message": "Enrichment completed successfully"
    })

@app.get("/api/billing/history")
async def get_billing_history():
    """Get billing history"""
    return JSONResponse(content={
        "transactions": [
            {
                "id": "tx-123",
                "type": "subscription",
                "amount": 186.00,
                "currency": "EUR",
                "status": "succeeded", 
                "description": "Pro 5K Monthly Subscription",
                "credits_added": 5000,
                "created_at": "2024-03-01T00:00:00Z"
            }
        ],
        "total": 1,
        "limit": 50,
        "offset": 0
    })

@app.get("/api/subscriptions")
async def get_user_subscriptions():
    """Get user subscriptions"""
    return JSONResponse(content={
        "subscriptions": [
            {
                "id": "sub-123",
                "user_id": "user-456",
                "package_id": "pro-5k",
                "status": "active",
                "billing_cycle": "monthly",
                "current_period_start": "2024-03-01T00:00:00Z",
                "current_period_end": "2024-04-01T00:00:00Z",
                "trial_end": None,
                "cancel_at_period_end": False,
                "cancelled_at": None,
                "created_at": "2024-03-01T00:00:00Z"
            }
        ],
        "total": 1
    })

@app.get("/api/dashboard/analytics")
async def get_dashboard_analytics():
    """Get dashboard analytics data"""
    return JSONResponse(content={
        "total_contacts": 25,
        "email_hit_rate": 85,
        "phone_hit_rate": 72,
        "credits_remaining": 6760,
        "current_batch": {
            "job_id": "43170ba5",
            "status": "completed",
            "total": 25,
            "completed": 25,
            "progress": 100,
            "success_rate": 88,
            "credits_used": 47
        },
        "processing_stages": [
            {"name": "Import", "status": "completed", "duration": "00:30"},
            {"name": "Enrichment", "status": "completed", "duration": "02:45"},
            {"name": "Verification", "status": "completed", "duration": "01:15"},
            {"name": "Export", "status": "pending", "duration": "00:00"}
        ],
        "daily_usage": {
            "total": 150,
            "used": 47,
            "left": 103
        }
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 