# services/export-service/app/integrations.py

import httpx
from typing import Dict, List, Optional
from datetime import datetime
import json
import asyncio

class HubSpotIntegration:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.hubapi.com"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def create_or_update_contacts(self, contacts: List[Dict]) -> Dict:
        """Batch create or update contacts in HubSpot"""
        async with httpx.AsyncClient() as client:
            batch_data = {
                "inputs": []
            }
            
            for contact in contacts:
                properties = {}
                
                # Map fields to HubSpot properties
                if 'first_name' in contact:
                    properties['firstname'] = contact['first_name']
                if 'last_name' in contact:
                    properties['lastname'] = contact['last_name']
                if 'email' in contact:
                    properties['email'] = contact['email']
                if 'phone' in contact:
                    properties['phone'] = contact['phone']
                if 'company' in contact:
                    properties['company'] = contact['company']
                if 'position' in contact:
                    properties['jobtitle'] = contact['position']
                
                # Add custom properties
                if 'custom_fields' in contact:
                    properties.update(contact['custom_fields'])
                
                batch_data["inputs"].append({
                    "properties": properties
                })
            
            # Create contacts in batches of 100 (HubSpot limit)
            results = {"created": 0, "updated": 0, "errors": []}
            
            for i in range(0, len(batch_data["inputs"]), 100):
                batch = {"inputs": batch_data["inputs"][i:i+100]}
                
                try:
                    response = await client.post(
                        f"{self.base_url}/crm/v3/objects/contacts/batch/create",
                        headers=self.headers,
                        json=batch
                    )
                    
                    if response.status_code == 201:
                        result = response.json()
                        results["created"] += len(result.get("results", []))
                    else:
                        results["errors"].append(response.text)
                
                except Exception as e:
                    results["errors"].append(str(e))
            
            return results

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
        return HubSpotIntegration(config.get("api_key"))
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