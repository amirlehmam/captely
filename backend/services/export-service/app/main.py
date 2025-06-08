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
from sqlalchemy import select, and_
from jose import jwt, JWTError
from datetime import datetime

from common.config import get_settings
from common.db import get_session
from common.auth import verify_api_token
from app.integrations import get_integration

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
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Export data to HubSpot CRM"""
    try:
        # Get contacts from job
        contacts_query = await session.execute(
            select(Contact).where(
                and_(
                    Contact.job_id == request.job_id,
                    Contact.enriched == True,
                    Contact.email.isnot(None)
                )
            )
        )
        contacts = contacts_query.scalars().all()
        
        if not contacts:
            raise HTTPException(status_code=404, detail="No enriched contacts found")
        
        # Get user's HubSpot integration config
        integration_config = await session.execute(
            select(IntegrationConfig).where(
                and_(
                    IntegrationConfig.user_id == user_id,
                    IntegrationConfig.provider == 'hubspot',
                    IntegrationConfig.is_active == True
                )
            )
        )
        config = integration_config.scalar_one_or_none()
        
        if not config:
            # Use provided config if no saved config
            if not request.config or not request.config.get("api_key"):
                raise HTTPException(status_code=400, detail="HubSpot API key required")
            api_key = request.config["api_key"]
        else:
            api_key = config.api_key
        
        # Prepare contact data
        contact_data = []
        for contact in contacts:
            data = {
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "email": contact.email,
                "phone": contact.phone,
                "company": contact.company,
                "position": contact.position
            }
            
            # Apply field mapping if provided
            if request.mapping:
                mapped_data = {}
                for captely_field, hubspot_field in request.mapping.items():
                    if hasattr(contact, captely_field):
                        mapped_data[hubspot_field] = getattr(contact, captely_field)
                data.update(mapped_data)
            
            contact_data.append(data)
        
        # Use HubSpot integration
        hubspot = get_integration("hubspot", {"api_key": api_key})
        result = await hubspot.create_or_update_contacts(contact_data)
        
        # Log export
        export_log = ExportLog(
            user_id=user_id,
            job_id=request.job_id,
            export_type='hubspot',
            status='completed' if not result.get("errors") else 'partial',
            export_config=request.dict()
        )
        session.add(export_log)
        await session.commit()
        
        return {
            "status": "success",
            "exported_count": result.get("created", 0) + result.get("updated", 0),
            "errors": result.get("errors", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/integrations/lemlist")
async def export_to_lemlist(
    request: IntegrationRequest,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Export data to Lemlist"""
    try:
        # Get contacts
        contacts_query = await session.execute(
            select(Contact).where(
                and_(
                    Contact.job_id == request.job_id,
                    Contact.enriched == True,
                    Contact.email.isnot(None)
                )
            )
        )
        contacts = contacts_query.scalars().all()
        
        if not contacts:
            raise HTTPException(status_code=404, detail="No enriched contacts found")
        
        # Get Lemlist config
        campaign_id = request.config.get("campaign_id")
        api_key = request.config.get("api_key")
        
        if not campaign_id or not api_key:
            raise HTTPException(status_code=400, detail="Lemlist campaign ID and API key required")
        
        # Prepare contact data
        contact_data = []
        for contact in contacts:
            contact_data.append({
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "email": contact.email,
                "phone": contact.phone,
                "company": contact.company,
                "position": contact.position
            })
        
        # Use Lemlist integration
        lemlist = get_integration("lemlist", {"api_key": api_key})
        result = await lemlist.add_to_campaign(campaign_id, contact_data)
        
        # Log export
        export_log = ExportLog(
            user_id=user_id,
            job_id=request.job_id,
            export_type='lemlist',
            status='completed' if not result.get("errors") else 'partial',
            export_config=request.dict()
        )
        session.add(export_log)
        await session.commit()
        
        return {
            "status": "success",
            "exported_count": result.get("added", 0),
            "campaign_id": campaign_id,
            "errors": result.get("errors", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/integrations/smartlead")
async def export_to_smartlead(
    request: IntegrationRequest,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Export data to Smartlead"""
    try:
        # Get contacts
        contacts_query = await session.execute(
            select(Contact).where(
                and_(
                    Contact.job_id == request.job_id,
                    Contact.enriched == True,
                    Contact.email.isnot(None)
                )
            )
        )
        contacts = contacts_query.scalars().all()
        
        if not contacts:
            raise HTTPException(status_code=404, detail="No enriched contacts found")
        
        # Get Smartlead config
        campaign_id = request.config.get("campaign_id")
        api_key = request.config.get("api_key")
        
        if not campaign_id or not api_key:
            raise HTTPException(status_code=400, detail="Smartlead campaign ID and API key required")
        
        # Prepare contact data
        contact_data = []
        for contact in contacts:
            contact_data.append({
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "email": contact.email,
                "phone": contact.phone,
                "company": contact.company,
                "position": contact.position
            })
        
        # Use Smartlead integration
        smartlead = get_integration("smartlead", {"api_key": api_key})
        result = await smartlead.add_prospects(campaign_id, contact_data)
        
        return {
            "status": "success",
            "exported_count": result.get("added", 0),
            "campaign_id": campaign_id,
            "errors": result.get("errors", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/integrations/salesforce")
async def export_to_salesforce(
    request: IntegrationRequest,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Export data to Salesforce"""
    try:
        # Get contacts
        contacts_query = await session.execute(
            select(Contact).where(
                and_(
                    Contact.job_id == request.job_id,
                    Contact.enriched == True
                )
            )
        )
        contacts = contacts_query.scalars().all()
        
        if not contacts:
            raise HTTPException(status_code=404, detail="No enriched contacts found")
        
        # Get Salesforce config
        instance_url = request.config.get("instance_url")
        access_token = request.config.get("access_token")
        
        if not instance_url or not access_token:
            raise HTTPException(status_code=400, detail="Salesforce instance URL and access token required")
        
        # Prepare contact data
        contact_data = []
        for contact in contacts:
            contact_data.append({
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "email": contact.email,
                "phone": contact.phone,
                "company": contact.company,
                "position": contact.position
            })
        
        # Use Salesforce integration
        salesforce = get_integration("salesforce", {
            "instance_url": instance_url,
            "access_token": access_token
        })
        result = await salesforce.create_leads(contact_data)
        
        return {
            "status": "success",
            "exported_count": result.get("created", 0),
            "errors": result.get("errors", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    webhook_id: str,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_session)
):
    """Trigger Zapier webhook with enrichment results"""
    try:
        # Get webhook config
        webhook_result = await session.execute(
            select(Webhook).where(
                and_(
                    Webhook.id == webhook_id,
                    Webhook.user_id == user_id,
                    Webhook.is_active == True
                )
            )
        )
        webhook = webhook_result.scalar_one_or_none()
        
        if not webhook:
            raise HTTPException(status_code=404, detail="Webhook not found or inactive")
        
        # Get enriched contacts
        contacts_query = await session.execute(
            select(Contact).where(
                and_(
                    Contact.job_id == job_id,
                    Contact.enriched == True
                )
            )
        )
        contacts = contacts_query.scalars().all()
        
        # Prepare contact data
        contact_data = []
        for contact in contacts:
            contact_data.append({
                "id": contact.id,
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "email": contact.email,
                "phone": contact.phone,
                "company": contact.company,
                "position": contact.position,
                "email_verified": contact.email_verified,
                "phone_verified": contact.phone_verified,
                "enrichment_provider": contact.enrichment_provider,
                "enrichment_score": contact.enrichment_score
            })
        
        # Use Zapier integration
        zapier = get_integration("zapier", {"webhook_url": webhook.url})
        result = await zapier.send_contacts(contact_data, "contacts.enriched")
        
        # Update webhook stats
        if result.get("errors"):
            webhook.failure_count += 1
        else:
            webhook.success_count += 1
        webhook.last_triggered_at = datetime.utcnow()
        
        await session.commit()
        
        return {
            "status": "success" if not result.get("errors") else "partial",
            "sent_count": result.get("sent", 0),
            "errors": result.get("errors", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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