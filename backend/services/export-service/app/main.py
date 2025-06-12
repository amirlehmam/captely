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

from datetime import datetime, timedelta
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
    user_id: str = Depends(verify_api_token),
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
        if integration.expires_at and integration.expires_at.replace(tzinfo=None) < datetime.utcnow():
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

# Request model for OAuth callback
class OAuthCallbackRequest(BaseModel):
    code: str
    state: str

@app.post("/api/export/hubspot/oauth/callback")
async def hubspot_oauth_callback(
    request: OAuthCallbackRequest,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Handle HubSpot OAuth callback and store tokens"""
    try:
        print(f"OAuth callback started for user: {user_id}")
        print(f"Code: {request.code[:10]}...")
        print(f"State: {request.state}")
        
        # Verify state parameter contains user_id
        if not request.state.startswith(user_id):
            print(f"State verification failed: {request.state} doesn't start with {user_id}")
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Exchange code for tokens
        print("Starting token exchange...")
        hubspot = get_integration("hubspot", {})
        token_data = await hubspot.exchange_code_for_token(request.code)
        print(f"Token exchange successful. Access token: {token_data.get('access_token', '')[:10]}...")
        
        # Try to get portal info - but make it optional in case of scope issues
        portal_id = "unknown"
        try:
            print("Getting portal info...")
            portal_info = await hubspot.get_portal_info()
            portal_id = str(portal_info.get("portalId", "unknown"))
            print(f"Portal ID: {portal_id}")
        except Exception as portal_error:
            print(f"Portal info failed (non-critical): {portal_error}")
            # Use a fallback portal ID based on user
            portal_id = f"portal_{user_id[:8]}"
        
        # Store or update integration in database with simplified upsert
        print("Storing integration in database...")
        
        # Check if refresh_token exists (required by table schema)
        refresh_token = token_data.get("refresh_token")
        if not refresh_token:
            print("Warning: No refresh_token received, using access_token as fallback")
            refresh_token = token_data["access_token"]  # Fallback for schema constraint
        
        expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 21600))
        scopes = token_data.get("scope", "").split(" ") if token_data.get("scope") else ["contacts"]
        
        # Try to delete any existing records first to avoid unique constraint issues
        print("Cleaning up existing integrations...")
        delete_query = text("""
            DELETE FROM hubspot_integrations 
            WHERE user_id = :user_id
        """)
        await session.execute(delete_query, {"user_id": user_id})
        
        # Insert new record
        print("Inserting new integration record...")
        insert_query = text("""
            INSERT INTO hubspot_integrations 
            (user_id, hubspot_portal_id, access_token, refresh_token, expires_at, scopes, is_active)
            VALUES (:user_id, :portal_id, :access_token, :refresh_token, :expires_at, :scopes, true)
        """)
        
        await session.execute(insert_query, {
            "user_id": user_id,
            "portal_id": portal_id,
            "access_token": token_data["access_token"],
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "scopes": scopes
        })
        
        await session.commit()
        print("Database operation successful!")
        
        return {
            "status": "success",
            "portal_id": portal_id,
            "scopes": scopes,
            "expires_at": expires_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"OAuth callback error: {str(e)}")
        import traceback
        traceback.print_exc()
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
        print(f"Starting HubSpot import for user: {user_id}")
        
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
            print("No HubSpot integration found")
            raise HTTPException(status_code=400, detail="HubSpot integration not found")
        
        print("HubSpot integration found, checking token...")
        
        # Check if token needs refresh
        access_token = integration.access_token
        if integration.expires_at and integration.expires_at.replace(tzinfo=None) < datetime.utcnow():
            print("Token expired, refreshing...")
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
                print("Token refreshed successfully")
            except Exception as e:
                print(f"Token refresh failed: {str(e)}")
                raise HTTPException(status_code=401, detail=f"Token refresh failed: {str(e)}")
        else:
            print("Token is still valid")
        
        # Import contacts from HubSpot using direct API call
        print("Fetching contacts from HubSpot API...")
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                params = {
                    "limit": min(limit, 100),  # HubSpot max is 100
                    "properties": "firstname,lastname,email,phone,company,jobtitle,hs_lead_status,createdate,lastmodifieddate"
                }
                
                if after:
                    params["after"] = after
                
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
                
                response = await client.get(
                    "https://api.hubapi.com/crm/v3/objects/contacts",
                    headers=headers,
                    params=params,
                    timeout=30.0
                )
                
                print(f"HubSpot API response status: {response.status_code}")
                
                if response.status_code != 200:
                    print(f"HubSpot API error: {response.text}")
                    raise HTTPException(status_code=500, detail=f"HubSpot API error: {response.status_code} - {response.text}")
                
                data = response.json()
                
                # Transform HubSpot data to Captely format
                contacts = []
                for contact in data.get("results", []):
                    properties = contact.get("properties", {})
                    contacts.append({
                        "hubspot_id": contact["id"],
                        "first_name": properties.get("firstname", ""),
                        "last_name": properties.get("lastname", ""),
                        "email": properties.get("email", ""),
                        "phone": properties.get("phone", ""),
                        "company": properties.get("company", ""),
                        "position": properties.get("jobtitle", ""),
                        "status": properties.get("hs_lead_status", "new"),
                        "created_date": properties.get("createdate"),
                        "last_modified": properties.get("lastmodifieddate")
                    })
                
                print(f"Successfully fetched {len(contacts)} contacts from HubSpot")
                
                import_result = {
                    "contacts": contacts,
                    "paging": data.get("paging", {}),
                    "total": len(contacts)
                }
                
        except Exception as api_error:
            print(f"HubSpot API call failed: {str(api_error)}")
            raise HTTPException(status_code=500, detail=f"HubSpot API call failed: {str(api_error)}")
        
        # Create a new import job
        job_id = f"hubspot_import_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        print(f"Creating import job: {job_id}")
        
        try:
            # Check if import_jobs table exists, if not create simplified structure
            create_job_query = text("""
                INSERT INTO import_jobs (id, user_id, status, total, file_name)
                VALUES (:job_id, :user_id, 'completed', :total, :file_name)
                ON CONFLICT (id) DO UPDATE SET 
                    status = EXCLUDED.status,
                    total = EXCLUDED.total,
                    file_name = EXCLUDED.file_name
            """)
            
            await session.execute(create_job_query, {
                "job_id": job_id,
                "user_id": user_id,
                "total": import_result["total"],
                "file_name": f"HubSpot Import - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            })
            print("Import job created successfully")
            
        except Exception as job_error:
            print(f"Job creation failed: {str(job_error)}")
            # Continue without creating job record - focus on contact import
            pass
        
        # Insert imported contacts
        imported_count = 0
        print("Inserting contacts into database...")
        
        for contact in import_result["contacts"]:
            if contact.get("email"):  # Only import contacts with emails
                try:
                    # Simplified contact insert without ON CONFLICT for now
                    insert_contact_query = text("""
                        INSERT INTO contacts 
                        (job_id, first_name, last_name, email, phone, company, position, 
                         enriched, enrichment_status, notes, created_at)
                        VALUES 
                        (:job_id, :first_name, :last_name, :email, :phone, :company, :position,
                         false, 'pending', :notes, NOW())
                    """)
                    
                    await session.execute(insert_contact_query, {
                        "job_id": job_id,
                        "first_name": contact.get("first_name", "")[:255] if contact.get("first_name") else "",
                        "last_name": contact.get("last_name", "")[:255] if contact.get("last_name") else "",
                        "email": contact.get("email", "")[:255] if contact.get("email") else "",
                        "phone": contact.get("phone", "")[:50] if contact.get("phone") else "",
                        "company": contact.get("company", "")[:255] if contact.get("company") else "",
                        "position": contact.get("position", "")[:255] if contact.get("position") else "",
                        "notes": f"Imported from HubSpot (ID: {contact.get('hubspot_id', '')})"
                    })
                    imported_count += 1
                    
                except Exception as contact_error:
                    print(f"Failed to insert contact {contact.get('email', 'unknown')}: {str(contact_error)}")
                    # Continue with other contacts
                    continue
        
        await session.commit()
        print(f"Successfully imported {imported_count} contacts")
        
        # Try to log the import (optional)
        try:
            log_sync_query = text("""
                INSERT INTO hubspot_sync_logs 
                (user_id, integration_id, sync_type, operation, status, total_records, processed_records, started_at)
                SELECT :user_id, hi.id, 'import', 'contacts', 'completed', :total_records, :processed_records, NOW()
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
            print("Sync log created successfully")
        except Exception as log_error:
            print(f"Failed to create sync log: {str(log_error)}")
            # Non-critical error, continue
            pass
        
        return {
            "status": "success",
            "job_id": job_id,
            "imported_count": imported_count,
            "total_contacts": import_result["total"],
            "paging": import_result.get("paging", {}),
            "message": f"Successfully imported {imported_count} contacts from HubSpot"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Import failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
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

# NEW HUBSPOT EXPORT ENDPOINTS TO MATCH FRONTEND EXPECTATIONS
@app.post("/api/export/contacts/{contact_id}/export/hubspot")
async def export_single_contact_to_hubspot(
    contact_id: str,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Export a single contact to HubSpot"""
    try:
        print(f"Exporting single contact {contact_id} to HubSpot for user {user_id}")
        
        # Get contact details with user verification
        contact_query = text("""
            SELECT 
                c.first_name, c.last_name, c.email, c.phone, c.company, c.position,
                c.location, c.industry, c.notes, c.enriched, c.enrichment_score
            FROM contacts c
            JOIN import_jobs ij ON c.job_id = ij.id
            WHERE c.id = :contact_id AND ij.user_id = :user_id
        """)
        
        contact_result = await session.execute(contact_query, {"contact_id": contact_id, "user_id": user_id})
        contact_row = contact_result.fetchone()
        
        if not contact_row:
            raise HTTPException(status_code=404, detail="Contact not found or access denied")
        
        # Get HubSpot integration
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
            raise HTTPException(status_code=400, detail="HubSpot integration not found. Please connect HubSpot first.")
        
        # Check if token needs refresh
        access_token = integration.access_token
        if integration.expires_at and integration.expires_at.replace(tzinfo=None) < datetime.utcnow():
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
        
        # Prepare HubSpot contact data
        contact_data = {
            "properties": {
                "email": contact_row[2] or "",
                "firstname": contact_row[0] or "",
                "lastname": contact_row[1] or "",
                "phone": contact_row[3] or "",
                "company": contact_row[4] or "",
                "jobtitle": contact_row[5] or "",
                "city": contact_row[6] or "",
                "industry": contact_row[7] or "",
                "captely_contact_id": contact_id,
                "captely_enriched": str(contact_row[9]).lower() if contact_row[9] is not None else "false",
                "captely_enrichment_score": str(contact_row[10]) if contact_row[10] else "0",
                "hs_lead_status": "NEW",
                "lifecyclestage": "lead"
            }
        }
        
        if contact_row[8]:  # notes
            contact_data["properties"]["notes_last_contacted"] = contact_row[8]
        
        # Export to HubSpot using direct API call
        import httpx
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            response = await client.post(
                "https://api.hubapi.com/crm/v3/objects/contacts",
                headers=headers,
                json=contact_data,
                timeout=30.0
            )
            
            if response.status_code == 201:
                hubspot_contact = response.json()
                
                # Log the export
                try:
                    log_sync_query = text("""
                        INSERT INTO hubspot_sync_logs 
                        (user_id, integration_id, sync_type, operation, status, total_records, processed_records, started_at)
                        SELECT :user_id, hi.id, 'export', 'contact', 'completed', 1, 1, NOW()
                        FROM hubspot_integrations hi 
                        WHERE hi.user_id = :user_id AND hi.is_active = true
                        LIMIT 1
                    """)
                    
                    await session.execute(log_sync_query, {"user_id": user_id})
                    await session.commit()
                except Exception as log_error:
                    print(f"Failed to log export: {log_error}")
                
                return {
                    "success": True,
                    "platform": "hubspot",
                    "platform_contact_id": hubspot_contact["id"],
                    "contact_data": hubspot_contact,
                    "message": "Contact exported to HubSpot successfully!"
                }
            
            elif response.status_code == 409:  # Conflict - contact exists
                # Try to update the existing contact
                error_detail = response.json()
                if "email" in str(error_detail):
                    # Find existing contact by email
                    search_response = await client.post(
                        "https://api.hubapi.com/crm/v3/objects/contacts/search",
                        headers=headers,
                        json={
                            "filterGroups": [{
                                "filters": [{
                                    "propertyName": "email",
                                    "operator": "EQ",
                                    "value": contact_row[2]
                                }]
                            }]
                        }
                    )
                    
                    if search_response.status_code == 200:
                        search_data = search_response.json()
                        if search_data.get("results"):
                            existing_contact_id = search_data["results"][0]["id"]
                            
                            # Update existing contact
                            update_response = await client.patch(
                                f"https://api.hubapi.com/crm/v3/objects/contacts/{existing_contact_id}",
                                headers=headers,
                                json=contact_data
                            )
                            
                            if update_response.status_code == 200:
                                updated_contact = update_response.json()
                                return {
                                    "success": True,
                                    "platform": "hubspot", 
                                    "platform_contact_id": updated_contact["id"],
                                    "contact_data": updated_contact,
                                    "message": "Contact updated in HubSpot successfully!"
                                }
                
                raise HTTPException(status_code=500, detail="Contact exists but couldn't update")
            
            else:
                raise HTTPException(status_code=500, detail=f"HubSpot API error: {response.status_code} - {response.text}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Single contact export failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@app.post("/api/export/integrations/hubspot/export-batch")
async def export_batch_to_hubspot(
    request: dict,
    user_id: str = Depends(verify_api_token),
    session: AsyncSession = Depends(get_async_session)
):
    """Export a batch to HubSpot"""
    try:
        print(f"Exporting batch to HubSpot for user {user_id}")
        print(f"Request: {request}")
        
        job_id = request.get("job_id")
        if not job_id:
            raise HTTPException(status_code=422, detail="job_id is required")
        
        # Get contacts from the batch
        contacts_query = text("""
            SELECT 
                c.id, c.first_name, c.last_name, c.email, c.phone, 
                c.company, c.position, c.location, c.industry,
                c.enriched, c.enrichment_status, c.enrichment_score,
                c.notes, c.created_at, c.job_id
            FROM contacts c
            JOIN import_jobs j ON c.job_id = j.id
            WHERE c.job_id = :job_id AND j.user_id = :user_id AND c.email IS NOT NULL
            ORDER BY c.created_at DESC
        """)
        
        result = await session.execute(contacts_query, {
            "job_id": job_id, 
            "user_id": user_id
        })
        contacts = result.fetchall()
        
        if not contacts:
            raise HTTPException(status_code=404, detail="No contacts found in this batch")
        
        # Get HubSpot integration
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
            raise HTTPException(status_code=400, detail="HubSpot integration not found. Please connect HubSpot first.")
        
        # Check if token needs refresh
        access_token = integration.access_token
        if integration.expires_at and integration.expires_at.replace(tzinfo=None) < datetime.utcnow():
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
        
        # Convert contacts to HubSpot format
        hubspot_contacts = []
        for contact in contacts:
            contact_data = {
                "properties": {
                    "firstname": contact[1] or "",
                    "lastname": contact[2] or "",
                    "email": contact[3] or "",
                    "phone": contact[4] or "",
                    "company": contact[5] or "",
                    "jobtitle": contact[6] or "",
                    "city": contact[7] or "",
                    "industry": contact[8] or "",
                    "captely_contact_id": str(contact[0]),
                    "captely_enriched": str(contact[9]).lower() if contact[9] is not None else "false",
                    "captely_enrichment_score": str(contact[11]) if contact[11] else "0",
                    "hs_lead_status": "NEW",
                    "lifecyclestage": "lead"
                }
            }
            
            if contact[12]:  # notes
                contact_data["properties"]["notes_last_contacted"] = contact[12]
            
            hubspot_contacts.append(contact_data)
        
        # Export to HubSpot in batches of 100
        exported_count = 0
        failed_count = 0
        
        import httpx
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            for i in range(0, len(hubspot_contacts), 100):
                batch = hubspot_contacts[i:i+100]
                
                try:
                    response = await client.post(
                        "https://api.hubapi.com/crm/v3/objects/contacts/batch/create",
                        headers=headers,
                        json={"inputs": batch},
                        timeout=60.0
                    )
                    
                    if response.status_code == 201:
                        batch_result = response.json()
                        exported_count += len(batch_result.get("results", []))
                        print(f"Successfully exported batch {i//100 + 1}: {len(batch_result.get('results', []))} contacts")
                    else:
                        failed_count += len(batch)
                        print(f"HubSpot batch export failed: {response.status_code} - {response.text}")
                        
                except Exception as batch_error:
                    failed_count += len(batch)
                    print(f"Batch export error: {batch_error}")
        
        # Log the export
        try:
            log_sync_query = text("""
                INSERT INTO hubspot_sync_logs 
                (user_id, integration_id, sync_type, operation, status, total_records, processed_records, failed_records, started_at)
                SELECT :user_id, hi.id, 'export', 'batch', :status, :total_records, :processed_records, :failed_records, NOW()
                FROM hubspot_integrations hi 
                WHERE hi.user_id = :user_id AND hi.is_active = true
                LIMIT 1
            """)
            
            status = "completed" if failed_count == 0 else ("partial" if exported_count > 0 else "failed")
            
            await session.execute(log_sync_query, {
                "user_id": user_id,
                "status": status,
                "total_records": len(contacts),
                "processed_records": exported_count,
                "failed_records": failed_count
            })
            await session.commit()
        except Exception as log_error:
            print(f"Failed to log batch export: {log_error}")
        
        return {
            "success": True,
            "job_id": job_id,
            "exported": exported_count,
            "failed": failed_count,
            "total_contacts": len(contacts),
            "message": f"Successfully exported {exported_count} out of {len(contacts)} contacts to HubSpot"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error exporting batch to HubSpot: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to export batch to HubSpot: {str(e)}")

# Column customization endpoint
@app.get("/api/export/columns/{job_id}")
async def get_available_columns(
    job_id: str,
    user_id: str = Depends(verify_api_token),
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
    user_id: str = Depends(verify_api_token),
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