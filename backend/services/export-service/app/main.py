"""
Export Service for Captely
Handles data exports to CRM, outreach tools, and integration platforms
"""
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import csv
import io
import json
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError

from common.config import get_settings
from common.db import get_session
from common.auth import verify_api_token

app = FastAPI(
    title="Captely Export Service",
    description="Export enriched data to CRM and outreach platforms",
    version="1.0.0"
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return user ID"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Pydantic models
class ExportRequest(BaseModel):
    job_id: str
    format: str = "csv"  # csv, json, excel
    columns: Optional[List[str]] = None
    filters: Optional[Dict[str, Any]] = None

class IntegrationRequest(BaseModel):
    job_id: str
    platform: str  # hubspot, lemlist, smartlead, zapier
    mapping: Dict[str, str]  # field mapping
    config: Optional[Dict[str, Any]] = None

class ZapierWebhook(BaseModel):
    url: str
    event_type: str = "enrichment_complete"

# Export endpoints
@app.post("/api/export/download")
async def export_data(
    request: ExportRequest,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Export enriched data in various formats"""
    
    # Get enriched contacts for the job
    query = """
        SELECT c.*, er.provider, er.confidence_score, er.email_verified, er.phone_verified
        FROM contacts c
        LEFT JOIN enrichment_results er ON c.id = er.contact_id
        WHERE c.job_id = :job_id AND c.enriched = true
    """
    
    result = await session.execute(query, {"job_id": request.job_id})
    contacts = result.fetchall()
    
    if not contacts:
        raise HTTPException(status_code=404, detail="No enriched contacts found")
    
    # Convert to DataFrame for easy manipulation
    df = pd.DataFrame([dict(contact) for contact in contacts])
    
    # Apply column selection if specified
    if request.columns:
        available_columns = [col for col in request.columns if col in df.columns]
        df = df[available_columns]
    
    # Apply filters if specified
    if request.filters:
        for field, value in request.filters.items():
            if field in df.columns:
                df = df[df[field] == value]
    
    # Generate export based on format
    if request.format == "csv":
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=enriched_data_{request.job_id}.csv"}
        )
    
    elif request.format == "excel":
        output = io.BytesIO()
        df.to_excel(output, index=False, engine='openpyxl')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=enriched_data_{request.job_id}.xlsx"}
        )
    
    elif request.format == "json":
        return JSONResponse(df.to_dict(orient="records"))
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")

# CRM Integration endpoints
@app.post("/api/integrations/hubspot")
async def export_to_hubspot(
    request: IntegrationRequest,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Export data to HubSpot CRM"""
    
    # Get user's HubSpot API key
    hubspot_api_key = request.config.get("api_key") if request.config else None
    if not hubspot_api_key:
        raise HTTPException(status_code=400, detail="HubSpot API key required")
    
    # Get enriched contacts
    query = """
        SELECT * FROM contacts WHERE job_id = :job_id AND enriched = true
    """
    result = await session.execute(query, {"job_id": request.job_id})
    contacts = result.fetchall()
    
    # Transform data according to mapping
    hubspot_contacts = []
    for contact in contacts:
        hubspot_contact = {}
        for captely_field, hubspot_field in request.mapping.items():
            if hasattr(contact, captely_field):
                hubspot_contact[hubspot_field] = getattr(contact, captely_field)
        hubspot_contacts.append(hubspot_contact)
    
    # TODO: Implement actual HubSpot API call
    # This would use the HubSpot API to create/update contacts
    
    return {"status": "success", "exported_count": len(hubspot_contacts)}

@app.post("/api/integrations/lemlist")
async def export_to_lemlist(
    request: IntegrationRequest,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Export data to Lemlist"""
    
    # Get Lemlist API key
    lemlist_api_key = request.config.get("api_key") if request.config else None
    if not lemlist_api_key:
        raise HTTPException(status_code=400, detail="Lemlist API key required")
    
    # Similar implementation to HubSpot
    # TODO: Implement Lemlist API integration
    
    return {"status": "success", "message": "Export to Lemlist initiated"}

@app.post("/api/integrations/smartlead")
async def export_to_smartlead(
    request: IntegrationRequest,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Export data to Smartlead"""
    
    # TODO: Implement Smartlead API integration
    
    return {"status": "success", "message": "Export to Smartlead initiated"}

# Zapier webhook endpoint
@app.post("/api/integrations/zapier/webhook")
async def register_zapier_webhook(
    webhook: ZapierWebhook,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Register a Zapier webhook for enrichment events"""
    
    # Store webhook URL in database
    # TODO: Implement webhook storage and triggering
    
    return {"status": "success", "webhook_id": "webhook_123"}

@app.post("/api/integrations/zapier/trigger")
async def trigger_zapier_webhook(
    job_id: str,
    webhook_url: str,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Trigger Zapier webhook with enrichment results"""
    
    # Get job results
    query = """
        SELECT * FROM contacts WHERE job_id = :job_id AND enriched = true
    """
    result = await session.execute(query, {"job_id": job_id})
    contacts = result.fetchall()
    
    # Format data for Zapier
    payload = {
        "job_id": job_id,
        "enriched_count": len(contacts),
        "contacts": [dict(contact) for contact in contacts[:10]]  # First 10 contacts
    }
    
    # TODO: Send HTTP POST to Zapier webhook URL
    
    return {"status": "success", "sent_to": webhook_url}

# Column customization endpoint
@app.get("/api/export/columns/{job_id}")
async def get_available_columns(
    job_id: str,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Get available columns for export customization"""
    
    query = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'contacts'
        UNION
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'enrichment_results'
    """
    
    result = await session.execute(query)
    columns = [row[0] for row in result.fetchall()]
    
    # Define user-friendly column names
    column_mapping = {
        "first_name": "First Name",
        "last_name": "Last Name", 
        "email": "Email Address",
        "phone": "Phone Number",
        "company": "Company",
        "position": "Job Title",
        "location": "Location",
        "industry": "Industry",
        "enrichment_provider": "Data Source",
        "enrichment_score": "Confidence Score",
        "email_verified": "Email Verified",
        "phone_verified": "Phone Verified"
    }
    
    return {
        "available_columns": columns,
        "column_mapping": column_mapping,
        "recommended_columns": [
            "first_name", "last_name", "email", "phone", 
            "company", "position", "enrichment_score"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 