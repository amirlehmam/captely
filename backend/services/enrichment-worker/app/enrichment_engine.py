"""
Modern enrichment engine with price-based cascade and verification integration
"""
import asyncio
import time
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import concurrent.futures

from app.config import get_settings
from app.common import logger, service_status
from app.providers import PROVIDER_FUNCTIONS
from enrichment.email_verification import email_verifier
from enrichment.phone_verification import phone_verifier

settings = get_settings()

@dataclass
class EnrichmentResult:
    """Result of enrichment process"""
    email: Optional[str] = None
    phone: Optional[str] = None
    confidence: float = 0.0
    source: str = ""
    email_verified: bool = False
    phone_verified: bool = False
    email_verification_score: float = 0.0
    phone_verification_score: float = 0.0
    email_verification_details: Dict = None
    phone_verification_details: Dict = None
    raw_data: Dict = None
    providers_tried: List[str] = None
    total_cost: float = 0.0
    processing_time: float = 0.0

    def __post_init__(self):
        if self.email_verification_details is None:
            self.email_verification_details = {}
        if self.phone_verification_details is None:
            self.phone_verification_details = {}
        if self.raw_data is None:
            self.raw_data = {}
        if self.providers_tried is None:
            self.providers_tried = []


class EnrichmentEngine:
    """
    Modern enrichment engine with:
    - Price-based cascade (cheapest first)
    - Email and phone verification
    - Smart stopping conditions
    - Cost tracking
    - Performance optimization
    """
    
    def __init__(self):
        self.settings = settings
        logger.info("Initializing EnrichmentEngine with cascade ordering")
        
        # Validate provider functions are available
        missing_providers = []
        for provider_name in self.settings.service_order:
            if provider_name not in PROVIDER_FUNCTIONS:
                missing_providers.append(provider_name)
        
        if missing_providers:
            logger.warning(f"Missing provider functions: {missing_providers}")
        
        available_providers = [p for p in self.settings.service_order if p in PROVIDER_FUNCTIONS]
        logger.info(f"Available providers in price order: {available_providers}")
        
        self.total_enrichments = 0
        self.total_cost = 0.0
        self.total_processing_time = 0.0
        
    async def enrich_contact(self, lead: Dict[str, Any]) -> EnrichmentResult:
        """
        Enrich a single contact using the cascade approach
        """
        start_time = time.time()
        result = EnrichmentResult()
        
        # Normalize lead data
        normalized_lead = self._normalize_lead_data(lead)
        
        contact_name = self._get_contact_display_name(normalized_lead)
        logger.info(f"Starting enrichment cascade for: {contact_name}")
        
        # Track providers we've tried
        providers_tried = []
        total_cost = 0.0
        
        # Go through providers in price order (cheapest first)
        for provider_name in self.settings.service_order:
            if provider_name not in PROVIDER_FUNCTIONS:
                continue
                
            if not service_status.is_available(provider_name):
                logger.info(f"Skipping {provider_name} - marked unavailable")
                continue
            
            # Check if we should stop cascading
            if self._should_stop_cascade(result, providers_tried):
                logger.info(f"Stopping cascade early - high confidence reached")
                break
            
            # Don't exceed max providers limit
            if len(providers_tried) >= self.settings.max_providers_per_contact:
                logger.info(f"Reached max providers limit ({self.settings.max_providers_per_contact})")
                break
            
            logger.info(f"Trying provider {len(providers_tried)+1}: {provider_name} (cost: ${self.settings.service_costs.get(provider_name, 0)}/search)")
            
            try:
                provider_start = time.time()
                provider_func = PROVIDER_FUNCTIONS[provider_name]
                provider_result = provider_func(normalized_lead)
                provider_time = time.time() - provider_start
                
                providers_tried.append(provider_name)
                total_cost += self.settings.service_costs.get(provider_name, 0)
                
                logger.info(f"{provider_name} completed in {provider_time:.2f}s")
                
                # Process the result
                if provider_result and isinstance(provider_result, dict):
                    email = provider_result.get("email")
                    phone = provider_result.get("phone") 
                    confidence = provider_result.get("confidence", 0)
                    
                    # Update result if we got better data
                    if email and (not result.email or confidence > result.confidence):
                        result.email = email
                        result.confidence = confidence / 100 if confidence > 1 else confidence  # Normalize to 0-1
                        result.source = provider_name
                        result.raw_data = provider_result.get("raw_data", {})
                    
                    if phone and not result.phone:
                        result.phone = phone
                    
                    if email:
                        logger.info(f"✓ {provider_name} found email: {email} (confidence: {confidence})")
                    
                    if phone:
                        logger.info(f"✓ {provider_name} found phone: {phone}")
                
            except Exception as e:
                logger.error(f"Error calling {provider_name}: {str(e)}")
                providers_tried.append(f"{provider_name}_error")
                continue
        
        # Perform email verification if we found an email
        if result.email and self.settings.enable_email_verification:
            logger.info(f"Verifying email: {result.email}")
            try:
                email_verification = await email_verifier.verify_email(result.email)
                result.email_verified = email_verification.is_valid
                result.email_verification_score = email_verification.score / 100
                result.email_verification_details = {
                    "verification_level": email_verification.verification_level,
                    "is_catchall": email_verification.is_catchall,
                    "is_disposable": email_verification.is_disposable,
                    "is_role_based": email_verification.is_role_based,
                    "deliverable": email_verification.deliverable,
                    "reason": email_verification.reason
                }
                logger.info(f"Email verification: valid={email_verification.is_valid}, score={email_verification.score}")
            except Exception as e:
                logger.error(f"Email verification failed: {str(e)}")
        
        # Perform phone verification if we found a phone
        if result.phone and self.settings.enable_phone_verification:
            logger.info(f"Verifying phone: {result.phone}")
            try:
                phone_verification = await phone_verifier.verify_phone(result.phone)
                result.phone_verified = phone_verification.is_valid
                result.phone_verification_score = phone_verification.score / 100
                result.phone_verification_details = {
                    "is_mobile": phone_verification.is_mobile,
                    "is_landline": phone_verification.is_landline,
                    "is_voip": phone_verification.is_voip,
                    "country": phone_verification.country,
                    "carrier": phone_verification.carrier_name,
                    "region": phone_verification.region,
                    "formatted_international": phone_verification.formatted_international,
                    "reason": phone_verification.reason
                }
                logger.info(f"Phone verification: valid={phone_verification.is_valid}, type={'mobile' if phone_verification.is_mobile else 'landline' if phone_verification.is_landline else 'voip'}")
            except Exception as e:
                logger.error(f"Phone verification failed: {str(e)}")
        
        # Finalize result
        result.providers_tried = providers_tried
        result.total_cost = total_cost
        result.processing_time = time.time() - start_time
        
        # Update global stats
        self.total_enrichments += 1
        self.total_cost += total_cost
        self.total_processing_time += result.processing_time
        
        # Log final result
        status = "✓ SUCCESS" if result.email else "✗ NO EMAIL"
        logger.info(f"{status} for {contact_name} - Providers: {len(providers_tried)}, Cost: ${total_cost:.4f}, Time: {result.processing_time:.2f}s")
        
        if result.email:
            verification_info = ""
            if result.email_verified:
                verification_info += f" (verified: {result.email_verification_score:.0%})"
            logger.info(f"Final email: {result.email} from {result.source}{verification_info}")
        
        if result.phone:
            verification_info = ""
            if result.phone_verified:
                phone_type = "mobile" if result.phone_verification_details.get("is_mobile") else "landline"
                verification_info += f" (verified: {phone_type})"
            logger.info(f"Final phone: {result.phone}{verification_info}")
        
        return result
    
    async def enrich_batch(self, leads: List[Dict[str, Any]], max_concurrent: int = 5) -> List[EnrichmentResult]:
        """
        Enrich multiple contacts concurrently
        """
        logger.info(f"Starting batch enrichment for {len(leads)} contacts (max concurrent: {max_concurrent})")
        
        batch_start = time.time()
        results = []
        
        # Process in batches to control concurrency
        for i in range(0, len(leads), max_concurrent):
            batch_leads = leads[i:i + max_concurrent]
            batch_num = (i // max_concurrent) + 1
            total_batches = (len(leads) + max_concurrent - 1) // max_concurrent
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch_leads)} contacts)")
            
            # Create async tasks for this batch
            tasks = [self.enrich_contact(lead) for lead in batch_leads]
            
            # Wait for all tasks in this batch to complete
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results and handle exceptions
            for j, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    logger.error(f"Error enriching contact {i+j+1}: {str(result)}")
                    # Create error result
                    error_result = EnrichmentResult()
                    error_result.raw_data = {"error": str(result)}
                    results.append(error_result)
                else:
                    results.append(result)
        
        batch_time = time.time() - batch_start
        success_count = sum(1 for r in results if r.email)
        success_rate = (success_count / len(results)) * 100 if results else 0
        
        logger.info(f"Batch enrichment complete: {success_count}/{len(results)} emails found ({success_rate:.1f}%)")
        logger.info(f"Total batch time: {batch_time:.1f}s, Average: {batch_time/len(results):.2f}s per contact")
        logger.info(f"Total batch cost: ${sum(r.total_cost for r in results):.4f}")
        
        return results
    
    def _normalize_lead_data(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize lead data to standard format"""
        normalized = {}
        
        # Handle different name formats
        if "full_name" in lead:
            normalized["full_name"] = lead["full_name"]
        elif "Full Name" in lead:
            normalized["full_name"] = lead["Full Name"]
        elif "first_name" in lead and "last_name" in lead:
            normalized["full_name"] = f"{lead['first_name']} {lead['last_name']}".strip()
        elif "First Name" in lead and "Last Name" in lead:
            normalized["full_name"] = f"{lead['First Name']} {lead['Last Name']}".strip()
        
        # Extract first and last names
        full_name = normalized.get("full_name", "")
        if full_name and " " in full_name:
            parts = full_name.split(" ", 1)
            normalized["first_name"] = parts[0]
            normalized["last_name"] = parts[1]
        
        # Company information
        for key in ["company", "Company"]:
            if key in lead:
                normalized["company"] = lead[key]
                break
        
        for key in ["company_domain", "Company Domain", "domain"]:
            if key in lead:
                normalized["company_domain"] = lead[key]
                break
        
        # LinkedIn URL
        for key in ["profile_url", "LinkedIn URL", "linkedin_url", "linkedin"]:
            if key in lead:
                normalized["profile_url"] = lead[key]
                break
        
        # Copy other fields as-is
        for key, value in lead.items():
            if key not in normalized:
                normalized[key] = value
        
        return normalized
    
    def _get_contact_display_name(self, lead: Dict[str, Any]) -> str:
        """Get a display name for the contact"""
        if "full_name" in lead:
            return lead["full_name"]
        elif "first_name" in lead and "last_name" in lead:
            return f"{lead['first_name']} {lead['last_name']}"
        elif "company" in lead:
            return f"Contact at {lead['company']}"
        else:
            return "Unknown Contact"
    
    def _should_stop_cascade(self, result: EnrichmentResult, providers_tried: List[str]) -> bool:
        """Determine if we should stop the cascade early"""
        if not self.settings.cascade_stop_on_high_confidence:
            return False
        
        # Stop if we have excellent confidence email
        if result.email and result.confidence >= self.settings.excellent_confidence:
            return True
        
        # Stop if we have high confidence email and phone
        if (result.email and result.phone and 
            result.confidence >= self.settings.high_confidence):
            return True
        
        return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get enrichment statistics"""
        avg_time = self.total_processing_time / self.total_enrichments if self.total_enrichments > 0 else 0
        avg_cost = self.total_cost / self.total_enrichments if self.total_enrichments > 0 else 0
        
        return {
            "total_enrichments": self.total_enrichments,
            "total_cost": self.total_cost,
            "total_processing_time": self.total_processing_time,
            "average_time_per_contact": avg_time,
            "average_cost_per_contact": avg_cost
        }


# Global engine instance
enrichment_engine = EnrichmentEngine()


async def enrich_single_contact(lead: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function to enrich a single contact and return as dict
    """
    result = await enrichment_engine.enrich_contact(lead)
    
    return {
        "email": result.email,
        "phone": result.phone,
        "confidence": result.confidence,
        "source": result.source,
        "email_verified": result.email_verified,
        "phone_verified": result.phone_verified,
        "email_verification_score": result.email_verification_score,
        "phone_verification_score": result.phone_verification_score,
        "email_verification_details": result.email_verification_details,
        "phone_verification_details": result.phone_verification_details,
        "providers_tried": result.providers_tried,
        "total_cost": result.total_cost,
        "processing_time": result.processing_time
    }


async def enrich_contacts_batch(leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Convenience function to enrich multiple contacts and return as list of dicts
    """
    results = await enrichment_engine.enrich_batch(leads)
    
    return [
        {
            "email": result.email,
            "phone": result.phone,
            "confidence": result.confidence,
            "source": result.source,
            "email_verified": result.email_verified,
            "phone_verified": result.phone_verified,
            "email_verification_score": result.email_verification_score,
            "phone_verification_score": result.phone_verification_score,
            "email_verification_details": result.email_verification_details,
            "phone_verification_details": result.phone_verification_details,
            "providers_tried": result.providers_tried,
            "total_cost": result.total_cost,
            "processing_time": result.processing_time
        }
        for result in results
    ] 