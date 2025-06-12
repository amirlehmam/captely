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
        
        # HubSpot scopes - using modern granular scopes only
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
    def __init__(self, instance_url: str, access_token: str):
        self.instance_url = instance_url
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    
    async def create_leads(self, contacts: List[Dict]) -> Dict:
        """Create leads in Salesforce"""
        async with httpx.AsyncClient() as client:
            results = {"created": 0, "errors": []}
            
            # Salesforce composite API for batch operations
            composite_data = {
                "allOrNone": False,
                "records": []
            }
            
            for contact in contacts:
                lead_data = {
                    "attributes": {"type": "Lead"}
                }
                
                # Map fields to Salesforce Lead object
                if 'first_name' in contact:
                    lead_data['FirstName'] = contact['first_name']
                if 'last_name' in contact:
                    lead_data['LastName'] = contact['last_name'] or 'Unknown'
                if 'email' in contact:
                    lead_data['Email'] = contact['email']
                if 'phone' in contact:
                    lead_data['Phone'] = contact['phone']
                if 'company' in contact:
                    lead_data['Company'] = contact['company'] or 'Unknown'
                if 'position' in contact:
                    lead_data['Title'] = contact['position']
                
                lead_data['LeadSource'] = 'Captely'
                composite_data["records"].append(lead_data)
            
            # Create leads in batches of 200 (Salesforce limit)
            for i in range(0, len(composite_data["records"]), 200):
                batch = {
                    "allOrNone": False,
                    "records": composite_data["records"][i:i+200]
                }
                
                try:
                    response = await client.post(
                        f"{self.instance_url}/services/data/v57.0/composite/sobjects",
                        headers=self.headers,
                        json=batch
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        for record in result:
                            if record.get("success"):
                                results["created"] += 1
                            else:
                                results["errors"].extend(record.get("errors", []))
                    else:
                        results["errors"].append(response.text)
                
                except Exception as e:
                    results["errors"].append(str(e))
            
            return results

class LemlistIntegration:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.lemlist.com/api"
        self.headers = {
            "Content-Type": "application/json"
        }
    
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
                    "position": contact.get("position", ""),
                    "phone": contact.get("phone", ""),
                    "customFields": contact.get("custom_fields", {})
                }
                
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

class SmartleadIntegration:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.smartlead.ai/v1"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def add_prospects(self, campaign_id: str, contacts: List[Dict]) -> Dict:
        """Add prospects to Smartlead campaign"""
        async with httpx.AsyncClient() as client:
            results = {"added": 0, "errors": []}
            
            prospects = []
            for contact in contacts:
                prospect = {
                    "email": contact.get("email"),
                    "first_name": contact.get("first_name", ""),
                    "last_name": contact.get("last_name", ""),
                    "company": contact.get("company", ""),
                    "position": contact.get("position", ""),
                    "phone": contact.get("phone", ""),
                    "custom_fields": contact.get("custom_fields", {})
                }
                prospects.append(prospect)
            
            try:
                response = await client.post(
                    f"{self.base_url}/campaigns/{campaign_id}/prospects",
                    headers=self.headers,
                    json={"prospects": prospects}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    results["added"] = result.get("added", 0)
                else:
                    results["errors"].append(response.text)
            
            except Exception as e:
                results["errors"].append(str(e))
            
            return results

class OutreachIntegration:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.outreach.io/api/v2"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/vnd.api+json"
        }
    
    async def create_prospects(self, contacts: List[Dict]) -> Dict:
        """Create prospects in Outreach"""
        async with httpx.AsyncClient() as client:
            results = {"created": 0, "errors": []}
            
            for contact in contacts:
                prospect_data = {
                    "data": {
                        "type": "prospect",
                        "attributes": {
                            "emails": [contact.get("email")] if contact.get("email") else [],
                            "firstName": contact.get("first_name", ""),
                            "lastName": contact.get("last_name", ""),
                            "company": contact.get("company", ""),
                            "title": contact.get("position", ""),
                            "phones": [{"number": contact.get("phone")}] if contact.get("phone") else [],
                            "custom": contact.get("custom_fields", {})
                        }
                    }
                }
                
                try:
                    response = await client.post(
                        f"{self.base_url}/prospects",
                        headers=self.headers,
                        json=prospect_data
                    )
                    
                    if response.status_code == 201:
                        results["created"] += 1
                    else:
                        results["errors"].append({
                            "email": contact.get('email', 'unknown'),
                            "error": response.text
                        })
                
                except Exception as e:
                    results["errors"].append({
                        "email": contact.get('email', 'unknown'),
                        "error": str(e)
                    })
            
            return results

class ZapierIntegration:
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
    
    async def send_contacts(self, contacts: List[Dict], event_type: str = "contacts.enriched") -> Dict:
        """Send contacts to Zapier webhook"""
        async with httpx.AsyncClient() as client:
            results = {"sent": 0, "errors": []}
            
            webhook_data = {
                "event": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "contacts": contacts
            }
            
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
            config.get("instance_url"),
            config.get("access_token")
        )
    elif provider == "lemlist":
        return LemlistIntegration(config.get("api_key"))
    elif provider == "smartlead":
        return SmartleadIntegration(config.get("api_key"))
    elif provider == "outreach":
        return OutreachIntegration(config.get("api_key"))
    elif provider == "zapier":
        return ZapierIntegration(config.get("webhook_url"))
    else:
        raise ValueError(f"Unknown provider: {provider}") 