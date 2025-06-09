"""
HubSpot Integration Service
Handles OAuth authentication, token management, and contact synchronization
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from common.config import get_settings

settings = get_settings()

class HubSpotService:
    def __init__(self):
        self.client_id = "0f881091-86be-4d35-bb38-f98365bd62ec"
        self.client_secret = "7608da7f-4549-4aa7-94b4-303a7ea0de83"
        self.redirect_uri = "https://captely.com/integrations"
        self.base_url = "https://api.hubapi.com"
        self.oauth_base_url = "https://app-eu1.hubspot.com"
        
    def get_oauth_url(self, state: str = None) -> str:
        """Generate OAuth URL for HubSpot authorization"""
        scopes = [
            "contacts",
            "crm.objects.contacts.read",
            "crm.objects.contacts.write",
            "crm.lists.read",
            "crm.lists.write"
        ]
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(scopes),
            "response_type": "code"
        }
        
        if state:
            params["state"] = state
            
        return f"{self.oauth_base_url}/oauth/authorize?{urlencode(params)}"
    
    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens"""
        async with httpx.AsyncClient() as client:
            data = {
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "code": code
            }
            
            response = await client.post(
                f"{self.oauth_base_url}/oauth/v1/token",
                data=data
            )
            response.raise_for_status()
            return response.json()
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        async with httpx.AsyncClient() as client:
            data = {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token
            }
            
            response = await client.post(
                f"{self.oauth_base_url}/oauth/v1/token",
                data=data
            )
            response.raise_for_status()
            return response.json()
    
    async def make_api_request(self, session: AsyncSession, user_id: str, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated API request to HubSpot"""
        # Get valid access token from database
        query = text("""
            SELECT access_token, refresh_token, expires_at 
            FROM hubspot_integrations 
            WHERE user_id = :user_id AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        """)
        result = await session.execute(query, {"user_id": user_id})
        integration = result.fetchone()
        
        if not integration:
            raise Exception("No HubSpot integration found")
            
        access_token, refresh_token, expires_at = integration
        
        # Check if token needs refresh
        if datetime.now() >= expires_at - timedelta(minutes=5):
            try:
                token_data = await self.refresh_access_token(refresh_token)
                
                # Update database with new tokens
                update_query = text("""
                    UPDATE hubspot_integrations 
                    SET access_token = :access_token,
                        expires_at = :expires_at,
                        updated_at = NOW()
                    WHERE user_id = :user_id AND is_active = TRUE
                """)
                
                expires_at = datetime.now() + timedelta(seconds=token_data['expires_in'])
                await session.execute(update_query, {
                    "user_id": user_id,
                    "access_token": token_data['access_token'],
                    "expires_at": expires_at
                })
                await session.commit()
                
                access_token = token_data['access_token']
            except Exception as e:
                logging.error(f"Failed to refresh HubSpot token for user {user_id}: {e}")
                raise Exception("Failed to refresh HubSpot access token")
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=f"{self.base_url}{endpoint}",
                headers=headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()
    
    def map_captely_to_hubspot(self, captely_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Map Captely contact fields to HubSpot properties"""
        hubspot_contact = {}
        
        # Basic mapping
        field_mapping = {
            "first_name": "firstname",
            "last_name": "lastname", 
            "email": "email",
            "phone": "phone",
            "company": "company",
            "position": "jobtitle",
            "location": "city",
            "industry": "industry"
        }
        
        for captely_field, hubspot_field in field_mapping.items():
            if captely_contact.get(captely_field):
                hubspot_contact[hubspot_field] = captely_contact[captely_field]
        
        # Add enrichment metadata
        if captely_contact.get("enriched"):
            hubspot_contact["captely_enriched"] = "true"
            hubspot_contact["captely_enrichment_date"] = datetime.now().isoformat()
            
        if captely_contact.get("enrichment_score"):
            hubspot_contact["captely_enrichment_score"] = str(captely_contact["enrichment_score"])
            
        if captely_contact.get("email_verified"):
            hubspot_contact["captely_email_verified"] = "true"
            
        if captely_contact.get("phone_verified"):
            hubspot_contact["captely_phone_verified"] = "true"
        
        return hubspot_contact
    
    def map_hubspot_to_captely(self, hubspot_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Map HubSpot contact to Captely format"""
        properties = hubspot_contact.get("properties", {})
        
        captely_contact = {
            "first_name": properties.get("firstname", ""),
            "last_name": properties.get("lastname", ""),
            "email": properties.get("email", ""),
            "phone": properties.get("phone", ""),
            "company": properties.get("company", ""),
            "position": properties.get("jobtitle", ""),
            "location": properties.get("city", ""),
            "industry": properties.get("industry", ""),
            "profile_url": f"https://app.hubspot.com/contacts/{properties.get('hs_object_id', '')}",
            "enriched": False,
            "enrichment_status": "pending"
        }
        
        return captely_contact
    
    async def import_contacts_from_hubspot(self, session: AsyncSession, user_id: str, job_id: str) -> Dict[str, Any]:
        """Import contacts from HubSpot to Captely"""
        total_imported = 0
        total_failed = 0
        after = None
        
        # Create sync log
        log_query = text("""
            INSERT INTO hubspot_sync_logs (user_id, integration_id, sync_type, operation, status, started_at)
            SELECT :user_id, hi.id, 'import', 'contacts', 'in_progress', NOW()
            FROM hubspot_integrations hi
            WHERE hi.user_id = :user_id AND hi.is_active = TRUE
            RETURNING id
        """)
        log_result = await session.execute(log_query, {"user_id": user_id})
        sync_log_id = log_result.scalar()
        await session.commit()
        
        try:
            while True:
                # Get batch of contacts from HubSpot
                response = await self.make_api_request(
                    session, user_id, "GET", "/crm/v3/objects/contacts",
                    params={"limit": 100, "properties": ["firstname", "lastname", "email", "phone", "company", "jobtitle", "city", "state", "country", "website"]}
                )
                contacts = response.get("results", [])
                
                if not contacts:
                    break
                
                # Import each contact
                for hubspot_contact in contacts:
                    try:
                        captely_contact = self.map_hubspot_to_captely(hubspot_contact)
                        
                        # Insert into contacts table
                        insert_query = text("""
                            INSERT INTO contacts (
                                job_id, first_name, last_name, email, phone, company, 
                                position, location, industry, profile_url, enriched, 
                                enrichment_status, created_at
                            ) VALUES (
                                :job_id, :first_name, :last_name, :email, :phone, :company,
                                :position, :location, :industry, :profile_url, :enriched,
                                :enrichment_status, NOW()
                            ) RETURNING id
                        """)
                        
                        contact_result = await session.execute(insert_query, {
                            "job_id": job_id,
                            **captely_contact
                        })
                        captely_contact_id = contact_result.scalar()
                        
                        # Create mapping
                        mapping_query = text("""
                            INSERT INTO hubspot_contact_mappings (
                                user_id, captely_contact_id, hubspot_contact_id, 
                                sync_status, created_at
                            ) VALUES (:user_id, :captely_contact_id, :hubspot_contact_id, 'synced', NOW())
                        """)
                        
                        await session.execute(mapping_query, {
                            "user_id": user_id,
                            "captely_contact_id": captely_contact_id,
                            "hubspot_contact_id": hubspot_contact["id"]
                        })
                        
                        total_imported += 1
                        
                    except Exception as e:
                        logging.error(f"Failed to import contact {hubspot_contact.get('id')}: {e}")
                        total_failed += 1
                
                # Check for next page
                paging = response.get("paging", {})
                after = paging.get("next", {}).get("after")
                if not after:
                    break
            
            # Update sync log
            update_log_query = text("""
                UPDATE hubspot_sync_logs 
                SET status = 'completed', processed_records = :imported, 
                    failed_records = :failed, completed_at = NOW()
                WHERE id = :sync_log_id
            """)
            await session.execute(update_log_query, {
                "sync_log_id": sync_log_id,
                "imported": total_imported,
                "failed": total_failed
            })
            await session.commit()
            
            return {
                "success": True,
                "imported": total_imported,
                "failed": total_failed,
                "sync_log_id": sync_log_id
            }
            
        except Exception as e:
            # Update sync log with error
            error_log_query = text("""
                UPDATE hubspot_sync_logs 
                SET status = 'failed', error_message = :error, completed_at = NOW()
                WHERE id = :sync_log_id
            """)
            await session.execute(error_log_query, {
                "sync_log_id": sync_log_id,
                "error": str(e)
            })
            await session.commit()
            raise
    
    async def export_contacts_to_hubspot(self, session: AsyncSession, user_id: str, contact_ids: List[int]) -> Dict[str, Any]:
        """Export Captely contacts to HubSpot"""
        total_exported = 0
        total_failed = 0
        
        # Create sync log
        log_query = text("""
            INSERT INTO hubspot_sync_logs (user_id, integration_id, sync_type, operation, status, total_records, started_at)
            SELECT :user_id, hi.id, 'export', 'contacts', 'in_progress', :total_records, NOW()
            FROM hubspot_integrations hi
            WHERE hi.user_id = :user_id AND hi.is_active = TRUE
            RETURNING id
        """)
        log_result = await session.execute(log_query, {
            "user_id": user_id,
            "total_records": len(contact_ids)
        })
        sync_log_id = log_result.scalar()
        await session.commit()
        
        try:
            # Get contacts from database
            contacts_query = text("""
                SELECT id, first_name, last_name, email, phone, company, position, 
                       location, industry, enriched, enrichment_score, email_verified, phone_verified
                FROM contacts 
                WHERE id = ANY(:contact_ids)
            """)
            
            contacts_result = await session.execute(contacts_query, {"contact_ids": contact_ids})
            contacts = contacts_result.fetchall()
            
            # Process in batches of 100 (HubSpot limit)
            batch_size = 100
            for i in range(0, len(contacts), batch_size):
                batch = contacts[i:i + batch_size]
                hubspot_contacts = []
                
                for contact in batch:
                    contact_dict = {
                        "id": contact[0],
                        "first_name": contact[1],
                        "last_name": contact[2],
                        "email": contact[3],
                        "phone": contact[4],
                        "company": contact[5],
                        "position": contact[6],
                        "location": contact[7],
                        "industry": contact[8],
                        "enriched": contact[9],
                        "enrichment_score": contact[10],
                        "email_verified": contact[11],
                        "phone_verified": contact[12]
                    }
                    
                    hubspot_contact = self.map_captely_to_hubspot(contact_dict)
                    hubspot_contacts.append(hubspot_contact)
                
                try:
                    # Batch create in HubSpot
                    result = await self.make_api_request(
                        session, user_id, "POST", "/crm/v3/objects/contacts/batch/create",
                        json={"inputs": hubspot_contacts}
                    )
                    
                    # Process results and create mappings
                    for j, hubspot_result in enumerate(result.get("results", [])):
                        contact = batch[j]
                        captely_contact_id = contact[0]
                        hubspot_contact_id = hubspot_result["id"]
                        
                        # Create mapping
                        mapping_query = text("""
                            INSERT INTO hubspot_contact_mappings (
                                user_id, captely_contact_id, hubspot_contact_id, 
                                sync_status, created_at
                            ) VALUES (:user_id, :captely_contact_id, :hubspot_contact_id, 'synced', NOW())
                            ON CONFLICT (user_id, captely_contact_id) DO UPDATE SET
                                hubspot_contact_id = :hubspot_contact_id,
                                sync_status = 'synced',
                                last_synced_at = NOW()
                        """)
                        
                        await session.execute(mapping_query, {
                            "user_id": user_id,
                            "captely_contact_id": captely_contact_id,
                            "hubspot_contact_id": hubspot_contact_id
                        })
                        
                        total_exported += 1
                        
                except Exception as e:
                    logging.error(f"Failed to export batch: {e}")
                    total_failed += len(batch)
            
            # Update sync log
            update_log_query = text("""
                UPDATE hubspot_sync_logs 
                SET status = 'completed', processed_records = :exported, 
                    failed_records = :failed, completed_at = NOW()
                WHERE id = :sync_log_id
            """)
            await session.execute(update_log_query, {
                "sync_log_id": sync_log_id,
                "exported": total_exported,
                "failed": total_failed
            })
            await session.commit()
            
            return {
                "success": True,
                "exported": total_exported,
                "failed": total_failed,
                "sync_log_id": sync_log_id
            }
            
        except Exception as e:
            # Update sync log with error
            error_log_query = text("""
                UPDATE hubspot_sync_logs 
                SET status = 'failed', error_message = :error, completed_at = NOW()
                WHERE id = :sync_log_id
            """)
            await session.execute(error_log_query, {
                "sync_log_id": sync_log_id,
                "error": str(e)
            })
            await session.commit()
            raise 