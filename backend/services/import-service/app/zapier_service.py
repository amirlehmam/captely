"""
Zapier Integration Service
Handles webhook-based integration and contact synchronization
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

class ZapierService:
    def __init__(self):
        self.base_url = "https://hooks.zapier.com/hooks/catch"
        
    def get_webhook_setup_url(self) -> str:
        """Generate URL for Zapier webhook setup instructions"""
        return "https://zapier.com/apps/webhook/help"
    
    async def verify_webhook(self, webhook_url: str, test_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Verify webhook URL by sending test data"""
        if not test_data:
            test_data = {
                "test": True,
                "timestamp": datetime.now().isoformat(),
                "source": "captely",
                "message": "Webhook verification test"
            }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=test_data,
                timeout=30.0
            )
            
            return {
                "status_code": response.status_code,
                "success": response.status_code in [200, 201, 202],
                "response": response.text[:500] if response.text else None
            }
    
    async def send_webhook(self, session: AsyncSession, user_id: str, data: Dict[str, Any], webhook_type: str = "contact") -> Dict[str, Any]:
        """Send data to configured Zapier webhook"""
        # Get webhook URL from database
        query = text("""
            SELECT zapier_webhook_url, zapier_zap_id 
            FROM zapier_integrations 
            WHERE user_id = :user_id AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        """)
        result = await session.execute(query, {"user_id": user_id})
        integration = result.fetchone()
        
        if not integration:
            raise Exception("No Zapier integration found")
            
        webhook_url, zap_id = integration
        
        # Add metadata to the payload
        payload = {
            "captely_webhook_type": webhook_type,
            "captely_timestamp": datetime.now().isoformat(),
            "captely_user_id": user_id,
            "captely_zap_id": zap_id,
            **data
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                timeout=30.0
            )
            
            return {
                "status_code": response.status_code,
                "success": response.status_code in [200, 201, 202],
                "response": response.text[:500] if response.text else None,
                "payload_size": len(json.dumps(payload))
            }
    
    def map_captely_to_zapier(self, captely_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Map Captely contact fields to Zapier webhook format"""
        zapier_data = {
            "contact_id": captely_contact.get("id"),
            "first_name": captely_contact.get("first_name", ""),
            "last_name": captely_contact.get("last_name", ""),
            "full_name": f"{captely_contact.get('first_name', '')} {captely_contact.get('last_name', '')}".strip(),
            "email": captely_contact.get("email", ""),
            "phone": captely_contact.get("phone", ""),
            "company": captely_contact.get("company", ""),
            "position": captely_contact.get("position", ""),
            "job_title": captely_contact.get("position", ""),  # Alias
            "location": captely_contact.get("location", ""),
            "city": captely_contact.get("location", ""),  # Alias
            "industry": captely_contact.get("industry", ""),
            "profile_url": captely_contact.get("profile_url", "")
        }
        
        # Add enrichment metadata
        if captely_contact.get("enriched"):
            zapier_data.update({
                "captely_enriched": True,
                "captely_enrichment_date": datetime.now().isoformat(),
                "enrichment_status": "completed"
            })
        else:
            zapier_data.update({
                "captely_enriched": False,
                "enrichment_status": "pending"
            })
            
        if captely_contact.get("enrichment_score"):
            zapier_data["captely_enrichment_score"] = captely_contact["enrichment_score"]
            zapier_data["enrichment_confidence"] = captely_contact["enrichment_score"]  # Alias
            
        if captely_contact.get("email_verified"):
            zapier_data["captely_email_verified"] = True
            zapier_data["email_verification_status"] = "verified"
        else:
            zapier_data["captely_email_verified"] = False
            zapier_data["email_verification_status"] = "unverified"
            
        if captely_contact.get("phone_verified"):
            zapier_data["captely_phone_verified"] = True
            zapier_data["phone_verification_status"] = "verified"
        else:
            zapier_data["captely_phone_verified"] = False
            zapier_data["phone_verification_status"] = "unverified"
        
        # Add timestamps
        zapier_data.update({
            "created_at": captely_contact.get("created_at"),
            "updated_at": captely_contact.get("updated_at"),
            "exported_at": datetime.now().isoformat()
        })
        
        return zapier_data
    
    def map_zapier_to_captely(self, zapier_data: Dict[str, Any]) -> Dict[str, Any]:
        """Map Zapier webhook data to Captely format"""
        captely_contact = {
            "first_name": zapier_data.get("first_name") or zapier_data.get("firstName", ""),
            "last_name": zapier_data.get("last_name") or zapier_data.get("lastName", ""),
            "email": zapier_data.get("email", ""),
            "phone": zapier_data.get("phone") or zapier_data.get("phoneNumber", ""),
            "company": zapier_data.get("company") or zapier_data.get("companyName", ""),
            "position": zapier_data.get("position") or zapier_data.get("job_title") or zapier_data.get("jobTitle", ""),
            "location": zapier_data.get("location") or zapier_data.get("city", ""),
            "industry": zapier_data.get("industry", ""),
            "profile_url": zapier_data.get("profile_url") or zapier_data.get("profileUrl", ""),
            "enriched": False,
            "enrichment_status": "pending"
        }
        
        return captely_contact
    
    async def export_contact_to_zapier(self, session: AsyncSession, user_id: str, contact_id: int) -> Dict[str, Any]:
        """Export a single contact to Zapier webhook"""
        try:
            # Get contact from database
            contact_query = text("""
                SELECT id, first_name, last_name, email, phone, company, position, 
                       location, industry, profile_url, enriched, enrichment_score, 
                       email_verified, phone_verified, created_at, updated_at
                FROM contacts 
                WHERE id = :contact_id
            """)
            
            contact_result = await session.execute(contact_query, {"contact_id": contact_id})
            contact_row = contact_result.fetchone()
            
            if not contact_row:
                raise Exception("Contact not found")
            
            contact_dict = {
                "id": contact_row[0],
                "first_name": contact_row[1],
                "last_name": contact_row[2],
                "email": contact_row[3],
                "phone": contact_row[4],
                "company": contact_row[5],
                "position": contact_row[6],
                "location": contact_row[7],
                "industry": contact_row[8],
                "profile_url": contact_row[9],
                "enriched": contact_row[10],
                "enrichment_score": contact_row[11],
                "email_verified": contact_row[12],
                "phone_verified": contact_row[13],
                "created_at": contact_row[14].isoformat() if contact_row[14] else None,
                "updated_at": contact_row[15].isoformat() if contact_row[15] else None
            }
            
            zapier_data = self.map_captely_to_zapier(contact_dict)
            webhook_result = await self.send_webhook(session, user_id, zapier_data, "single_contact")
            
            if webhook_result["success"]:
                # Create mapping record
                mapping_query = text("""
                    INSERT INTO zapier_contact_mappings 
                    (user_id, captely_contact_id, zapier_record_id)
                    VALUES (:user_id, :captely_id, :zapier_id)
                    ON CONFLICT (captely_contact_id, zapier_record_id) DO NOTHING
                """)
                
                zapier_record_id = f"webhook_{contact_id}_{int(datetime.now().timestamp())}"
                await session.execute(mapping_query, {
                    "user_id": user_id,
                    "captely_id": contact_id,
                    "zapier_id": zapier_record_id
                })
                await session.commit()
            
            return {
                "contact_id": contact_id,
                "exported": webhook_result["success"],
                "webhook_response": webhook_result
            }
            
        except Exception as e:
            logging.error(f"Failed to export contact {contact_id} to Zapier: {e}")
            raise Exception(f"Failed to export contact to Zapier: {str(e)}")
    
    async def export_contacts_to_zapier(self, session: AsyncSession, user_id: str, contact_ids: List[int], batch_mode: bool = True) -> Dict[str, Any]:
        """Export multiple contacts to Zapier webhook"""
        exported_count = 0
        failed_count = 0
        errors = []
        
        try:
            # Get contacts from database
            contacts_query = text("""
                SELECT id, first_name, last_name, email, phone, company, position, 
                       location, industry, profile_url, enriched, enrichment_score, 
                       email_verified, phone_verified, created_at, updated_at
                FROM contacts 
                WHERE id = ANY(:contact_ids)
            """)
            
            contacts_result = await session.execute(contacts_query, {"contact_ids": contact_ids})
            contacts = contacts_result.fetchall()
            
            if batch_mode:
                # Send all contacts in a single webhook
                batch_data = []
                for contact in contacts:
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
                        "profile_url": contact[9],
                        "enriched": contact[10],
                        "enrichment_score": contact[11],
                        "email_verified": contact[12],
                        "phone_verified": contact[13],
                        "created_at": contact[14].isoformat() if contact[14] else None,
                        "updated_at": contact[15].isoformat() if contact[15] else None
                    }
                    batch_data.append(self.map_captely_to_zapier(contact_dict))
                
                # Send batch webhook
                webhook_payload = {
                    "batch_export": True,
                    "total_contacts": len(batch_data),
                    "contacts": batch_data
                }
                
                webhook_result = await self.send_webhook(session, user_id, webhook_payload, "batch_contacts")
                
                if webhook_result["success"]:
                    exported_count = len(contacts)
                    # Create mapping records for all contacts
                    for contact in contacts:
                        mapping_query = text("""
                            INSERT INTO zapier_contact_mappings 
                            (user_id, captely_contact_id, zapier_record_id)
                            VALUES (:user_id, :captely_id, :zapier_id)
                            ON CONFLICT (captely_contact_id, zapier_record_id) DO NOTHING
                        """)
                        
                        zapier_record_id = f"batch_{contact[0]}_{int(datetime.now().timestamp())}"
                        await session.execute(mapping_query, {
                            "user_id": user_id,
                            "captely_id": contact[0],
                            "zapier_id": zapier_record_id
                        })
                else:
                    failed_count = len(contacts)
                    errors.append(f"Batch webhook failed: {webhook_result.get('response', 'Unknown error')}")
                    
            else:
                # Send individual webhooks for each contact
                for contact in contacts:
                    try:
                        result = await self.export_contact_to_zapier(session, user_id, contact[0])
                        if result["exported"]:
                            exported_count += 1
                        else:
                            failed_count += 1
                            errors.append(f"Failed to export contact {contact[3]}")
                    except Exception as e:
                        failed_count += 1
                        errors.append(f"Error processing contact {contact[3]}: {str(e)}")
            
            await session.commit()
            
            return {
                "exported_count": exported_count,
                "failed_count": failed_count,
                "errors": errors,
                "batch_mode": batch_mode
            }
            
        except Exception as e:
            logging.error(f"Zapier export failed: {e}")
            await session.rollback()
            raise Exception(f"Failed to export to Zapier: {str(e)}")
    
    async def receive_webhook_data(self, session: AsyncSession, user_id: str, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming webhook data from Zapier"""
        try:
            # This would be called from a webhook endpoint
            # Map incoming data to Captely format
            captely_contact = self.map_zapier_to_captely(webhook_data)
            
            # Create a new import job for webhook data
            job_query = text("""
                INSERT INTO import_jobs (user_id, status, source_type, total_records, processed_records)
                VALUES (:user_id, 'completed', 'zapier_webhook', 1, 1)
                RETURNING id
            """)
            
            job_result = await session.execute(job_query, {"user_id": user_id})
            job_id = job_result.scalar()
            
            # Insert contact
            if captely_contact.get("email"):
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
                contact_id = contact_result.scalar()
                
                await session.commit()
                
                return {
                    "success": True,
                    "contact_id": contact_id,
                    "job_id": job_id,
                    "message": "Contact imported from Zapier webhook"
                }
            else:
                return {
                    "success": False,
                    "error": "No email provided in webhook data"
                }
                
        except Exception as e:
            logging.error(f"Failed to process Zapier webhook: {e}")
            await session.rollback()
            raise Exception(f"Failed to process webhook data: {str(e)}") 