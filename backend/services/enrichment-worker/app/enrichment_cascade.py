import os
import csv
import time
import json
import logging
import requests
from typing import Dict, List, Optional, Tuple
import concurrent.futures
from pathlib import Path
import random
import socket
import base64

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("enrichment_cascade")

# API Keys - prioritize environment variables
API_KEYS = {
    # Get from environment variable or fall back to hardcoded value
    "hunter": os.environ.get("HUNTER_API_KEY", "1b8302af512410b685217b7fcf00be362e094f0e"),
    "dropcontact": os.environ.get("DROPCONTACT_API_KEY", "zzqP8RNF6KXajJVgYaQiWeZW64J2mX"),
    "icypeas_api": os.environ.get("ICYPEAS_API_KEY", "4faf07894e7c40eaac9c608b7f0f5556c7a903707632458c8fc985cd3cc58b8b"),
    "icypeas_secret": os.environ.get("ICYPEAS_API_SECRET", "e7a3e867b51d1e59518d50d592e1f7aa1a5eccf7c7c56377c9d8dbddc35b2289"),
    "apollo": os.environ.get("APOLLO_API_KEY", "wLViVqsiBd3Cp56pFyc8nA")
}

# API base URLs - consolidated in one place for easier management
API_URLS = {
    "hunter": "https://api.hunter.io/v2",
    "dropcontact": "https://api.dropcontact.io",  # Fixed to correct base URL per official docs
    # Official domains per documentation
    "icypeas": "https://app.icypeas.com/api",  # official base URL per docs
    "apollo": "https://api.apollo.io/v1"
}

# API rate limits (requests per minute)
RATE_LIMITS = {
    "hunter": 20,
    "dropcontact": 10,
    "icypeas": 60,
    "apollo": 30
}

# Set timeouts for all API calls
DEFAULT_TIMEOUT = 15  # seconds
MAX_POLLING_TIMEOUT = 60  # seconds

# Maximum retry attempts for API calls
MAX_RETRIES = 3
# Base delay between retries (will be multiplied by attempt number)
RETRY_DELAY = 2

# Function to implement retry logic with exponential backoff
def retry_with_backoff(func):
    def wrapper(*args, **kwargs):
        max_attempts = MAX_RETRIES
        for attempt in range(1, max_attempts + 1):
            try:
                return func(*args, **kwargs)
            except (requests.RequestException, socket.gaierror) as e:
                if attempt == max_attempts:
                    # Last attempt, re-raise the exception
                    raise
                
                # Calculate backoff delay with jitter to avoid thundering herd problem
                delay = RETRY_DELAY * attempt + random.uniform(0, 1)
                logger.warning(f"Attempt {attempt} failed with error: {str(e)}. Retrying in {delay:.2f} seconds...")
                time.sleep(delay)
        
        # Should never reach here, but just in case
        raise Exception("Retry mechanism failed after maximum attempts")
    return wrapper


class EnrichmentService:
    """Base class for all enrichment services"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.name = "base"
        self.last_request_time = 0
        self.min_interval = 60 / RATE_LIMITS.get(self.name, 30)  # Default to 30 requests per minute
        self.base_url = API_URLS.get(self.name)
        self.service_available = True  # Track if service is available
    
    def _respect_rate_limit(self):
        """Ensures we don't exceed the rate limit"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            logger.debug(f"Rate limiting {self.name}: sleeping for {sleep_time:.2f} seconds")
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def enrich_contact(self, contact: Dict) -> Dict:
        """Enrich a single contact - to be implemented by subclasses"""
        raise NotImplementedError
    
    def get_email_confidence(self, result: Dict) -> float:
        """Get the confidence score for an email result"""
        return 0.0
    
    @retry_with_backoff
    def _make_request(self, method, url, **kwargs):
        """Make an HTTP request with retries and proper error handling"""
        self._respect_rate_limit()
        
        if method.lower() == 'get':
            response = requests.get(url, **kwargs)
        elif method.lower() == 'post':
            response = requests.post(url, **kwargs)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        # Check for rate limiting or other service issues
        if response.status_code == 429:
            logger.warning(f"{self.name} API rate limit exceeded. Consider adjusting rate limits.")
            # Increase backoff time for rate limits
            time.sleep(10)  # Hard pause for rate limit
            raise requests.RequestException("Rate limit exceeded")
        
        return response


class HunterEnrichment(EnrichmentService):
    """Hunter.io enrichment service"""
    
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.name = "hunter"
        self.min_interval = 60 / RATE_LIMITS.get(self.name, 20)
        self.base_url = API_URLS.get(self.name)
    
    def enrich_contact(self, contact: Dict) -> Dict:
        """Enrich a contact using Hunter.io's API"""
        if not self.service_available:
            logger.warning(f"{self.name} service marked as unavailable, skipping")
            return {"email": None, "phone": None, "confidence": 0, "source": self.name}
            
        try:
            # First, try to find a domain for the company
            company_name = contact.get("Company", "").split("(")[0].strip()
            if not company_name:
                logger.info(f"Hunter: No company name for {contact.get('Full Name')}")
                return {"email": None, "phone": None, "confidence": 0, "source": self.name}
                
            logger.info(f"Hunter: Looking up domain for company: {company_name}")
            
            # Domain search endpoint
            domain_endpoint = f"{self.base_url}/domain-search"
            params = {
                "company": company_name,
                "api_key": self.api_key
            }
            
            # Get the domain for the company
            domain_response = requests.get(domain_endpoint, params=params, timeout=15)
            
            domain = None
            if domain_response.status_code == 200:
                domain_data = domain_response.json().get("data", {})
                domain = domain_data.get("domain", "")
                logger.info(f"Hunter found domain for {company_name}: {domain}")
            elif domain_response.status_code == 401 or domain_response.status_code == 403:
                logger.error(f"Hunter API authentication failed. Check API key.")
                self.service_available = False
                return {"email": None, "phone": None, "confidence": 0, "source": self.name}
            else:
                logger.warning(f"Hunter domain search error: {domain_response.status_code} - {domain_response.text}")
            
            # If no domain found, try alternate method (use LinkedIn URL)
            if not domain and contact.get("LinkedIn URL"):
                linkedin_url = contact.get("LinkedIn URL")
                linkedin_parts = linkedin_url.split("/")
                if len(linkedin_parts) > 4 and linkedin_parts[2] == "www.linkedin.com":
                    logger.info(f"Hunter: Falling back to LinkedIn URL for domain extraction")
                    
                    # Extract company from LinkedIn URL if possible
                    if "company" in linkedin_url:
                        # Try to find company name in URL
                        company_endpoint = f"{self.base_url}/finder"
                        company_params = {
                            "url": linkedin_url,
                            "api_key": self.api_key
                        }
                        company_response = requests.get(company_endpoint, params=company_params, timeout=15)
                        if company_response.status_code == 200:
                            company_data = company_response.json().get("data", {})
                            domain = company_data.get("domain", "")
                            logger.info(f"Hunter extracted domain from LinkedIn: {domain}")
            
            # If still no domain, return no results
            if not domain:
                logger.info(f"Hunter: No domain found for company {company_name}")
                return {"email": None, "phone": None, "confidence": 0, "source": self.name}
            
            # Now search for the contact's email using email-finder endpoint
            email_endpoint = f"{self.base_url}/email-finder"
            email_params = {
                "domain": domain,
                "first_name": contact.get("First Name", ""),
                "last_name": contact.get("Last Name", ""),
                "api_key": self.api_key
            }
            
            logger.info(f"Hunter: Looking up email for {contact.get('Full Name')} at {domain}")
            
            # Get the email for the contact
            email_response = requests.get(email_endpoint, params=email_params, timeout=15)
            
            if email_response.status_code == 200:
                email_data = email_response.json().get("data", {})
                
                email = email_data.get("email", "")
                confidence = email_data.get("score", 0)
                
                logger.info(f"Hunter found email for {contact.get('Full Name')}: {email} (confidence: {confidence})")
                
                return {
                    "email": email if email else None,
                    "phone": None,  # Hunter doesn't typically return phone numbers
                    "confidence": confidence,
                    "source": self.name
                }
            else:
                logger.warning(f"Hunter email finder error: {email_response.status_code} - {email_response.text}")
                
                # Check if this is an authentication issue
                if email_response.status_code == 401 or email_response.status_code == 403:
                    logger.error(f"Hunter API authentication failed. API key may be invalid.")
                    self.service_available = False
        except Exception as e:
            logger.error(f"Error in Hunter enrichment: {str(e)}")
        
        return {"email": None, "phone": None, "confidence": 0, "source": self.name}
    
    def get_email_confidence(self, result: Dict) -> float:
        """Get the confidence score for an email result"""
        return result.get("confidence", 0) / 100


class DropcontactEnrichment(EnrichmentService):
    """Dropcontact enrichment service"""
    
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.name = "dropcontact"
        self.min_interval = 60 / RATE_LIMITS.get(self.name, 10)
        self.base_url = API_URLS.get(self.name)
    
    def _extract_domain_from_company(self, company_name: str) -> str:
        """Extract a likely domain from company name"""
        if not company_name:
            return ""
        
        # Clean the company name
        company = company_name.lower().strip()
        # Remove common suffixes
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co", " sa", " sas", " sarl"]:
            if company.endswith(suffix):
                company = company[:-len(suffix)].strip()
        
        # Remove special characters and spaces
        company = "".join(c for c in company if c.isalnum())
        
        if company:
            return f"{company}.com"
        return ""
    
    def enrich_contact(self, contact: Dict) -> Dict:
        """Enrich a contact using Dropcontact's API"""
        if not self.service_available:
            logger.warning(f"{self.name} service marked as unavailable, skipping")
            return {"email": None, "phone": None, "confidence": 0, "source": self.name}
            
        try:
            # Verify API key format (Dropcontact keys are typically long strings)
            if len(self.api_key) < 10:
                logger.error(f"Dropcontact API key seems too short, might be invalid")
                self.service_available = False
                return {"email": None, "phone": None, "confidence": 0, "source": self.name}
            
            # Create the request data - optimized for faster processing
            data = {
                "data": [{
                    "first_name": contact.get("First Name", ""),
                    "last_name": contact.get("Last Name", ""),
                    "company": contact.get("Company", ""),
                    "website": self._extract_domain_from_company(contact.get("Company", "")),
                    "linkedin": contact.get("LinkedIn URL", "")
                }],
                # Use sync mode for immediate results when possible
                "sync": True,  # Try sync mode first for faster results
                "siren": True,
                "language": "en",
                "num": True
            }
            
            # Prepare headers
            headers = {
                "Content-Type": "application/json",
                "X-Access-Token": self.api_key
            }

            # Quick credits probe recommended by docs - send an empty object that consumes 0 credits
            try:
                credits_probe = requests.post(
                    f"{self.base_url}/v1/enrich/all",
                    json={"data": [{}]},
                    headers=headers,
                    timeout=10
                )
                if credits_probe.status_code in (200, 201):
                    credits_info = credits_probe.json()
                    credits_left = credits_info.get("credits_left", 0)
                    logger.info(f"Dropcontact API valid. Credits remaining: {credits_left}")
                    if credits_left < 1:
                        logger.warning(f"Dropcontact API has insufficient credits: {credits_left}")
                        self.service_available = False
                        return {"email": None, "phone": None, "confidence": 0, "source": self.name}
                elif credits_probe.status_code in (401, 403):
                    logger.error(f"Dropcontact API key is invalid. Status: {credits_probe.status_code}")
                    self.service_available = False
                    return {"email": None, "phone": None, "confidence": 0, "source": self.name}
                # Any 404 ignored – /credit removed from API
            except Exception as e:
                logger.warning(f"Credits probe to Dropcontact failed: {str(e)}")
                # continue; main request might still work
            
            # Make the main request to the Dropcontact API
            response = requests.post(f"{self.base_url}/v1/enrich/all", 
                                     json=data, 
                                     headers=headers,
                                     timeout=45)  # Increased timeout for sync mode
            
            if response.status_code == 200 or response.status_code == 201:
                result = response.json()
                
                # Check if sync mode returned data directly
                if "data" in result and len(result["data"]) > 0:
                    first_data = result["data"][0]
                    email_data = first_data.get("email", {})
                    phone_data = first_data.get("phone", {})
                    
                    if isinstance(email_data, list) and len(email_data) > 0:
                        # New format: email is a list of objects
                        email = email_data[0].get("email")
                        qualification = email_data[0].get("qualification", "")
                    elif isinstance(email_data, dict):
                        # Old format: email is a dict
                        email = email_data.get("email")
                        qualification = email_data.get("quality", "")
                    else:
                        email = None
                        qualification = ""
                    
                    if isinstance(phone_data, list) and len(phone_data) > 0:
                        phone = phone_data[0].get("number")
                    elif isinstance(phone_data, dict):
                        phone = phone_data.get("number")
                    else:
                        phone = None
                    
                    # Map qualification to confidence
                    confidence = 0.9 if "nominative@pro" in qualification else 0.7 if "pro" in qualification else 0.5
                    
                    if email:
                        logger.info(f"Dropcontact SYNC found for {contact.get('Full Name')}: Email: {email}, Phone: {phone}")
                        return {
                            "email": email,
                            "phone": phone,
                            "confidence": confidence,
                            "source": self.name
                        }
                
                # If sync mode didn't return data, check for async request_id
                elif "request_id" in result:
                    request_id = result["request_id"]
                    logger.info(f"Dropcontact sync mode empty, trying async with ID: {request_id}")
                    
                    # Fallback to async polling with shorter timeout
                    polling_result = self._poll_dropcontact_results_fast(request_id, headers)
                    if polling_result and "data" in polling_result and len(polling_result["data"]) > 0:
                        first_data = polling_result["data"][0]
                        email_data = first_data.get("email", {})
                        phone_data = first_data.get("phone", {})
                        
                        if isinstance(email_data, list) and len(email_data) > 0:
                            email = email_data[0].get("email")
                            qualification = email_data[0].get("qualification", "")
                        elif isinstance(email_data, dict):
                            email = email_data.get("email")
                            qualification = email_data.get("quality", "")
                        else:
                            email = None
                            qualification = ""
                        
                        if isinstance(phone_data, list) and len(phone_data) > 0:
                            phone = phone_data[0].get("number")
                        elif isinstance(phone_data, dict):
                            phone = phone_data.get("number")
                        else:
                            phone = None
                        
                        confidence = 0.9 if "nominative@pro" in qualification else 0.7 if "pro" in qualification else 0.5
                        
                        if email:
                            logger.info(f"Dropcontact ASYNC found for {contact.get('Full Name')}: Email: {email}, Phone: {phone}")
                            return {
                                "email": email,
                                "phone": phone,
                                "confidence": confidence,
                                "source": self.name
                            }
                else:
                    logger.warning(f"Unexpected Dropcontact response format: {result}")
            else:
                logger.warning(f"Dropcontact API error: {response.status_code} - {response.text}")
                
                # Check if this is an authentication issue
                if response.status_code == 401 or response.status_code == 403:
                    logger.error(f"Dropcontact API authentication failed. API key may be invalid.")
                    self.service_available = False
        except Exception as e:
            logger.error(f"Error in Dropcontact enrichment: {str(e)}")
        
        return {"email": None, "phone": None, "confidence": 0, "source": self.name}
    
    def _poll_dropcontact_results_fast(self, request_id: str, headers: Dict) -> Dict:
        """Fast polling for Dropcontact with shorter timeouts as fallback"""
        max_attempts = 4  # Shorter polling for fallback
        attempts = 0
        
        while attempts < max_attempts:
            attempts += 1
            
            # Fast polling schedule: 2s, 4s, 6s, 8s
            wait_times = [2, 4, 6, 8]
            wait_time = wait_times[attempts - 1] if attempts <= len(wait_times) else 10
            
            logger.info(f"Fast polling Dropcontact status (attempt {attempts}/{max_attempts}) - waiting {wait_time}s")
            time.sleep(wait_time)
            
            try:
                response = requests.get(f"{self.base_url}/v1/enrich/all/{request_id}", 
                                     headers=headers,
                                     timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    status = result.get("status")
                    
                    logger.info(f"Dropcontact fast poll {attempts}: {status}")
                    
                    if status == "completed":
                        logger.info(f"Dropcontact fast poll completed after {attempts} attempts")
                        return result
                    elif status == "failed":
                        logger.warning(f"Dropcontact fast poll failed: {result}")
                        return {}
                    elif status == "processing" or status is None:
                        continue
                    else:
                        logger.info(f"Dropcontact fast poll status: {status}")
                        continue
                elif response.status_code == 404:
                    logger.warning(f"Dropcontact request ID not found: {request_id}")
                    return {}
                else:
                    logger.warning(f"Dropcontact fast poll error: {response.status_code}")
                    continue
            except Exception as e:
                logger.error(f"Error in fast polling: {str(e)}")
                continue
        
        logger.info(f"Dropcontact fast polling timeout for request_id {request_id}")
        return {}
    
    def get_email_confidence(self, result: Dict) -> float:
        """Get the confidence score for an email result"""
        confidence = result.get("confidence", 0)
        # Map Dropcontact quality scores to confidence values
        if isinstance(confidence, str):
            if confidence == "high":
                return 0.9
            elif confidence == "medium":
                return 0.7
            elif confidence == "low":
                return 0.4
            else:
                return 0.3
        return 0.0


class IcypeasEnrichment(EnrichmentService):
    """Icypeas enrichment service"""
    
    def __init__(self, api_key: str, api_secret: str):
        super().__init__(api_key)
        self.api_secret = api_secret
        self.name = "icypeas"
        self.min_interval = 60 / RATE_LIMITS.get(self.name, 60)
        self.base_url = API_URLS.get(self.name)
    
    def enrich_contact(self, contact: Dict) -> Dict:
        """Enrich a contact using Icypeas async email-search API"""
        if not self.service_available:
            logger.warning(f"{self.name} service marked as unavailable, skipping")
            return {"email": None, "phone": None, "confidence": 0, "source": self.name}

        try:
            # Icypeas authentication - use only the API key in Authorization header
            headers = {
                "Content-Type": "application/json", 
                "Authorization": self.api_key  # This is the correct method!
            }

            launch_payload = {
                "firstname": contact.get("First Name", ""),
                "lastname": contact.get("Last Name", ""),
                "domainOrCompany": contact.get("Company", "") or contact.get("Domain", "")
            }
            if contact.get("LinkedIn URL"):
                launch_payload["linkedin"] = contact["LinkedIn URL"]

            # 1) Launch async search
            launch_url = f"{self.base_url}/email-search"
            logger.debug(f"Icypeas launch payload: {launch_payload}")
            logger.debug(f"Icypeas auth headers: {headers}")
            launch_resp = self._make_request("post", launch_url, json=launch_payload, headers=headers, timeout=30)

            if launch_resp.status_code not in (200, 201):
                logger.warning(f"Icypeas launch error: {launch_resp.status_code} {launch_resp.text}")
                if launch_resp.status_code == 401:
                    logger.error("Icypeas authentication failed. Check API credentials.")
                    self.service_available = False
                return {"email": None, "phone": None, "confidence": 0, "source": self.name}

            req_id = launch_resp.json().get("item", {}).get("_id")
            if not req_id:
                logger.warning("Icypeas did not return request id")
                return {"email": None, "phone": None, "confidence": 0, "source": self.name}

            # 2) Poll for result using the same headers
            poll_url = f"{self.base_url}/bulk-single-searchs/read"
            max_attempts = 6
            wait_seq = [3, 5, 8, 12, 20, 30]

            for attempt in range(max_attempts):
                time.sleep(wait_seq[attempt])
                poll_resp = self._make_request("post", poll_url, json={"id": req_id}, headers=headers, timeout=20)

                if poll_resp.status_code != 200:
                    continue

                items = poll_resp.json().get("items", [])
                if not items:
                    continue

                item = items[0]
                status = item.get("status")
                if status not in ("DEBITED", "FREE"):  # still processing
                    continue

                results = item.get("results", {})
                emails = results.get("emails", [])
                phone = None
                if results.get("phones"):
                    phone = results["phones"][0]

                if emails:
                    best = emails[0]
                    email_addr = best.get("email")
                    certainty = best.get("certainty", "risky")
                    confidence = 0.9 if certainty == "ultra_sure" else 0.75 if certainty == "sure" else 0.4
                    return {"email": email_addr, "phone": phone, "confidence": confidence, "source": self.name}

            logger.info("Icypeas search completed with no email found")
            return {"email": None, "phone": None, "confidence": 0, "source": self.name}

        except Exception as e:
            logger.error(f"Error in Icypeas enrichment: {str(e)}")
            return {"email": None, "phone": None, "confidence": 0, "source": self.name}
    
    def get_email_confidence(self, result: Dict) -> float:
        """Get the confidence score for an email result"""
        return result.get("confidence", 0) / 100


class ApolloEnrichment(EnrichmentService):
    """Apollo.io enrichment service"""
    
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.name = "apollo"
        self.min_interval = 60 / RATE_LIMITS.get(self.name, 30)
        self.base_url = API_URLS.get(self.name)
    
    def enrich_contact(self, contact: Dict) -> Dict:
        """Enrich a contact using Apollo's API"""
        if not self.service_available:
            logger.warning(f"{self.name} service marked as unavailable, skipping")
            return {"email": None, "phone": None, "confidence": 0, "source": self.name}
            
        try:
            # Headers with API key (Apollo requires X-Api-Key header instead of query parameter)
            headers = {
                "Content-Type": "application/json",
                "X-Api-Key": self.api_key
            }
            
            # Prepare data
            data = {
                "first_name": contact.get("First Name", ""),
                "last_name": contact.get("Last Name", ""),
                "organization_name": contact.get("Company", ""),
                "title": contact.get("Position", "")
            }
            
            # If we have a LinkedIn URL, use that
            if contact.get("LinkedIn URL"):
                data["linkedin_url"] = contact.get("LinkedIn URL")
            
            logger.info(f"Sending request to Apollo for {contact.get('Full Name')}")
            
            # Make the request to the Apollo API
            response = requests.post(f"{self.base_url}/people/match", 
                                    json=data, 
                                    headers=headers,
                                    timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                
                if "person" in result:
                    email = result["person"].get("email")
                    phone = result["person"].get("phone_number")
                    
                    # Filter out Apollo's placeholder emails that indicate locked results
                    if email and ("email_not_unlocked" in email.lower() or 
                                 "not_unlocked" in email.lower() or
                                 email.endswith("@domain.com") or
                                 email.startswith("email_not_unlocked")):
                        logger.warning(f"Apollo returned locked email placeholder: {email}")
                        email = None
                    
                    # In Apollo, we can check if email is verified
                    email_status = result["person"].get("email_status")
                    
                    if email:
                        confidence = 0.9 if email_status == "verified" else 0.6
                        logger.info(f"Apollo found for {contact.get('Full Name')}: Email: {email}, Phone: {phone}")
                        
                        return {
                            "email": email,
                            "phone": phone,
                            "confidence": confidence,
                            "source": self.name
                        }
                    else:
                        logger.info(f"Apollo - Email found but locked/placeholder for {contact.get('Full Name')}")
                else:
                    logger.info(f"Apollo - No match found for {contact.get('Full Name')}")
            else:
                logger.warning(f"Apollo API error: {response.status_code} - {response.text}")
                
                # Check if this is an authentication issue
                if response.status_code == 401 or response.status_code == 403 or response.status_code == 422:
                    logger.error(f"Apollo API authentication failed. API key may be invalid.")
                    self.service_available = False
        except Exception as e:
            logger.error(f"Error in Apollo enrichment: {str(e)}")
        
        return {"email": None, "phone": None, "confidence": 0, "source": self.name}
    
    def get_email_confidence(self, result: Dict) -> float:
        """Get the confidence score for an email result"""
        return result.get("confidence", 0)


class EnrichmentCascade:
    """Cascading enrichment service that tries multiple sources"""
    
    def __init__(self):
        # Initialize all services
        logger.info("Initializing enrichment services...")
        self.services = []
        
        # Initialize each service with error handling
        try:
            self.services.append(IcypeasEnrichment(API_KEYS["icypeas_api"], API_KEYS["icypeas_secret"]))
            logger.info("Icypeas service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Icypeas service: {str(e)}")
        
        try:
            self.services.append(DropcontactEnrichment(API_KEYS["dropcontact"]))
            logger.info("Dropcontact service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Dropcontact service: {str(e)}")
            
        try:
            self.services.append(HunterEnrichment(API_KEYS["hunter"]))
            logger.info("Hunter service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Hunter service: {str(e)}")
            
        try:
            self.services.append(ApolloEnrichment(API_KEYS["apollo"]))
            logger.info("Apollo service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Apollo service: {str(e)}")
        
        # Test connections to each service at initialization
        if not self.services:
            logger.error("No enrichment services could be initialized! Enrichment will not work.")
        else:
            self._test_services()
    
    def _test_services(self):
        """Test connections to each service and log availability"""
        working_services = []
        
        for service in self.services:
            logger.info(f"Testing connection to {service.name}...")
            
            try:
                if service.name == "icypeas":
                    # For Icypeas, test with a domain verification request
                    try:
                        headers = {"Authorization": service.api_key}
                        test_url = f"{service.base_url}/domain-verification"
                        
                        # Use a simple domain for testing
                        data = {"domain": "gmail.com"}
                        response = requests.post(test_url, json=data, headers=headers, timeout=5)
                        
                        if response.status_code == 200:
                            logger.info(f"Icypeas API is accessible: status {response.status_code}")
                            working_services.append(service)
                        elif response.status_code in (401, 403):
                            logger.warning(f"Icypeas API authentication issue: {response.status_code}")
                            # Still add to try later with alternate auth
                            working_services.append(service)
                        else:
                            logger.warning(f"Icypeas API returned status: {response.status_code}")
                            # Still keep it for trying
                            working_services.append(service)
                    except Exception as e:
                        logger.warning(f"Icypeas API test error: {str(e)}")
                        # Still add the service - we'll try it anyway
                        working_services.append(service)
                
                elif service.name == "hunter":
                    # Try account check for Hunter
                    try:
                        test_url = f"{service.base_url}/account?api_key={service.api_key}"
                        response = requests.get(test_url, timeout=5)
                        if response.status_code == 200:
                            account_info = response.json().get("data", {})
                            calls_left = account_info.get("calls", {}).get("left", 0)
                            logger.info(f"Hunter API available. Calls remaining: {calls_left}")
                            working_services.append(service)
                        else:
                            logger.warning(f"Hunter API error: {response.status_code}")
                            if response.status_code in (401, 403):
                                service.service_available = False
                    except Exception as e:
                        logger.warning(f"Hunter test error: {str(e)}")
                
                elif service.name == "dropcontact":
                    # Quick probe using empty object per docs
                    try:
                        probe_resp = requests.post(
                            f"{service.base_url}/v1/enrich/all",
                            json={"data": [{}]},
                            headers={"X-Access-Token": service.api_key, "Content-Type": "application/json"},
                            timeout=5
                        )
                        if probe_resp.status_code in (200, 201):
                            credits = probe_resp.json().get("credits_left", 0)
                            logger.info(f"Dropcontact API available. Credits: {credits}")
                            working_services.append(service)
                        elif probe_resp.status_code in (401, 403):
                            logger.warning(f"Dropcontact API authentication failed: {probe_resp.status_code}")
                            service.service_available = False
                        else:
                            logger.warning(f"Dropcontact probe returned status: {probe_resp.status_code}")
                            working_services.append(service)  # still usable
                    except Exception as e:
                        logger.warning(f"Dropcontact probe error: {str(e)}")
                        working_services.append(service)
                
                elif service.name == "apollo":
                    # Simple check for Apollo
                    try:
                        test_url = f"{service.base_url}/organizations/enrich"
                        response = requests.post(
                            test_url, 
                            json={"domain": "apollo.io"},
                            headers={"X-Api-Key": service.api_key},
                            timeout=5
                        )
                        if response.status_code in (200, 400, 401, 403):
                            logger.info(f"Apollo API is reachable: status {response.status_code}")
                            if response.status_code not in (401, 403):
                                working_services.append(service)
                            else:
                                service.service_available = False
                        else:
                            logger.warning(f"Apollo API returned unexpected status: {response.status_code}")
                    except Exception as e:
                        logger.warning(f"Apollo test error: {str(e)}")
                
            except Exception as e:
                logger.warning(f"Service {service.name} general test error: {str(e)}")
        
        # Log summary of working services
        if working_services:
            services_str = ", ".join([s.name for s in working_services])
            logger.info(f"Working enrichment services: {services_str}")
        else:
            logger.warning("No enrichment services are confirmed working. Enrichment may fail.")
            
        # If no services are working, try to at least keep one available for trying
        if not working_services and self.services:
            logger.info("Keeping at least one service available for trying...")
            self.services[0].service_available = True
    
    def enrich_contact(self, contact: Dict) -> Dict:
        """Try to enrich a contact using all services in sequence"""
        results = {}
        
        # Get the full name for logging
        full_name = contact.get("Full Name", "Unknown")
        logger.info(f"Starting enrichment cascade for {full_name}")
        
        for service in self.services:
            if not service.service_available:
                logger.info(f"Skipping {service.name} as it was marked unavailable")
                continue
                
            logger.info(f"Trying {service.name} for {full_name}")
            
            try:
                start_time = time.time()
                result = service.enrich_contact(contact)
                elapsed = time.time() - start_time
                
                logger.info(f"{service.name} for {full_name} completed in {elapsed:.2f} seconds")
                
                # If we got an email and it has good confidence, we're done
                if result.get("email") and service.get_email_confidence(result) > 0.5:
                    logger.info(f"Found good quality email from {service.name}: {result.get('email')}")
                    return {
                        "Email": result.get("email"),
                        "Phone": result.get("phone"),
                        "Email Source": service.name,
                        "Confidence": service.get_email_confidence(result)
                    }
                
                # Store the result for potential later use
                if result.get("email") or result.get("phone"):
                    results[service.name] = result
            except Exception as e:
                logger.error(f"Unexpected error in {service.name} for {full_name}: {str(e)}")
        
        # If we got here, we didn't find a high-confidence email
        # Use the best result we got
        if results:
            logger.info(f"No high-confidence email found, selecting best from {len(results)} results")
            
            best_result = None
            best_confidence = 0
            best_service = None
            
            for service_name, result in results.items():
                service = next((s for s in self.services if s.name == service_name), None)
                if not service:
                    continue
                    
                confidence = service.get_email_confidence(result)
                
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_result = result
                    best_service = service_name
            
            if best_result:
                logger.info(f"Selected best result from {best_service} with confidence {best_confidence:.2f}")
                return {
                    "Email": best_result.get("email"),
                    "Phone": best_result.get("phone"),
                    "Email Source": best_service,
                    "Confidence": best_confidence
                }
        
        # No email found
        logger.info(f"No email found for {full_name} from any service")
        return {
            "Email": None,
            "Phone": None,
            "Email Source": None,
            "Confidence": 0
        }


def process_csv(input_path: str, output_path: str = None, max_contacts: int = None):
    """Process a CSV file and enrich all contacts"""
    if not output_path:
        # Default output path adds "_enriched" to the filename
        base_path = Path(input_path).stem
        output_path = str(Path(input_path).parent / f"{base_path}_enriched.csv")
    
    # Create the enrichment cascade
    logger.info("Creating enrichment cascade for processing CSV")
    enrichment = EnrichmentCascade()
    
    # Read the input file
    contacts = []
    try:
        with open(input_path, 'r', newline='', encoding='utf-8-sig') as csv_file:
            reader = csv.DictReader(csv_file)
            for row in reader:
                contacts.append(row)
                if max_contacts and len(contacts) >= max_contacts:
                    break
    except Exception as e:
        logger.error(f"Error reading CSV file {input_path}: {str(e)}")
        return {
            "total": 0,
            "success": 0,
            "success_rate": 0,
            "error": str(e)
        }
    
    total_contacts = len(contacts)
    logger.info(f"Processing {total_contacts} contacts from {input_path}")
    
    if total_contacts == 0:
        logger.warning(f"No contacts found in {input_path}")
        return {
            "total": 0,
            "success": 0,
            "success_rate": 0,
            "error": "No contacts found in file"
        }
    
    # Create a progress-reporting context
    progress_interval = max(1, min(5, total_contacts // 10))  # Report every 10% or at least every 5 contacts
    start_time = time.time()
    
    # Enrich all contacts
    enriched_contacts = []
    found_count = 0
    
    for i, contact in enumerate(contacts):
        try:
            # Calculate progress percentage
            progress_pct = (i / total_contacts) * 100
            
            # Report progress at regular intervals
            if i % progress_interval == 0 or i == total_contacts - 1:
                elapsed = time.time() - start_time
                avg_time_per_contact = elapsed / (i + 1) if i > 0 else 0
                estimated_remaining = avg_time_per_contact * (total_contacts - i - 1)
                
                logger.info(f"Progress: {i+1}/{total_contacts} contacts ({progress_pct:.1f}%)")
                logger.info(f"Time elapsed: {elapsed:.1f}s, Est. remaining: {estimated_remaining:.1f}s")
                
                if found_count > 0:
                    success_rate = (found_count / (i + 1)) * 100
                    logger.info(f"Success rate so far: {success_rate:.1f}%")
            
            full_name = contact.get("Full Name", "Unknown Contact")
            logger.info(f"Processing contact {i+1}/{total_contacts}: {full_name}")
            
            # Enrich the contact
            enrichment_data = enrichment.enrich_contact(contact)
            
            # Add the enrichment data to the contact
            enriched_contact = {**contact, **enrichment_data}
            enriched_contacts.append(enriched_contact)
            
            # Count found emails
            if enriched_contact.get("Email"):
                found_count += 1
                logger.info(f"✓ Found email for {full_name}: {enriched_contact.get('Email')} (Source: {enriched_contact.get('Email Source')})")
            else:
                logger.info(f"✗ No email found for {full_name}")
                
            # Save intermediate results every 10 contacts
            if i > 0 and i % 10 == 0:
                try:
                    temp_output_path = f"{output_path}.partial"
                    fieldnames = list(enriched_contacts[0].keys()) if enriched_contacts else []
                    
                    with open(temp_output_path, 'w', newline='', encoding='utf-8-sig') as csv_file:
                        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(enriched_contacts)
                    
                    logger.info(f"Saved intermediate results to {temp_output_path}")
                except Exception as e:
                    logger.warning(f"Error saving intermediate results: {str(e)}")
                
        except Exception as e:
            logger.error(f"Error processing contact {contact.get('Full Name')}: {str(e)}")
            # Add the contact with error information
            contact["Email"] = None
            contact["Phone"] = None
            contact["Email Source"] = None
            contact["Confidence"] = 0
            contact["Error"] = str(e)
            enriched_contacts.append(contact)
    
    # Write the output file
    try:
        fieldnames = list(enriched_contacts[0].keys()) if enriched_contacts else []
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(enriched_contacts)
        
        # Calculate success rate
        success_rate = (found_count / total_contacts) * 100 if total_contacts > 0 else 0
        total_time = time.time() - start_time
        
        logger.info(f"Enrichment complete: {found_count}/{total_contacts} emails found ({success_rate:.1f}%)")
        logger.info(f"Total time: {total_time:.1f} seconds, Average: {total_time/total_contacts:.1f}s per contact")
        logger.info(f"Enriched data saved to {output_path}")
        
        # Clean up any partial files
        partial_path = f"{output_path}.partial"
        if os.path.exists(partial_path):
            try:
                os.remove(partial_path)
            except:
                pass
        
        return {
            "total": total_contacts,
            "success": found_count,
            "success_rate": success_rate,
            "output_path": output_path
        }
    except Exception as e:
        logger.error(f"Error writing output CSV file {output_path}: {str(e)}")
        return {
            "total": total_contacts,
            "success": found_count,
            "success_rate": (found_count / total_contacts) * 100 if total_contacts > 0 else 0,
            "error": str(e)
        }


def main():
    """Main function to run the enrichment process"""
    # Directory with CSV files - fixing the path to handle Windows paths
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../'))
    csv_dir = os.path.join(project_root, 'backend', 'csv')
    
    logger.info(f"Looking for CSV files in: {csv_dir}")
    
    # Ensure the directory exists
    if not os.path.exists(csv_dir):
        logger.error(f"Directory not found: {csv_dir}")
        # Try to create the directory
        try:
            os.makedirs(csv_dir, exist_ok=True)
            logger.info(f"Created directory: {csv_dir}")
        except Exception as e:
            logger.error(f"Failed to create directory: {e}")
        return
    
    # Get list of CSV files
    csv_files = [f for f in os.listdir(csv_dir) if f.endswith('.csv') and not f.endswith('_enriched.csv')]
    
    if not csv_files:
        logger.warning(f"No CSV files found in {csv_dir}")
        return
    
    logger.info(f"Found {len(csv_files)} CSV files to process")
    overall_start_time = time.time()
    overall_results = {}
    
    for i, csv_file in enumerate(csv_files):
        input_path = os.path.join(csv_dir, csv_file)
        logger.info(f"Starting enrichment for file {i+1}/{len(csv_files)}: {csv_file}")
        
        file_start_time = time.time()
        result = process_csv(input_path)
        file_time = time.time() - file_start_time
        
        result['processing_time'] = file_time
        overall_results[csv_file] = result
        
        logger.info(f"Completed enrichment for {csv_file} in {file_time:.1f} seconds")
        
        if "error" in result:
            logger.error(f"Error processing {csv_file}: {result['error']}")
        else:
            logger.info(f"Total contacts: {result['total']}")
            logger.info(f"Found emails: {result['success']}")
            logger.info(f"Success rate: {result['success_rate']:.1f}%")
            logger.info(f"Output saved to: {result['output_path']}")
    
    # Print overall summary
    total_contacts = sum(result.get('total', 0) for result in overall_results.values())
    total_success = sum(result.get('success', 0) for result in overall_results.values())
    overall_rate = (total_success / total_contacts) * 100 if total_contacts > 0 else 0
    total_time = time.time() - overall_start_time
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("                ENRICHMENT SUMMARY                ")
    logger.info("=" * 60)
    logger.info(f"Files processed:      {len(csv_files)}")
    logger.info(f"Total contacts:       {total_contacts}")
    logger.info(f"Emails found:         {total_success}")
    logger.info(f"Overall success rate: {overall_rate:.1f}%")
    logger.info(f"Total time:           {total_time:.1f} seconds")
    
    if total_contacts > 0:
        logger.info(f"Average per contact:   {total_time/total_contacts:.2f} seconds")
    
    logger.info("-" * 60)
    
    # Report results by service
    service_counts = {}
    for result in overall_results.values():
        if 'enriched_data' in result:
            for contact in result['enriched_data']:
                source = contact.get('Email Source')
                if source:
                    service_counts[source] = service_counts.get(source, 0) + 1
    
    if service_counts:
        logger.info("Success by service:")
        for service, count in sorted(service_counts.items(), key=lambda x: x[1], reverse=True):
            service_pct = (count / total_success) * 100 if total_success > 0 else 0
            logger.info(f"  {service}: {count} emails ({service_pct:.1f}%)")
    
    logger.info("=" * 60)
    
    return overall_results


if __name__ == "__main__":
    main() 