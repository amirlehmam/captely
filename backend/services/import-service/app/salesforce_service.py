"""
Salesforce Integration Service
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

class SalesforceService:
    def __init__(self):
        # Replace with your actual Salesforce Connected App credentials
        self.client_id = "3MVG9n_HvETGhr3AH5kJyoYHHZnU_5pALrlcfDQQpCdQRkIZOVDk_zZT3pCK5eJZ8F_cPxYyqBqCtTHcFhTjp"
        self.client_secret = "4F3D2E1C8B7A5F6E9D8C7B6A5E4D3C2B1A9F8E7D6C5B4A3E2D1C9B8A7F6E5D4C3B2A1"
        self.redirect_uri = "https://captely.com/integrations"
        self.login_url = "https://login.salesforce.com"
        self.sandbox_url = "https://test.salesforce.com"
        self.api_version = "v58.0"
        
    def get_oauth_url(self, state: str = None, use_sandbox: bool = False) -> str:
        """Generate OAuth URL for Salesforce authorization"""
        base_url = self.sandbox_url if use_sandbox else self.login_url
        
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "api refresh_token offline_access"
        }
        
        if state:
            params["state"] = state
            
        return f"{base_url}/services/oauth2/authorize?{urlencode(params)}"
    
    async def exchange_code_for_tokens(self, code: str, use_sandbox: bool = False) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens"""
        base_url = self.sandbox_url if use_sandbox else self.login_url
        
        async with httpx.AsyncClient() as client:
            data = {
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "code": code
            }
            
            response = await client.post(
                f"{base_url}/services/oauth2/token",
                data=data
            )
            response.raise_for_status()
            return response.json()
    
    async def refresh_access_token(self, refresh_token: str, instance_url: str) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        async with httpx.AsyncClient() as client:
            data = {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token
            }
            
            # Use the instance URL from the original token
            token_url = f"{instance_url}/services/oauth2/token"
            response = await client.post(token_url, data=data)
            response.raise_for_status()
            return response.json()
    
    async def make_api_request(self, session: AsyncSession, user_id: str, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated API request to Salesforce"""
        # Get valid access token from database
        query = text("""
            SELECT access_token, refresh_token, expires_at, salesforce_instance_url 
            FROM salesforce_integrations 
            WHERE user_id = :user_id AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        """)
        result = await session.execute(query, {"user_id": user_id})
        integration = result.fetchone()
        
        if not integration:
            raise Exception("No Salesforce integration found")
            
        access_token, refresh_token, expires_at, instance_url = integration
        
        # Check if token needs refresh
        if datetime.now() >= expires_at - timedelta(minutes=5):
            try:
                token_data = await self.refresh_access_token(refresh_token, instance_url)
                
                # Update database with new tokens
                update_query = text("""
                    UPDATE salesforce_integrations 
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
                logging.error(f"Failed to refresh Salesforce token for user {user_id}: {e}")
                raise Exception("Failed to refresh Salesforce access token")
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=f"{instance_url}/services/data/{self.api_version}{endpoint}",
                headers=headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()
    
    def map_captely_to_salesforce(self, captely_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Map Captely contact fields to Salesforce Contact fields"""
        salesforce_contact = {}
        
        # Basic mapping
        field_mapping = {
            "first_name": "FirstName",
            "last_name": "LastName", 
            "email": "Email",
            "phone": "Phone",
            "company": "Account.Name",  # This might need special handling
            "position": "Title",
            "location": "MailingCity",
            "industry": "Industry__c"  # Custom field
        }
        
        for captely_field, salesforce_field in field_mapping.items():
            if captely_contact.get(captely_field):
                # Handle special case for Account
                if salesforce_field == "Account.Name":
                    salesforce_contact["AccountId"] = None  # Will need to lookup/create account
                    salesforce_contact["Account_Name__c"] = captely_contact[captely_field]
                else:
                    salesforce_contact[salesforce_field] = captely_contact[captely_field]
        
        # Add enrichment metadata
        if captely_contact.get("enriched"):
            salesforce_contact["Captely_Enriched__c"] = True
            salesforce_contact["Captely_Enrichment_Date__c"] = datetime.now().isoformat()
            
        if captely_contact.get("enrichment_score"):
            salesforce_contact["Captely_Enrichment_Score__c"] = captely_contact["enrichment_score"]
            
        if captely_contact.get("email_verified"):
            salesforce_contact["Captely_Email_Verified__c"] = True
            
        if captely_contact.get("phone_verified"):
            salesforce_contact["Captely_Phone_Verified__c"] = True
        
        return salesforce_contact
    
    def map_salesforce_to_captely(self, salesforce_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Map Salesforce Contact to Captely format"""
        captely_contact = {
            "first_name": salesforce_contact.get("FirstName", ""),
            "last_name": salesforce_contact.get("LastName", ""),
            "email": salesforce_contact.get("Email", ""),
            "phone": salesforce_contact.get("Phone", ""),
            "company": salesforce_contact.get("Account", {}).get("Name", "") if salesforce_contact.get("Account") else "",
            "position": salesforce_contact.get("Title", ""),
            "location": salesforce_contact.get("MailingCity", ""),
            "industry": salesforce_contact.get("Industry__c", ""),
            "profile_url": f"https://your-instance.salesforce.com/{salesforce_contact.get('Id', '')}",
            "enriched": False,
            "enrichment_status": "pending"
        }
        
        return captely_contact
    
    async def import_contacts_from_salesforce(self, session: AsyncSession, user_id: str, job_id: str) -> Dict[str, Any]:
        """Import contacts from Salesforce to Captely"""
        imported_count = 0
        
        try:
            # Build SOQL query to get contacts
            soql_query = """
                SELECT Id, FirstName, LastName, Email, Phone, Title, 
                       MailingCity, MailingState, MailingCountry, Account.Name
                FROM Contact 
                WHERE Email != null 
                ORDER BY CreatedDate DESC 
                LIMIT 200
            """
            
            response = await self.make_api_request(
                session, user_id, "GET", "/query",
                params={"q": soql_query}
            )
            
            contacts = response.get("records", [])
            
            # Import each contact
            for salesforce_contact in contacts:
                try:
                    captely_contact = self.map_salesforce_to_captely(salesforce_contact)
                    
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
                        INSERT INTO salesforce_contact_mappings 
                        (user_id, captely_contact_id, salesforce_contact_id)
                        VALUES (:user_id, :captely_id, :salesforce_id)
                    """)
                    
                    await session.execute(mapping_query, {
                        "user_id": user_id,
                        "captely_id": captely_contact_id,
                        "salesforce_id": salesforce_contact["Id"]
                    })
                    
                    imported_count += 1
                    
                except Exception as e:
                    logging.error(f"Failed to import Salesforce contact {salesforce_contact.get('Id')}: {e}")
                    continue
            
            await session.commit()
            
            return {
                "imported_count": imported_count,
                "total_contacts": len(contacts),
                "message": f"Successfully imported {imported_count} contacts from Salesforce"
            }
            
        except Exception as e:
            logging.error(f"Salesforce import failed: {e}")
            await session.rollback()
            raise Exception(f"Failed to import from Salesforce: {str(e)}")
    
    async def export_contacts_to_salesforce(self, session: AsyncSession, user_id: str, contact_ids: List[int]) -> Dict[str, Any]:
        """Export contacts to Salesforce"""
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
                    
                    salesforce_contact = self.map_captely_to_salesforce(contact_dict)
                    
                    # Create or update contact in Salesforce
                    response = await self.make_api_request(
                        session, user_id, "POST", "/sobjects/Contact",
                        json=salesforce_contact
                    )
                    
                    if response.get("success"):
                        # Create mapping record
                        mapping_query = text("""
                            INSERT INTO salesforce_contact_mappings 
                            (user_id, captely_contact_id, salesforce_contact_id)
                            VALUES (:user_id, :captely_id, :salesforce_id)
                            ON CONFLICT (captely_contact_id, salesforce_contact_id) DO NOTHING
                        """)
                        
                        await session.execute(mapping_query, {
                            "user_id": user_id,
                            "captely_id": contact_dict["id"],
                            "salesforce_id": response["id"]
                        })
                        
                        exported_count += 1
                    else:
                        failed_count += 1
                        errors.append(f"Failed to create contact {contact_dict['email']}")
                        
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
            logging.error(f"Salesforce export failed: {e}")
            await session.rollback()
            raise Exception(f"Failed to export to Salesforce: {str(e)}") 