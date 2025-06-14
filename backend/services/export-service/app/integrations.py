# services/export-service/app/integrations.py

import httpx
import os
import secrets
import base64
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json
import asyncio
from urllib.parse import urlencode, parse_qs

class HubSpotIntegration:
    def __init__(self, access_token: str = None, client_id: str = None, client_secret: str = None):
        # Use your actual HubSpot app credentials
        self.client_id = client_id or "97e92d37-3102-4bbc-bfa4-3f7adafab72e"
        self.client_secret = client_secret or "87496fab-9610-4853-86a7-5900bb21e0cf"
        self.redirect_uri = "https://captely.com/integrations"
        self.access_token = access_token
        
        # HubSpot API configuration
        self.base_url = "https://api.hubapi.com"
        self.auth_url = "https://app-eu1.hubspot.com/oauth/authorize"
        self.token_url = "https://api.hubapi.com/oauth/v1/token"
        
        # HubSpot scopes - minimal set for testing account permissions
        self.scopes = [
            "crm.objects.contacts.read",
            "crm.objects.contacts.write", 
            "crm.lists.read",
            "crm.lists.write",
            "oauth"
        ]
        
        self.headers = {
            "Content-Type": "application/json"
        }
        
        if self.access_token:
            self.headers["Authorization"] = f"Bearer {self.access_token}"
    
    def get_auth_url(self, state: str = None) -> str:
        """Generate HubSpot OAuth authorization URL"""
        if not state:
            state = secrets.token_urlsafe(32)
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.scopes),
            "state": state
        }
        
        return f"{self.auth_url}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """Exchange authorization code for access token"""
        async with httpx.AsyncClient() as client:
            data = {
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "code": code
            }
            
            response = await client.post(
                self.token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.access_token = token_data["access_token"]
                self.headers["Authorization"] = f"Bearer {self.access_token}"
                return token_data
            else:
                raise Exception(f"Failed to exchange code: {response.text}")
    
    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """Refresh an expired access token"""
        async with httpx.AsyncClient() as client:
            data = {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token
            }
            
            response = await client.post(
                self.token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.access_token = token_data["access_token"]
                self.headers["Authorization"] = f"Bearer {self.access_token}"
                return token_data
            else:
                raise Exception(f"Failed to refresh token: {response.text}")
    
    async def get_portal_info(self) -> Dict:
        """Get HubSpot portal information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/account-info/v3/api-usage",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Failed to get portal info: {response.text}")
    
    async def import_contacts(self, limit: int = 100, after: str = None) -> Dict:
        """Import contacts from HubSpot"""
        async with httpx.AsyncClient() as client:
            params = {
                "limit": min(limit, 100),  # HubSpot max is 100
                "properties": "firstname,lastname,email,phone,company,jobtitle,hs_lead_status,createdate,lastmodifieddate"
            }
            
            if after:
                params["after"] = after
            
            response = await client.get(
                f"{self.base_url}/crm/v3/objects/contacts",
                headers=self.headers,
                params=params
            )
            
            if response.status_code == 200:
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
                
                return {
                    "contacts": contacts,
                    "paging": data.get("paging", {}),
                    "total": len(contacts)
                }
            else:
                raise Exception(f"Failed to import contacts: {response.text}")
    
    async def create_or_update_contacts(self, contacts: List[Dict]) -> Dict:
        """Batch create or update contacts in HubSpot using OAuth"""
        if not self.access_token:
            raise Exception("Access token required for HubSpot operations")
        
        async with httpx.AsyncClient() as client:
            results = {"created": 0, "updated": 0, "errors": []}
            
            # Process contacts in batches of 100 (HubSpot limit)
            for i in range(0, len(contacts), 100):
                batch_contacts = contacts[i:i+100]
                batch_data = {"inputs": []}
                
                for contact in batch_contacts:
                    properties = {}
                    
                    # Map fields to HubSpot properties
                    if contact.get('first_name'):
                        properties['firstname'] = contact['first_name']
                    if contact.get('last_name'):
                        properties['lastname'] = contact['last_name']
                    if contact.get('email'):
                        properties['email'] = contact['email']
                    if contact.get('phone'):
                        properties['phone'] = contact['phone']
                    if contact.get('company'):
                        properties['company'] = contact['company']
                    if contact.get('position'):
                        properties['jobtitle'] = contact['position']
                    
                    # Add enrichment metadata
                    if contact.get('enrichment_provider'):
                        properties['captely_source'] = contact['enrichment_provider']
                    if contact.get('enrichment_score'):
                        properties['captely_confidence'] = str(contact['enrichment_score'])
                    if contact.get('lead_score'):
                        properties['hs_lead_score'] = str(contact['lead_score'])
                    
                    # Add custom properties from contact
                    if contact.get('custom_fields'):
                        properties.update(contact['custom_fields'])
                    
                    batch_data["inputs"].append({"properties": properties})
                
                try:
                    # Try to create new contacts first
                    response = await client.post(
                        f"{self.base_url}/crm/v3/objects/contacts/batch/create",
                        headers=self.headers,
                        json=batch_data,
                        timeout=30.0
                    )
                    
                    if response.status_code == 201:
                        result = response.json()
                        results["created"] += len(result.get("results", []))
                    elif response.status_code == 409:  # Conflict - contacts exist
                        # Try to update existing contacts
                        await self._update_existing_contacts(client, batch_contacts, results)
                    else:
                        error_msg = f"Batch {i//100 + 1}: {response.status_code} - {response.text}"
                        results["errors"].append(error_msg)
                
                except Exception as e:
                    results["errors"].append(f"Batch {i//100 + 1}: {str(e)}")
            
            return results
    
    async def _update_existing_contacts(self, client: httpx.AsyncClient, contacts: List[Dict], results: Dict):
        """Update existing contacts by email lookup"""
        for contact in contacts:
            if not contact.get('email'):
                continue
                
            try:
                # Search for contact by email
                search_response = await client.post(
                    f"{self.base_url}/crm/v3/objects/contacts/search",
                    headers=self.headers,
                    json={
                        "filterGroups": [{
                            "filters": [{
                                "propertyName": "email",
                                "operator": "EQ",
                                "value": contact['email']
                            }]
                        }]
                    }
                )
                
                if search_response.status_code == 200:
                    search_data = search_response.json()
                    if search_data.get("results"):
                        # Update the found contact
                        contact_id = search_data["results"][0]["id"]
                        
                        properties = {}
                        if contact.get('first_name'):
                            properties['firstname'] = contact['first_name']
                        if contact.get('last_name'):
                            properties['lastname'] = contact['last_name']
                        if contact.get('phone'):
                            properties['phone'] = contact['phone']
                        if contact.get('company'):
                            properties['company'] = contact['company']
                        if contact.get('position'):
                            properties['jobtitle'] = contact['position']
                        
                        update_response = await client.patch(
                            f"{self.base_url}/crm/v3/objects/contacts/{contact_id}",
                            headers=self.headers,
                            json={"properties": properties}
                        )
                        
                        if update_response.status_code == 200:
                            results["updated"] += 1
                        else:
                            results["errors"].append(f"Update failed for {contact['email']}: {update_response.text}")
                
            except Exception as e:
                results["errors"].append(f"Update error for {contact.get('email', 'unknown')}: {str(e)}")
    
    async def export_to_list(self, list_id: str, contact_emails: List[str]) -> Dict:
        """Add contacts to a HubSpot list"""
        async with httpx.AsyncClient() as client:
            results = {"added": 0, "errors": []}
            
            # Get contact IDs by email
            contact_ids = []
            for email in contact_emails:
                try:
                    search_response = await client.post(
                        f"{self.base_url}/crm/v3/objects/contacts/search",
                        headers=self.headers,
                        json={
                            "filterGroups": [{
                                "filters": [{
                                    "propertyName": "email",
                                    "operator": "EQ",
                                    "value": email
                                }]
                            }]
                        }
                    )
                    
                    if search_response.status_code == 200:
                        search_data = search_response.json()
                        if search_data.get("results"):
                            contact_ids.append(search_data["results"][0]["id"])
                
                except Exception as e:
                    results["errors"].append(f"Failed to find contact {email}: {str(e)}")
            
            # Add contacts to list in batches
            for i in range(0, len(contact_ids), 100):
                batch_ids = contact_ids[i:i+100]
                
                try:
                    response = await client.put(
                        f"{self.base_url}/contacts/v1/lists/{list_id}/add",
                        headers=self.headers,
                        json={"vids": [int(cid) for cid in batch_ids]}
                    )
                    
                    if response.status_code == 200:
                        results["added"] += len(batch_ids)
                    else:
                        results["errors"].append(f"List add failed: {response.text}")
                
                except Exception as e:
                    results["errors"].append(f"List add error: {str(e)}")
            
            return results
    
    async def get_lists(self) -> List[Dict]:
        """Get available HubSpot lists"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/contacts/v1/lists",
                headers=self.headers,
                params={"count": 100}
            )
            
            if response.status_code == 200:
                data = response.json()
                return [{
                    "id": lst["listId"],
                    "name": lst["name"],
                    "size": lst.get("metaData", {}).get("size", 0)
                } for lst in data.get("lists", [])]
            else:
                raise Exception(f"Failed to get lists: {response.text}")

class SalesforceIntegration:
    def __init__(self, access_token: str = None, instance_url: str = None, client_id: str = None, client_secret: str = None):
        # Use your actual Salesforce Connected App credentials
        self.client_id = client_id or "3MVG9n_HvETGhr3AH5kJyoYHHZnU_5pALrlcfDQQpCdQRkIZOVDk_zZT3pCK5eJZ8F_cPxYyqBqCtTHcFhTjp"
        self.client_secret = client_secret or "4F3D2E1C8B7A5F6E9D8C7B6A5E4D3C2B1A9F8E7D6C5B4A3E2D1C9B8A7F6E5D4C3B2A1"
        self.redirect_uri = "https://captely.com/integrations"
        self.access_token = access_token
        self.instance_url = instance_url
        self.api_version = "v58.0"
        
        self.headers = {
            "Content-Type": "application/json"
        }
        
        if self.access_token:
            self.headers["Authorization"] = f"Bearer {self.access_token}"
    
    def get_auth_url(self, state: str = None, use_sandbox: bool = False) -> str:
        """Generate Salesforce OAuth authorization URL"""
        base_url = "https://test.salesforce.com" if use_sandbox else "https://login.salesforce.com"
        
        if not state:
            state = secrets.token_urlsafe(32)
        
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "api refresh_token offline_access",
            "state": state
        }
        
        return f"{base_url}/services/oauth2/authorize?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str, use_sandbox: bool = False) -> Dict:
        """Exchange authorization code for access token"""
        base_url = "https://test.salesforce.com" if use_sandbox else "https://login.salesforce.com"
        
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
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.access_token = token_data["access_token"]
                self.instance_url = token_data["instance_url"]
                self.headers["Authorization"] = f"Bearer {self.access_token}"
                return token_data
            else:
                raise Exception(f"Failed to exchange code: {response.text}")
    
    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """Refresh an expired access token"""
        async with httpx.AsyncClient() as client:
            data = {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token
            }
            
            token_url = f"{self.instance_url}/services/oauth2/token"
            response = await client.post(
                token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.access_token = token_data["access_token"]
                self.headers["Authorization"] = f"Bearer {self.access_token}"
                return token_data
            else:
                raise Exception(f"Failed to refresh token: {response.text}")
    
    async def get_user_info(self) -> Dict:
        """Get Salesforce user information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.instance_url}/services/data/{self.api_version}/sobjects/User",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Failed to get user info: {response.text}")
    
    async def import_contacts(self, limit: int = 200, offset: int = 0) -> Dict:
        """Import contacts from Salesforce"""
        async with httpx.AsyncClient() as client:
            # Build SOQL query
            soql_query = f"""
                SELECT Id, FirstName, LastName, Email, Phone, Title, 
                       MailingCity, MailingState, MailingCountry, Account.Name
                FROM Contact 
                WHERE Email != null 
                ORDER BY CreatedDate DESC 
                LIMIT {limit} OFFSET {offset}
            """
            
            response = await client.get(
                f"{self.instance_url}/services/data/{self.api_version}/query",
                headers=self.headers,
                params={"q": soql_query}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Transform Salesforce data to Captely format
                contacts = []
                for contact in data.get("records", []):
                    contacts.append({
                        "salesforce_id": contact["Id"],
                        "first_name": contact.get("FirstName", ""),
                        "last_name": contact.get("LastName", ""),
                        "email": contact.get("Email", ""),
                        "phone": contact.get("Phone", ""),
                        "company": contact.get("Account", {}).get("Name", "") if contact.get("Account") else "",
                        "position": contact.get("Title", ""),
                        "location": contact.get("MailingCity", ""),
                        "status": "imported",
                        "created_date": contact.get("CreatedDate"),
                        "last_modified": contact.get("LastModifedDate")
                    })
                
                return {
                    "contacts": contacts,
                    "total": data.get("totalSize", 0),
                    "done": data.get("done", True),
                    "next_records_url": data.get("nextRecordsUrl")
                }
            else:
                raise Exception(f"Failed to import contacts: {response.text}")
    
    async def create_or_update_contacts(self, contacts: List[Dict]) -> Dict:
        """Batch create or update contacts in Salesforce"""
        if not self.access_token:
            raise Exception("Access token required for Salesforce operations")
        
        async with httpx.AsyncClient() as client:
            results = {"created": 0, "updated": 0, "errors": []}
            
            # Process contacts in batches of 200 (Salesforce limit)
            for i in range(0, len(contacts), 200):
                batch_contacts = contacts[i:i+200]
                
                # Prepare batch request for contacts
                composite_data = {
                    "allOrNone": False,
                    "records": []
                }
                
                for contact in batch_contacts:
                    contact_data = {
                        "attributes": {"type": "Contact"}
                    }
                    
                    # Map fields to Salesforce Contact fields
                    if contact.get('first_name'):
                        contact_data['FirstName'] = contact['first_name']
                    if contact.get('last_name'):
                        contact_data['LastName'] = contact['last_name']
                    if contact.get('email'):
                        contact_data['Email'] = contact['email']
                    if contact.get('phone'):
                        contact_data['Phone'] = contact['phone']
                    if contact.get('position'):
                        contact_data['Title'] = contact['position']
                    if contact.get('location'):
                        contact_data['MailingCity'] = contact['location']
                    
                    # Add enrichment metadata
                    if contact.get('enrichment_provider'):
                        contact_data['Captely_Source__c'] = contact['enrichment_provider']
                    if contact.get('enrichment_score'):
                        contact_data['Captely_Confidence__c'] = contact['enrichment_score']
                    if contact.get('lead_score'):
                        contact_data['Lead_Score__c'] = contact['lead_score']
                    
                    contact_data['LeadSource'] = 'Captely'
                    composite_data["records"].append(contact_data)
                
                try:
                    # Try to create new contacts first
                    response = await client.post(
                        f"{self.instance_url}/services/data/{self.api_version}/composite/sobjects",
                        headers=self.headers,
                        json=composite_data,
                        timeout=30.0
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        for record in result:
                            if record.get("success"):
                                results["created"] += 1
                            else:
                                # Try to update if creation failed due to duplicate
                                await self._update_existing_contacts(client, [contacts[result.index(record)]], results)
                    else:
                        error_msg = f"Batch {i//200 + 1}: {response.status_code} - {response.text}"
                        results["errors"].append(error_msg)
                
                except Exception as e:
                    results["errors"].append(f"Batch {i//200 + 1}: {str(e)}")
            
            return results
    
    async def _update_existing_contacts(self, client: httpx.AsyncClient, contacts: List[Dict], results: Dict):
        """Update existing contacts by email lookup"""
        for contact in contacts:
            if not contact.get('email'):
                continue
                
            try:
                # Search for contact by email using SOQL
                soql_query = f"SELECT Id FROM Contact WHERE Email = '{contact['email']}' LIMIT 1"
                
                search_response = await client.get(
                    f"{self.instance_url}/services/data/{self.api_version}/query",
                    headers=self.headers,
                    params={"q": soql_query}
                )
                
                if search_response.status_code == 200:
                    search_data = search_response.json()
                    if search_data.get("records"):
                        # Update the found contact
                        contact_id = search_data["records"][0]["Id"]
                        
                        update_data = {}
                        if contact.get('first_name'):
                            update_data['FirstName'] = contact['first_name']
                        if contact.get('last_name'):
                            update_data['LastName'] = contact['last_name']
                        if contact.get('phone'):
                            update_data['Phone'] = contact['phone']
                        if contact.get('position'):
                            update_data['Title'] = contact['position']
                        
                        update_response = await client.patch(
                            f"{self.instance_url}/services/data/{self.api_version}/sobjects/Contact/{contact_id}",
                            headers=self.headers,
                            json=update_data
                        )
                        
                        if update_response.status_code == 204:
                            results["updated"] += 1
                        else:
                            results["errors"].append(f"Update failed for {contact['email']}: {update_response.text}")
                
            except Exception as e:
                results["errors"].append(f"Update error for {contact.get('email', 'unknown')}: {str(e)}")
    
    async def export_to_campaign(self, campaign_id: str, contact_emails: List[str]) -> Dict:
        """Add contacts to a Salesforce campaign"""
        async with httpx.AsyncClient() as client:
            results = {"added": 0, "errors": []}
            
            # Get contact IDs by email
            contact_ids = []
            for email in contact_emails:
                try:
                    soql_query = f"SELECT Id FROM Contact WHERE Email = '{email}' LIMIT 1"
                    search_response = await client.get(
                        f"{self.instance_url}/services/data/{self.api_version}/query",
                        headers=self.headers,
                        params={"q": soql_query}
                    )
                    
                    if search_response.status_code == 200:
                        search_data = search_response.json()
                        if search_data.get("records"):
                            contact_ids.append(search_data["records"][0]["Id"])
                
                except Exception as e:
                    results["errors"].append(f"Failed to find contact {email}: {str(e)}")
            
            # Add contacts to campaign
            for contact_id in contact_ids:
                try:
                    campaign_member_data = {
                        "CampaignId": campaign_id,
                        "ContactId": contact_id,
                        "Status": "Sent"
                    }
                    
                    response = await client.post(
                        f"{self.instance_url}/services/data/{self.api_version}/sobjects/CampaignMember",
                        headers=self.headers,
                        json=campaign_member_data
                    )
                    
                    if response.status_code == 201:
                        results["added"] += 1
                    else:
                        results["errors"].append(f"Campaign add failed: {response.text}")
                
                except Exception as e:
                    results["errors"].append(f"Campaign add error: {str(e)}")
            
            return results
    
    async def get_campaigns(self) -> List[Dict]:
        """Get available Salesforce campaigns"""
        async with httpx.AsyncClient() as client:
            soql_query = "SELECT Id, Name, Status, Type FROM Campaign WHERE IsActive = true ORDER BY Name LIMIT 100"
            
            response = await client.get(
                f"{self.instance_url}/services/data/{self.api_version}/query",
                headers=self.headers,
                params={"q": soql_query}
            )
            
            if response.status_code == 200:
                data = response.json()
                return [{
                    "id": campaign["Id"],
                    "name": campaign["Name"],
                    "status": campaign.get("Status", "Active"),
                    "type": campaign.get("Type", "Other")
                } for campaign in data.get("records", [])]
            else:
                raise Exception(f"Failed to get campaigns: {response.text}")

class LemlistIntegration:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.lemlist.com/api"
        self.headers = {
            "Content-Type": "application/json"
        }
    
    def get_auth_setup_url(self) -> str:
        """Generate URL for Lemlist API key setup instructions"""
        return "https://help.lemlist.com/en/articles/3398065-generating-your-api-key"
    
    async def verify_api_key(self) -> Dict:
        """Verify API key and get account information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/me",
                headers=self.headers,
                auth=(self.api_key, "")
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Failed to verify API key: {response.text}")
    
    async def import_contacts(self, campaign_id: str = None, limit: int = 100) -> Dict:
        """Import contacts from Lemlist"""
        async with httpx.AsyncClient() as client:
            if campaign_id:
                endpoint = f"/campaigns/{campaign_id}/leads"
            else:
                endpoint = "/leads"
            
            response = await client.get(
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                auth=(self.api_key, ""),
                params={"limit": limit}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Transform Lemlist data to Captely format
                contacts = []
                for lead in data.get("leads", []):
                    contacts.append({
                        "lemlist_id": lead["_id"],
                        "first_name": lead.get("firstName", ""),
                        "last_name": lead.get("lastName", ""),
                        "email": lead.get("email", ""),
                        "phone": lead.get("phoneNumber", ""),
                        "company": lead.get("companyName", ""),
                        "position": lead.get("jobTitle", ""),
                        "location": lead.get("city", ""),
                        "status": lead.get("campaignStatus", "pending"),
                        "created_date": lead.get("createdAt"),
                        "last_modified": lead.get("updatedAt")
                    })
                
                return {
                    "contacts": contacts,
                    "total": len(contacts)
                }
            else:
                raise Exception(f"Failed to import contacts: {response.text}")
    
    async def add_to_campaign(self, campaign_id: str, contacts: List[Dict]) -> Dict:
        """Add leads to a Lemlist campaign"""
        async with httpx.AsyncClient() as client:
            results = {"added": 0, "errors": []}
            
            for contact in contacts:
                lead_data = {
                    "email": contact.get("email"),
                    "firstName": contact.get("first_name", ""),
                    "lastName": contact.get("last_name", ""),
                    "companyName": contact.get("company", ""),
                    "jobTitle": contact.get("position", ""),
                    "phoneNumber": contact.get("phone", ""),
                    "city": contact.get("location", ""),
                    "industry": contact.get("industry", "")
                }
                
                # Add enrichment metadata as custom fields
                if contact.get('enrichment_provider'):
                    lead_data['captely_source'] = contact['enrichment_provider']
                if contact.get('enrichment_score'):
                    lead_data['captely_confidence'] = str(contact['enrichment_score'])
                
                try:
                    response = await client.post(
                        f"{self.base_url}/campaigns/{campaign_id}/leads/{contact['email']}",
                        headers=self.headers,
                        json=lead_data,
                        auth=(self.api_key, "")
                    )
                    
                    if response.status_code in [200, 201]:
                        results["added"] += 1
                    else:
                        results["errors"].append({
                            "email": contact['email'],
                            "error": response.text
                        })
                
                except Exception as e:
                    results["errors"].append({
                        "email": contact.get('email', 'unknown'),
                        "error": str(e)
                    })
            
            return results
    
    async def get_campaigns(self) -> List[Dict]:
        """Get available Lemlist campaigns"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/campaigns",
                headers=self.headers,
                auth=(self.api_key, "")
            )
            
            if response.status_code == 200:
                data = response.json()
                return [{
                    "id": campaign["_id"],
                    "name": campaign["name"],
                    "status": campaign.get("status", "draft"),
                    "created_at": campaign.get("createdAt")
                } for campaign in data.get("campaigns", [])]
            else:
                raise Exception(f"Failed to get campaigns: {response.text}")
    
    async def create_campaign(self, campaign_data: Dict) -> Dict:
        """Create a new Lemlist campaign"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/campaigns",
                headers=self.headers,
                json=campaign_data,
                auth=(self.api_key, "")
            )
            
            if response.status_code == 201:
                return response.json()
            else:
                raise Exception(f"Failed to create campaign: {response.text}")
    
    async def start_campaign(self, campaign_id: str) -> Dict:
        """Start a Lemlist campaign"""
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.base_url}/campaigns/{campaign_id}/start",
                headers=self.headers,
                auth=(self.api_key, "")
            )
            
            if response.status_code == 200:
                return {"status": "started", "campaign_id": campaign_id}
            else:
                raise Exception(f"Failed to start campaign: {response.text}")

class ZapierIntegration:
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
    
    def get_webhook_setup_url(self) -> str:
        """Generate URL for Zapier webhook setup instructions"""
        return "https://zapier.com/apps/webhook/help"
    
    async def verify_webhook(self, test_data: Dict = None) -> Dict:
        """Verify webhook URL by sending test data"""
        if not test_data:
            test_data = {
                "test": True,
                "timestamp": datetime.utcnow().isoformat(),
                "source": "captely",
                "message": "Webhook verification test"
            }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.webhook_url,
                json=test_data,
                timeout=30.0
            )
            
            return {
                "status_code": response.status_code,
                "success": response.status_code in [200, 201, 202],
                "response": response.text[:500] if response.text else None
            }
    
    async def send_contacts(self, contacts: List[Dict], event_type: str = "contacts.enriched") -> Dict:
        """Send contacts to Zapier webhook"""
        async with httpx.AsyncClient() as client:
            results = {"sent": 0, "errors": []}
            
            # Prepare webhook data
            webhook_data = {
                "event": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "total_contacts": len(contacts),
                "contacts": []
            }
            
            # Transform contacts for Zapier
            for contact in contacts:
                zapier_contact = {
                    "contact_id": contact.get("id"),
                    "first_name": contact.get("first_name", ""),
                    "last_name": contact.get("last_name", ""),
                    "full_name": f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
                    "email": contact.get("email", ""),
                    "phone": contact.get("phone", ""),
                    "company": contact.get("company", ""),
                    "position": contact.get("position", ""),
                    "location": contact.get("location", ""),
                    "industry": contact.get("industry", ""),
                    "enriched": contact.get("enriched", False),
                    "enrichment_score": contact.get("enrichment_score"),
                    "email_verified": contact.get("email_verified", False),
                    "phone_verified": contact.get("phone_verified", False),
                    "created_at": contact.get("created_at"),
                    "updated_at": contact.get("updated_at"),
                    "exported_at": datetime.utcnow().isoformat()
                }
                webhook_data["contacts"].append(zapier_contact)
            
            try:
                response = await client.post(
                    self.webhook_url,
                    json=webhook_data,
                    timeout=30.0
                )
                
                if response.status_code in [200, 201, 202]:
                    results["sent"] = len(contacts)
                else:
                    results["errors"].append(f"Webhook returned {response.status_code}: {response.text}")
            
            except Exception as e:
                results["errors"].append(str(e))
            
            return results
    
    async def send_single_contact(self, contact: Dict, event_type: str = "contact.enriched") -> Dict:
        """Send a single contact to Zapier webhook"""
        return await self.send_contacts([contact], event_type)
    
    async def send_batch_export(self, contacts: List[Dict], job_id: str) -> Dict:
        """Send batch export data to Zapier webhook"""
        webhook_data = {
            "event": "batch.exported",
            "job_id": job_id,
            "timestamp": datetime.utcnow().isoformat(),
            "total_contacts": len(contacts),
            "batch_data": {
                "contacts": contacts,
                "export_summary": {
                    "total_exported": len(contacts),
                    "enriched_contacts": len([c for c in contacts if c.get("enriched")]),
                    "verified_emails": len([c for c in contacts if c.get("email_verified")]),
                    "verified_phones": len([c for c in contacts if c.get("phone_verified")])
                }
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.webhook_url,
                    json=webhook_data,
                    timeout=30.0
                )
                
                return {
                    "success": response.status_code in [200, 201, 202],
                    "status_code": response.status_code,
                    "response": response.text[:500] if response.text else None
                }
            
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

# Factory function to get integration instance
def get_integration(provider: str, config: Dict):
    """Get integration instance based on provider"""
    if provider == "hubspot":
        return HubSpotIntegration(
            config.get("access_token"),
            config.get("client_id"),
            config.get("client_secret")
        )
    elif provider == "salesforce":
        return SalesforceIntegration(
            config.get("access_token"),
            config.get("instance_url"),
            config.get("client_id"),
            config.get("client_secret")
        )
    elif provider == "lemlist":
        return LemlistIntegration(config.get("api_key"))
    elif provider == "zapier":
        return ZapierIntegration(config.get("webhook_url"))
    else:
        raise ValueError(f"Unknown provider: {provider}") 