"""
Lemlist Integration Service
Handles API key authentication and contact synchronization
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

class LemlistService:
    def __init__(self):
        self.base_url = "https://api.lemlist.com/api"
        self.api_version = "v1"
        
    def get_auth_setup_url(self) -> str:
        """Generate URL for Lemlist API key setup instructions"""
        return "https://help.lemlist.com/en/articles/3398065-generating-your-api-key"
    
    async def verify_api_key(self, api_key: str) -> Dict[str, Any]:
        """Verify API key and get account information"""
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {api_key}"}
            
            response = await client.get(
                f"{self.base_url}/me",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
    
    async def make_api_request(self, session: AsyncSession, user_id: str, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated API request to Lemlist"""
        # Get API key from database
        query = text("""
            SELECT lemlist_api_key, lemlist_account_id 
            FROM lemlist_integrations 
            WHERE user_id = :user_id AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        """)
        result = await session.execute(query, {"user_id": user_id})
        integration = result.fetchone()
        
        if not integration:
            raise Exception("No Lemlist integration found")
            
        api_key, account_id = integration
        
        headers = {
            "Authorization": f"Bearer {api_key}",
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
    
    def map_captely_to_lemlist(self, captely_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Map Captely contact fields to Lemlist lead fields"""
        lemlist_lead = {}
        
        # Basic mapping
        field_mapping = {
            "first_name": "firstName",
            "last_name": "lastName", 
            "email": "email",
            "phone": "phoneNumber",
            "company": "companyName",
            "position": "jobTitle",
            "location": "city",
            "industry": "industry"
        }
        
        for captely_field, lemlist_field in field_mapping.items():
            if captely_contact.get(captely_field):
                lemlist_lead[lemlist_field] = captely_contact[captely_field]
        
        # Add enrichment metadata as custom fields
        if captely_contact.get("enriched"):
            lemlist_lead["customFields"] = lemlist_lead.get("customFields", {})
            lemlist_lead["customFields"]["captely_enriched"] = "true"
            lemlist_lead["customFields"]["captely_enrichment_date"] = datetime.now().isoformat()
            
        if captely_contact.get("enrichment_score"):
            lemlist_lead["customFields"] = lemlist_lead.get("customFields", {})
            lemlist_lead["customFields"]["captely_enrichment_score"] = str(captely_contact["enrichment_score"])
            
        if captely_contact.get("email_verified"):
            lemlist_lead["customFields"] = lemlist_lead.get("customFields", {})
            lemlist_lead["customFields"]["captely_email_verified"] = "true"
            
        if captely_contact.get("phone_verified"):
            lemlist_lead["customFields"] = lemlist_lead.get("customFields", {})
            lemlist_lead["customFields"]["captely_phone_verified"] = "true"
        
        return lemlist_lead
    
    def map_lemlist_to_captely(self, lemlist_lead: Dict[str, Any]) -> Dict[str, Any]:
        """Map Lemlist lead to Captely format"""
        captely_contact = {
            "first_name": lemlist_lead.get("firstName", ""),
            "last_name": lemlist_lead.get("lastName", ""),
            "email": lemlist_lead.get("email", ""),
            "phone": lemlist_lead.get("phoneNumber", ""),
            "company": lemlist_lead.get("companyName", ""),
            "position": lemlist_lead.get("jobTitle", ""),
            "location": lemlist_lead.get("city", ""),
            "industry": lemlist_lead.get("industry", ""),
            "profile_url": f"https://app.lemlist.com/leads/{lemlist_lead.get('_id', '')}",
            "enriched": False,
            "enrichment_status": "pending"
        }
        
        return captely_contact
    
    async def get_campaigns(self, session: AsyncSession, user_id: str) -> List[Dict]:
        """Get available Lemlist campaigns"""
        try:
            response = await self.make_api_request(
                session, user_id, "GET", "/campaigns"
            )
            
            campaigns = []
            for campaign in response.get("campaigns", []):
                campaigns.append({
                    "id": campaign["_id"],
                    "name": campaign["name"],
                    "status": campaign.get("status", "draft"),
                    "created_at": campaign.get("createdAt")
                })
            
            return campaigns
            
        except Exception as e:
            logging.error(f"Failed to get Lemlist campaigns: {e}")
            return []
    
    async def import_contacts_from_lemlist(self, session: AsyncSession, user_id: str, job_id: str, campaign_id: str = None) -> Dict[str, Any]:
        """Import contacts from Lemlist to Captely"""
        imported_count = 0
        
        try:
            # Get leads from specific campaign or all leads
            if campaign_id:
                endpoint = f"/campaigns/{campaign_id}/leads"
            else:
                endpoint = "/leads"
            
            response = await self.make_api_request(
                session, user_id, "GET", endpoint,
                params={"limit": 100}
            )
            
            leads = response.get("leads", [])
            
            # Import each lead
            for lemlist_lead in leads:
                try:
                    captely_contact = self.map_lemlist_to_captely(lemlist_lead)
                    
                    # Skip if no email
                    if not captely_contact.get("email"):
                        continue
                    
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
                    
                    # Create mapping record
                    mapping_query = text("""
                        INSERT INTO lemlist_contact_mappings 
                        (user_id, captely_contact_id, lemlist_contact_id, lemlist_campaign_id)
                        VALUES (:user_id, :captely_id, :lemlist_id, :campaign_id)
                    """)
                    
                    await session.execute(mapping_query, {
                        "user_id": user_id,
                        "captely_id": captely_contact_id,
                        "lemlist_id": lemlist_lead["_id"],
                        "campaign_id": campaign_id
                    })
                    
                    imported_count += 1
                    
                except Exception as e:
                    logging.error(f"Failed to import Lemlist lead {lemlist_lead.get('_id')}: {e}")
                    continue
            
            await session.commit()
            
            return {
                "imported_count": imported_count,
                "total_contacts": len(leads),
                "message": f"Successfully imported {imported_count} contacts from Lemlist"
            }
            
        except Exception as e:
            logging.error(f"Lemlist import failed: {e}")
            await session.rollback()
            raise Exception(f"Failed to import from Lemlist: {str(e)}")
    
    async def export_contacts_to_lemlist(self, session: AsyncSession, user_id: str, contact_ids: List[int], campaign_id: str) -> Dict[str, Any]:
        """Export contacts to Lemlist campaign"""
        exported_count = 0
        failed_count = 0
        errors = []
        
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
            
            # Process contacts
            for contact in contacts:
                try:
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
                    
                    lemlist_lead = self.map_captely_to_lemlist(contact_dict)
                    
                    # Add lead to campaign
                    response = await self.make_api_request(
                        session, user_id, "POST", f"/campaigns/{campaign_id}/leads",
                        json=lemlist_lead
                    )
                    
                    if response.get("_id"):
                        # Create mapping record
                        mapping_query = text("""
                            INSERT INTO lemlist_contact_mappings 
                            (user_id, captely_contact_id, lemlist_contact_id, lemlist_campaign_id)
                            VALUES (:user_id, :captely_id, :lemlist_id, :campaign_id)
                            ON CONFLICT (captely_contact_id, lemlist_contact_id) DO NOTHING
                        """)
                        
                        await session.execute(mapping_query, {
                            "user_id": user_id,
                            "captely_id": contact_dict["id"],
                            "lemlist_id": response["_id"],
                            "campaign_id": campaign_id
                        })
                        
                        exported_count += 1
                    else:
                        failed_count += 1
                        errors.append(f"Failed to add lead {contact_dict['email']} to campaign")
                        
                except Exception as e:
                    failed_count += 1
                    errors.append(f"Error processing contact {contact[3]}: {str(e)}")
            
            await session.commit()
            
            return {
                "exported_count": exported_count,
                "failed_count": failed_count,
                "errors": errors
            }
            
        except Exception as e:
            logging.error(f"Lemlist export failed: {e}")
            await session.rollback()
            raise Exception(f"Failed to export to Lemlist: {str(e)}")
    
    async def create_campaign(self, session: AsyncSession, user_id: str, campaign_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new Lemlist campaign"""
        try:
            response = await self.make_api_request(
                session, user_id, "POST", "/campaigns",
                json=campaign_data
            )
            
            return {
                "campaign_id": response["_id"],
                "name": response["name"],
                "status": response.get("status", "draft")
            }
            
        except Exception as e:
            logging.error(f"Failed to create Lemlist campaign: {e}")
            raise Exception(f"Failed to create campaign: {str(e)}")
    
    async def start_campaign(self, session: AsyncSession, user_id: str, campaign_id: str) -> Dict[str, Any]:
        """Start a Lemlist campaign"""
        try:
            response = await self.make_api_request(
                session, user_id, "PATCH", f"/campaigns/{campaign_id}/start"
            )
            
            return {
                "campaign_id": campaign_id,
                "status": "started",
                "message": "Campaign started successfully"
            }
            
        except Exception as e:
            logging.error(f"Failed to start Lemlist campaign: {e}")
            raise Exception(f"Failed to start campaign: {str(e)}") 