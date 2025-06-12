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

from datetime import datetime
from sqlalchemy.orm import Session

from common.config import get_settings
from common.db import get_async_session
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
    session: AsyncSession = Depends(get_async_session)
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
        # Convert datetime columns to strings for JSON serialization
        df_json = df.copy()
        # Convert all datetime columns to strings
        datetime_cols = df_json.select_dtypes(include=['datetime64', 'datetime']).columns
        for col in datetime_cols:
            df_json[col] = df_json[col].astype(str)
        
        # Also handle any remaining non-serializable objects
        object_cols = df_json.select_dtypes(include=['object']).columns
        for col in object_cols:
            df_json[col] = df_json[col].astype(str)
        
        return JSONResponse(df_json.to_dict(orient="records"))
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")

# CRM Integration endpoints
@app.post("/api/integrations/hubspot")
async def export_to_hubspot(
    request: IntegrationRequest,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Export data to HubSpot CRM"""
    try:
        # Get contacts from job with user verification
        contacts_query = text("""
            SELECT c.first_name, c.last_name, c.email, c.phone, c.company, c.position
            FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id
            WHERE c.job_id = :job_id AND c.enriched = true AND c.email IS NOT NULL AND j.user_id = :user_id
        """)
        
        contacts_result = await session.execute(contacts_query, {"job_id": request.job_id, "user_id": user_id})
        contacts = contacts_result.fetchall()
        
        if not contacts:
            raise HTTPException(status_code=404, detail="No enriched contacts found")
        
        # Get user's HubSpot OAuth integration
        integration_query = text("""
            SELECT access_token, refresh_token, expires_at
            FROM hubspot_integrations 
            WHERE user_id = :user_id AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        integration_result = await session.execute(integration_query, {"user_id": user_id})
        integration = integration_result.fetchone()
        
        if not integration:
            raise HTTPException(status_code=400, detail="HubSpot integration not found. Please connect your HubSpot account first.")
        
        # Check if token needs refresh
        access_token = integration.access_token
        if integration.expires_at and integration.expires_at < datetime.utcnow():
            hubspot = get_integration("hubspot", {})
            try:
                token_data = await hubspot.refresh_access_token(integration.refresh_token)
                
                # Update stored tokens
                update_query = text("""
                    UPDATE hubspot_integrations 
                    SET access_token = :access_token, 
                        refresh_token = :refresh_token,
                        expires_at = :expires_at,
                        updated_at = NOW()
                    WHERE user_id = :user_id AND is_active = true
                """)
                
                new_expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 21600))
                await session.execute(update_query, {
                    "user_id": user_id,
                    "access_token": token_data["access_token"],
                    "refresh_token": token_data["refresh_token"],
                    "expires_at": new_expires_at
                })
                await session.commit()
                
                access_token = token_data["access_token"]
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Token refresh failed: {str(e)}")
        
        # Prepare contact data
        contact_data = []
        for contact in contacts:
            contact_dict = dict(contact._mapping)
            data = {
                "first_name": contact_dict.get("first_name"),
                "last_name": contact_dict.get("last_name"),
                "email": contact_dict.get("email"),
                "phone": contact_dict.get("phone"),
                "company": contact_dict.get("company"),
                "position": contact_dict.get("position")
            }
            
            # Apply field mapping if provided
            if request.mapping:
                mapped_data = {}
                for captely_field, hubspot_field in request.mapping.items():
                    if captely_field in contact_dict:
                        mapped_data[hubspot_field] = contact_dict[captely_field]
                data.update(mapped_data)
            
            contact_data.append(data)
        
        # Use HubSpot integration with OAuth token
        hubspot = get_integration("hubspot", {"access_token": access_token})
        result = await hubspot.create_or_update_contacts(contact_data)
        
        # Log export to HubSpot sync logs
        log_sync_query = text("""
            INSERT INTO hubspot_sync_logs 
            (user_id, integration_id, sync_type, operation, status, total_records, processed_records, failed_records)
            SELECT :user_id, hi.id, 'export', 'contacts', :status, :total_records, :processed_records, :failed_records
            FROM hubspot_integrations hi 
            WHERE hi.user_id = :user_id AND hi.is_active = true
            LIMIT 1
        """)
        
        exported_count = result.get("created", 0) + result.get("updated", 0)
        failed_count = len(result.get("errors", []))
        
        await session.execute(log_sync_query, {
            "user_id": user_id,
            "status": "completed" if not result.get("errors") else "partial",
            "total_records": len(contact_data),
            "processed_records": exported_count,
            "failed_records": failed_count
        })
        await session.commit()
        
        return {
            "status": "success",
            "exported_count": result.get("created", 0) + result.get("updated", 0),
            "errors": result.get("errors", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Integration endpoints temporarily disabled
# HubSpot OAuth endpoints (using /api/export/ prefix for nginx routing)
@app.get("/api/export/hubspot/oauth/url")
async def get_hubspot_oauth_url(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Generate HubSpot OAuth URL for user authorization"""
    try:
        hubspot = get_integration("hubspot", {})
        state = f"{user_id}_{datetime.now().timestamp()}"
        oauth_url = hubspot.get_auth_url(state=state)
        
        return {"oauth_url": oauth_url, "state": state}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate OAuth URL: {str(e)}")

@app.post("/api/export/hubspot/oauth/callback")
async def hubspot_oauth_callback(
    code: str,
    state: str,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Handle HubSpot OAuth callback and store tokens"""
    try:
        # Verify state parameter contains user_id
        if not state.startswith(user_id):
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Exchange code for tokens
        hubspot = get_integration("hubspot", {})
        token_data = await hubspot.exchange_code_for_token(code)
        
        # Get portal info
        portal_info = await hubspot.get_portal_info()
        portal_id = str(portal_info.get("portalId", ""))
        
        # Store or update integration in database
        upsert_query = text("""
            INSERT INTO hubspot_integrations 
            (user_id, hubspot_portal_id, access_token, refresh_token, expires_at, scopes, is_active)
            VALUES (:user_id, :portal_id, :access_token, :refresh_token, :expires_at, :scopes, true)
            ON CONFLICT (user_id, hubspot_portal_id) 
            DO UPDATE SET 
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                scopes = EXCLUDED.scopes,
                is_active = true,
                updated_at = NOW()
        """)
        
        expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 21600))
        scopes = token_data.get("scope", "").split(" ") if token_data.get("scope") else []
        
        await session.execute(upsert_query, {
            "user_id": user_id,
            "portal_id": portal_id,
            "access_token": token_data["access_token"],
            "refresh_token": token_data["refresh_token"],
            "expires_at": expires_at,
            "scopes": scopes
        })
        await session.commit()
        
        return {
            "status": "success",
            "portal_id": portal_id,
            "scopes": scopes,
            "expires_at": expires_at.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

@app.get("/api/export/hubspot/status")
async def get_hubspot_integration_status(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Get HubSpot integration status for user"""
    try:
        query = text("""
            SELECT hubspot_portal_id, expires_at, scopes, is_active, created_at
            FROM hubspot_integrations 
            WHERE user_id = :user_id AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        result = await session.execute(query, {"user_id": user_id})
        integration = result.fetchone()
        
        if integration:
            return {
                "connected": True,
                "portal_id": integration.hubspot_portal_id,
                "expires_at": integration.expires_at.isoformat() if integration.expires_at else None,
                "scopes": integration.scopes,
                "connected_at": integration.created_at.isoformat() if integration.created_at else None
            }
        else:
            return {"connected": False}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

@app.delete("/api/export/hubspot/disconnect")
async def disconnect_hubspot(
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Disconnect HubSpot integration"""
    try:
        query = text("""
            UPDATE hubspot_integrations 
            SET is_active = false, updated_at = NOW()
            WHERE user_id = :user_id
        """)
        
        await session.execute(query, {"user_id": user_id})
        await session.commit()
        
        return {"status": "success", "message": "HubSpot integration disconnected"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")

@app.post("/api/export/hubspot/import")
async def import_contacts_from_hubspot(
    limit: int = Query(100, le=500, description="Number of contacts to import"),
    after: str = Query(None, description="Pagination cursor"),
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Import contacts from HubSpot to Captely for enrichment"""
    try:
        # Get user's HubSpot integration
        integration_query = text("""
            SELECT access_token, refresh_token, expires_at
            FROM hubspot_integrations 
            WHERE user_id = :user_id AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        integration_result = await session.execute(integration_query, {"user_id": user_id})
        integration = integration_result.fetchone()
        
        if not integration:
            raise HTTPException(status_code=400, detail="HubSpot integration not found")
        
        # Check if token needs refresh
        if integration.expires_at and integration.expires_at < datetime.utcnow():
            hubspot = get_integration("hubspot", {})
            try:
                token_data = await hubspot.refresh_access_token(integration.refresh_token)
                
                # Update stored tokens
                update_query = text("""
                    UPDATE hubspot_integrations 
                    SET access_token = :access_token, 
                        refresh_token = :refresh_token,
                        expires_at = :expires_at,
                        updated_at = NOW()
                    WHERE user_id = :user_id AND is_active = true
                """)
                
                new_expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 21600))
                await session.execute(update_query, {
                    "user_id": user_id,
                    "access_token": token_data["access_token"],
                    "refresh_token": token_data["refresh_token"],
                    "expires_at": new_expires_at
                })
                await session.commit()
                
                access_token = token_data["access_token"]
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Token refresh failed: {str(e)}")
        else:
            access_token = integration.access_token
        
        # Import contacts from HubSpot
        hubspot = get_integration("hubspot", {"access_token": access_token})
        import_result = await hubspot.import_contacts(limit=limit, after=after)
        
        # Create a new import job
        job_id = f"hubspot_import_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        create_job_query = text("""
            INSERT INTO import_jobs (id, user_id, status, total, file_name, type)
            VALUES (:job_id, :user_id, 'completed', :total, :file_name, 'hubspot_import')
        """)
        
        await session.execute(create_job_query, {
            "job_id": job_id,
            "user_id": user_id,
            "total": import_result["total"],
            "file_name": f"HubSpot Import - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        })
        
        # Insert imported contacts
        imported_count = 0
        for contact in import_result["contacts"]:
            if contact.get("email"):  # Only import contacts with emails
                insert_contact_query = text("""
                    INSERT INTO contacts 
                    (job_id, first_name, last_name, email, phone, company, position, 
                     enriched, enrichment_status, notes)
                    VALUES 
                    (:job_id, :first_name, :last_name, :email, :phone, :company, :position,
                     false, 'pending', :notes)
                    ON CONFLICT (job_id, email) DO NOTHING
                """)
                
                await session.execute(insert_contact_query, {
                    "job_id": job_id,
                    "first_name": contact.get("first_name"),
                    "last_name": contact.get("last_name"),
                    "email": contact.get("email"),
                    "phone": contact.get("phone"),
                    "company": contact.get("company"),
                    "position": contact.get("position"),
                    "notes": f"Imported from HubSpot (ID: {contact.get('hubspot_id')})"
                })
                imported_count += 1
        
        await session.commit()
        
        # Log the import
        log_sync_query = text("""
            INSERT INTO hubspot_sync_logs 
            (user_id, integration_id, sync_type, operation, status, total_records, processed_records)
            SELECT :user_id, hi.id, 'import', 'contacts', 'completed', :total_records, :processed_records
            FROM hubspot_integrations hi 
            WHERE hi.user_id = :user_id AND hi.is_active = true
            LIMIT 1
        """)
        
        await session.execute(log_sync_query, {
            "user_id": user_id,
            "total_records": import_result["total"],
            "processed_records": imported_count
        })
        await session.commit()
        
        return {
            "status": "success",
            "job_id": job_id,
            "imported_count": imported_count,
            "total_contacts": import_result["total"],
            "paging": import_result.get("paging", {})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@app.get("/api/export/hubspot/sync-logs")
async def get_hubspot_sync_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Get HubSpot sync history logs"""
    try:
        offset = (page - 1) * limit
        
        query = text("""
            SELECT sync_type, operation, status, total_records, processed_records, 
                   failed_records, error_message, started_at, completed_at
            FROM hubspot_sync_logs hsl
            JOIN hubspot_integrations hi ON hsl.integration_id = hi.id
            WHERE hi.user_id = :user_id
            ORDER BY hsl.started_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        result = await session.execute(query, {
            "user_id": user_id,
            "limit": limit,
            "offset": offset
        })
        logs = result.fetchall()
        
        return {
            "logs": [dict(log._mapping) for log in logs],
            "page": page,
            "limit": limit,
            "total": len(logs)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get sync logs: {str(e)}")

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
    session: AsyncSession = Depends(get_async_session)
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
    session: AsyncSession = Depends(get_async_session)
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
        # Convert datetime columns to strings for JSON serialization
        df_json = df.copy()
        # Convert all datetime columns to strings
        datetime_cols = df_json.select_dtypes(include=['datetime64', 'datetime']).columns
        for col in datetime_cols:
            df_json[col] = df_json[col].astype(str)
        
        # Also handle any remaining non-serializable objects
        object_cols = df_json.select_dtypes(include=['object']).columns
        for col in object_cols:
            df_json[col] = df_json[col].astype(str)
        
        return JSONResponse(df_json.to_dict(orient="records"))
    
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