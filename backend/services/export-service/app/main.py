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
from sqlalchemy import select, and_, text
from jose import jwt, JWTError
from datetime import datetime

from common.config import get_settings
from common.db import get_session
from common.auth import verify_api_token
from app.integrations import get_integration

# Temporary models for export service - these should match your actual models
class Contact:
    pass

class IntegrationConfig:
    pass

class ExportLog:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

class Webhook:
    pass

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

class CrmExportRequest(BaseModel):
    contact_ids: List[str]
    format: str = "csv"  # csv, json, excel
    columns: Optional[List[str]] = None
    filters: Optional[Dict[str, Any]] = None

# Export endpoints
@app.post("/api/export/download")
async def export_data(
    request: ExportRequest,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Export enriched data in various formats"""
    
    # Get enriched contacts for the job with user verification
    query = text("""
        SELECT 
            c.id, c.first_name, c.last_name, c.email, c.phone, 
            c.company, c.position, c.location, c.industry,
            c.enriched, c.enrichment_status, c.enrichment_provider, 
            c.enrichment_score, c.credits_consumed,
            c.email_verified, c.phone_verified, c.created_at, c.updated_at,
            COALESCE(er.provider, c.enrichment_provider) as provider,
            COALESCE(er.confidence_score, c.enrichment_score) as confidence_score,
            COALESCE(er.email_verified, c.email_verified) as email_verified_status,
            COALESCE(er.phone_verified, c.phone_verified) as phone_verified_status
        FROM contacts c
        LEFT JOIN enrichment_results er ON c.id = er.contact_id
        JOIN import_jobs j ON c.job_id = j.id
        WHERE c.job_id = :job_id AND c.enriched = true AND j.user_id = :user_id
        ORDER BY c.created_at DESC
    """)
    
    result = await session.execute(query, {"job_id": request.job_id, "user_id": user_id})
    contacts = result.fetchall()
    
    if not contacts:
        raise HTTPException(status_code=404, detail="No enriched contacts found")
    
    # Convert to DataFrame for easy manipulation
    contacts_data = []
    for contact in contacts:
        contact_dict = dict(contact._mapping)
        contacts_data.append(contact_dict)
    
    df = pd.DataFrame(contacts_data)
    
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

# CRM Integration endpoints - Currently disabled due to missing dependencies
# TODO: Re-enable after proper model imports are configured

# @app.post("/api/integrations/hubspot") 
# async def export_to_hubspot(...):
#     """Export data to HubSpot CRM - Currently disabled"""
#     raise HTTPException(status_code=501, detail="Integration endpoints temporarily disabled")

# Integration endpoints temporarily disabled
# @app.post("/api/integrations/lemlist")
# @app.post("/api/integrations/smartlead") 
# @app.post("/api/integrations/salesforce")
# @app.post("/api/integrations/zapier/webhook")
# @app.post("/api/integrations/zapier/trigger")
# TODO: Re-enable after proper model setup

# Column customization endpoint
@app.get("/api/export/columns/{job_id}")
async def get_available_columns(
    job_id: str,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Get available columns for export customization"""
    
    query = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'contacts'
        UNION
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'enrichment_results'
    """)
    
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

# CRM CONTACTS EXPORT ENDPOINT
@app.post("/api/export/crm-contacts")
async def export_crm_contacts(
    request: CrmExportRequest,
    user_id: str = Depends(verify_jwt),
    session: AsyncSession = Depends(get_session)
):
    """Export CRM contacts in various formats"""
    
    # Get contacts for the specified IDs (with user verification)
    query = text("""
        SELECT 
            c.id, c.first_name, c.last_name, c.email, c.phone, 
            c.company, c.position, c.location, c.industry,
            c.enriched, c.enrichment_status, c.enrichment_provider, 
            c.enrichment_score, c.credits_consumed,
            c.email_verified, c.phone_verified, c.created_at, c.updated_at,
            c.job_id,
            j.file_name as batch_name, j.created_at as batch_created_at
        FROM contacts c
        JOIN import_jobs j ON c.job_id = j.id
        WHERE c.id = ANY(:contact_ids) AND j.user_id = :user_id
        ORDER BY c.created_at DESC
    """)
    
    result = await session.execute(query, {
        "contact_ids": request.contact_ids, 
        "user_id": user_id
    })
    contacts = result.fetchall()
    
    if not contacts:
        raise HTTPException(status_code=404, detail="No contacts found or access denied")
    
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
            headers={"Content-Disposition": f"attachment; filename=crm_contacts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    
    elif request.format == "excel":
        output = io.BytesIO()
        df.to_excel(output, index=False, engine='openpyxl')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=crm_contacts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
        )
    
    elif request.format == "json":
        return JSONResponse(df.to_dict(orient="records"))
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")

# Health check endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "export-service", "version": "1.0.0"}

@app.get("/api/health")
async def api_health_check():
    """API health check endpoint"""
    return {"status": "healthy", "service": "export-service", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 