# backend/services/enrichment-worker/app/providers.py
import httpx
import time
import json
import random
from typing import Dict, Any, Optional

from app.config import get_settings
from app.common import logger, retry_with_backoff, RateLimiter, service_status

settings = get_settings()

# Initialize rate limiters for each service
rate_limiters = {
    name: RateLimiter(calls_per_minute=limit)
    for name, limit in settings.rate_limits.items()
}

# Add service status reset function at the top
def reset_service_availability(service_name: str):
    """Reset service availability status."""
    if hasattr(service_status, '_unavailable_until'):
        if service_name in service_status._unavailable_until:
            del service_status._unavailable_until[service_name]
            logger.info(f"Service {service_name} availability reset - ready for retry")

# --- Icypeas (0.009/mail) ---
@retry_with_backoff(max_retries=2)
def call_icypeas(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Icypeas API to enrich a contact."""
    service_name = 'icypeas'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    # Prepare headers and payload - use only API key as per working config
    headers = {
        "Authorization": settings.icypeas_api,  # Correct authentication method
        "Content-Type": "application/json"
    }
    
    # Extract first and last name
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    # If we don't have first/last name but have full_name, split it
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            if not first_name:
                first_name = name_parts[0]
            if not last_name:
                last_name = name_parts[1]
        elif len(name_parts) == 1:
            # If only one name part, use it as last name (common for API requirements)
            if not last_name:
                last_name = name_parts[0]
    
    # Ensure we have at least a last name (required by API)
    if not last_name:
        logger.warning(f"Icypeas: No last name available for contact")
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
    
    # Use the company domain if available, otherwise company name
    company_info = lead.get("company_domain", "") or lead.get("company", "")
    
    payload = {
        "firstname": first_name,  # Changed from fullname to firstname
        "lastname": last_name,    # Added lastname field
        "domainOrCompany": company_info
    }
    
    # Add LinkedIn URL if available
    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            payload["linkedin"] = linkedin_url
    
    # Log the payload for debugging
    logger.info(f"Icypeas payload: firstname={first_name}, lastname={last_name}, company={company_info}")
    
    # FIXED: Use URL from settings instead of hardcoded
    try:
        response = httpx.post(
            f"{settings.api_urls[service_name]}/email-search",  # FIXED: Use settings URL
            json=payload,
            headers=headers,
            timeout=30
        )
    except Exception as e:
        logger.error(f"Failed to connect to Icypeas: {e}")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
        
    # Check for errors
    if response.status_code == 401 or response.status_code == 403:
        logger.error("Icypeas authentication failed")
        service_status.mark_unavailable('icypeas')
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
    
    if response.status_code != 200 and response.status_code != 201:
        logger.warning(f"Icypeas API error: {response.status_code} - {response.text}")
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
    
    # Get the request ID
    data = response.json()
    request_id = data.get("item", {}).get("_id")
    
    if not request_id:
        logger.warning(f"Icypeas did not return request ID. Response: {data}")
        return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}
        
    logger.info(f"Icypeas request started with ID: {request_id}")
    
    # Poll for results - FIXED: Use settings URL for polling too
    poll_url = f"{settings.api_urls[service_name]}/bulk-single-searchs/read"  # FIXED: Use settings URL
    wait_times = [2, 3, 4, 6]  # Progressive waiting
    
    for i, wait_time in enumerate(wait_times):
        # Wait before checking results
        time.sleep(wait_time)
        
        # Make polling request
        poll_response = httpx.post(
            poll_url,
            json={"id": request_id},
            headers=headers,
            timeout=20
        )
        
        # Check for errors
        if poll_response.status_code != 200:
            logger.warning(f"Icypeas polling attempt {i+1}: HTTP {poll_response.status_code}")
            continue
        
        # Parse results
        poll_data = poll_response.json()
        items = poll_data.get("items", [])
        
        if not items:
            logger.info(f"Icypeas polling {i+1}: no items yet")
            continue
        
        item = items[0]
        status = item.get("status")
        
        # Check if results are ready
        if status not in ("DEBITED", "FREE"):
            logger.info(f"Icypeas polling {i+1}: status={status}")
            continue
        
        # Extract results
        results = item.get("results", {})
        emails = results.get("emails", [])
        phones = results.get("phones", [])
        
        # Extract the actual email string from the email object
        email = None
        phone = None
        
        if emails and len(emails) > 0:
            email_obj = emails[0]
            if isinstance(email_obj, dict):
                email = email_obj.get("email")  # Extract just the email string
            else:
                email = email_obj  # In case it's already a string
        
        if phones and len(phones) > 0:
            phone_obj = phones[0]
            if isinstance(phone_obj, dict):
                phone = phone_obj.get("phone") or phone_obj.get("number")
            else:
                phone = phone_obj
        
        if email or phone:
            logger.info(f"Icypeas found: email={email}, phone={phone}")
        
        # Return results
        return {
            "email": email,
            "phone": phone,
            "confidence": 85 if email else 0,  # Default confidence
            "source": "icypeas",
            "raw_data": results
        }
    
    # No results after polling
    logger.warning(f"Icypeas polling timeout for request ID {request_id}")
    return {"email": None, "phone": None, "confidence": 0, "source": "icypeas"}


# --- Dropcontact ---
@retry_with_backoff(max_retries=2)
def call_dropcontact(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Dropcontact API to enrich a contact."""
    service_name = 'dropcontact'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    headers = {
        "X-Access-Token": settings.dropcontact_api,
        "Content-Type": "application/json"
    }
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if not first_name and not last_name and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0]
            last_name = name_parts[1]
        elif len(name_parts) == 1:
            last_name = name_parts[0]
            
    data_item = {
        "first_name": first_name,
        "last_name": last_name,
        "company": lead.get("company", "")
    }
    
    if lead.get("profile_url") and "linkedin.com" in lead.get("profile_url", ""):
        data_item["linkedin"] = lead.get("profile_url")
    
    company_domain = lead.get("company_domain", "")
    if not company_domain and lead.get("company"):
        company_clean = lead.get("company", "").lower().strip()
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co"]:
            if company_clean.endswith(suffix):
                company_clean = company_clean[:-len(suffix)].strip()
        if company_clean:
            company_domain = f"{company_clean.replace(' ', '')}.com" # Basic domain guess
    
    if company_domain:
        data_item["website"] = company_domain
        
    payload = {"data": [data_item], "siren": True, "language": "en"}
    logger.info(f"{service_name} payload: {data_item}")

    try:
        response = httpx.post(
            f"{settings.api_urls[service_name]}/v1/enrich/all",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 401 or response.status_code == 403:
            logger.error(f"{service_name} authentication failed.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

        response.raise_for_status()
        
        data = response.json()
        request_id = data.get("request_id")
        
        if not request_id:
            # Check if data is directly in response (sync mode)
            if "data" in data and data["data"]:
                result = data["data"][0]
                email_list = result.get("email", [])
                email = email_list[0].get("email") if isinstance(email_list, list) and email_list else None
                qualification = email_list[0].get("qualification", "") if isinstance(email_list, list) and email_list else ""
                
                phone_list = result.get("phone", [])
                phone = phone_list[0].get("number") if isinstance(phone_list, list) and phone_list else None

                confidence = 0
                if "nominative@pro" in qualification: confidence = 95
                elif "pro" in qualification: confidence = 80
                elif email: confidence = 60
                
                logger.info(f"{service_name} (sync) found: email={email}, phone={phone}, confidence={confidence}")
                return {"email": email, "phone": phone, "confidence": confidence, "source": service_name, "raw_data": result}
            
            logger.warning(f"{service_name} did not return request ID and no direct data. Response: {data}")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": data}
            
        logger.info(f"{service_name} request started with ID: {request_id}")
        
        wait_times = [3, 5, 8, 12, 15]
        
        for i, wait_time in enumerate(wait_times):
            time.sleep(wait_time)
            poll_response = httpx.get(
                f"{settings.api_urls[service_name]}/v1/enrich/all/{request_id}",
                headers=headers,
                timeout=15
            )
            
            if poll_response.status_code != 200:
                logger.warning(f"{service_name} polling attempt {i+1}: HTTP {poll_response.status_code}")
                continue
            
            poll_data = poll_response.json()
            
            if poll_data.get("success") == False and "not ready yet" in poll_data.get("reason", "").lower():
                logger.info(f"{service_name} status check {i+1}: still processing")
                continue
            
            if poll_data.get("success") == True and "data" in poll_data:
                data_results = poll_data["data"]
                if data_results:
                    result = data_results[0]
                    email_data = result.get("email")
                    email = None
                    qualification = ""
                    if isinstance(email_data, list) and email_data:
                        best_email = email_data[0]
                        email = best_email.get("email")
                        qualification = best_email.get("qualification", "")
                    elif isinstance(email_data, str): # Simple string format
                        email = email_data
                    
                    phone_data = result.get("phone")
                    phone = None
                    if isinstance(phone_data, list) and phone_data:
                        phone = phone_data[0].get("number")
                    elif isinstance(phone_data, str):
                        phone = phone_data

                    confidence = 0
                    if "nominative@pro" in qualification: confidence = 95
                    elif "pro" in qualification: confidence = 80
                    elif email: confidence = 60
                    
                    if email or phone:
                        logger.info(f"{service_name} found: email={email}, phone={phone}, confidence={confidence}")
                    return {"email": email, "phone": phone, "confidence": confidence, "source": service_name, "raw_data": result}
            
            if poll_data.get("error") == True:
                logger.warning(f"{service_name} returned error: {poll_data}")
                break
        
        logger.warning(f"{service_name} polling timeout for request ID {request_id}")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")

    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


# --- Hunter ---
@retry_with_backoff(max_retries=2)
def call_hunter(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Hunter API to enrich a contact."""
    service_name = 'hunter'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name
        elif len(name_parts) == 1 and not last_name:
            last_name = name_parts[0]
            
    domain = None
    company_name_for_search = lead.get("company", "").split("(")[0].strip()

    try:
        if not lead.get("company_domain") and company_name_for_search:
            domain_response = httpx.get(
                f"{settings.api_urls[service_name]}/domain-search",
                params={"company": company_name_for_search, "api_key": settings.hunter_api},
                timeout=15
            )
            if domain_response.status_code == 401 or domain_response.status_code == 403:
                logger.error(f"{service_name} authentication failed.")
                service_status.mark_unavailable(service_name)
                return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
            elif domain_response.status_code == 429:
                logger.warning(f"{service_name} rate limit exceeded.")
                service_status.mark_unavailable(service_name) # Mark temporarily
                return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
            
            if domain_response.status_code == 200:
                domain_data = domain_response.json().get("data", {})
                domain = domain_data.get("domain")
                if domain: logger.info(f"{service_name} found domain {domain} for company {company_name_for_search}")
        else:
            domain = lead.get("company_domain")

        if not domain:
            logger.info(f"{service_name}: No domain found for {first_name} {last_name}")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

        logger.info(f"{service_name} email-finder for: first_name={first_name}, last_name={last_name}, domain={domain}")
        
        email_response = httpx.get(
            f"{settings.api_urls[service_name]}/email-finder",
            params={"domain": domain, "first_name": first_name, "last_name": last_name, "api_key": settings.hunter_api},
            timeout=15
        )

        if email_response.status_code == 429:
            logger.warning(f"{service_name} rate limit exceeded on email-finder.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
        
        email_response.raise_for_status()
        
        email_data = email_response.json().get("data", {})
        email = email_data.get("email")
        score = email_data.get("score", 0)
        
        if email: logger.info(f"{service_name} found email: {email} (score: {score})")
        
        return {"email": email, "phone": None, "confidence": score, "source": service_name, "raw_data": email_data}

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")
        
    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


# --- Apollo ---
@retry_with_backoff(max_retries=2)
def call_apollo(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Apollo API to enrich a contact."""
    service_name = 'apollo'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    # FIXED: Use correct Apollo headers from docs
    headers = {
        "x-api-key": settings.apollo_api,  # FIXED: Use x-api-key header format
        "accept": "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json"
    }
    
    # Extract name information
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    full_name = lead.get("full_name", "")
    
    # If we don't have first/last name but have full_name, split it
    if (not first_name or not last_name) and full_name:
        name_parts = full_name.split(" ", 1)
        if len(name_parts) >= 2:
            if not first_name:
                first_name = name_parts[0]
            if not last_name:
                last_name = name_parts[1]
        elif len(name_parts) == 1:
            if not last_name:
                last_name = name_parts[0]
    
    # FIXED: Build correct Apollo People Enrichment payload (POST body)
    payload = {}
    
    # Add name information (prefer first_name + last_name over full name)
    if first_name and last_name:
        payload["first_name"] = first_name
        payload["last_name"] = last_name
    elif full_name:
        payload["name"] = full_name
    
    # Add organization information
    if lead.get("company_domain"):
        payload["domain"] = lead.get("company_domain")
    elif lead.get("company"):
        payload["organization_name"] = lead.get("company")
    
    # Add LinkedIn URL if available
    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            payload["linkedin_url"] = linkedin_url
    
    # FIXED: Add enrichment parameters for emails and phones
    payload["reveal_personal_emails"] = True  # Get personal emails
    payload["reveal_phone_number"] = True    # Get phone numbers
    
    # Ensure we have minimum required information
    if not any([payload.get("first_name"), payload.get("name")]) or not any([payload.get("domain"), payload.get("organization_name")]):
        logger.warning(f"{service_name}: Missing required data (name and company info).")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
    
    logger.info(f"{service_name} payload: {payload}")

    try:
        # FIXED: Use correct Apollo People Enrichment endpoint with POST method
        response = httpx.post(
            "https://api.apollo.io/api/v1/people/match",  # FIXED: Use /people/match endpoint
            json=payload,  # FIXED: Use JSON body instead of query params
            headers=headers,
            timeout=30
        )
        
        logger.info(f"Apollo response: {response.status_code} - {response.text[:200]}")
        
        if response.status_code == 401 or response.status_code == 403:
            logger.error(f"{service_name} authentication failed.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
        
        if response.status_code == 422: # Often insufficient credits
            error_msg = response.json().get('error', '')
            if 'insufficient credits' in error_msg.lower():
                logger.warning(f"{service_name} API error: Insufficient credits.")
                service_status.mark_unavailable(service_name)
            else:
                logger.warning(f"{service_name} API error: {response.status_code} - {response.text}")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": response.json()}
        
        if response.status_code == 429:
            logger.warning(f"{service_name} rate limit exceeded.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

        response.raise_for_status()
        
        data = response.json()
        person = data.get("person", {})
        
        if not person:
            logger.info(f"{service_name}: No person data returned")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": data}
            
        # Extract email and phone from person data
        email = person.get("email")
        phone = person.get("phone_number") or person.get("phone")
        
        # Filter out placeholder/locked emails
        if email and any(lock_str in email.lower() for lock_str in ["email_not_unlocked", "not_unlocked", "@domain.com", "placeholder", "example.com"]):
            logger.info(f"{service_name} returned placeholder/locked email {email} - filtering out")
            email = None
            
        # Set confidence based on what we found
        confidence = 0
        if email and phone:
            confidence = 90  # High confidence when both found
        elif email:
            confidence = 85  # Good confidence for email only
        elif phone:
            confidence = 75  # Lower confidence for phone only
        
        if email or phone:
            logger.info(f"{service_name} SUCCESS: email={email}, phone={phone}, confidence={confidence}")
        else:
            logger.info(f"{service_name}: No email or phone found")
            
        return {
            "email": email,
            "phone": phone,
            "confidence": confidence,
            "source": service_name,
            "raw_data": person
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")

    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


# --- PDL (Mock) ---
def enrich_with_pdl(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Mock PDL enrichment that generates realistic test data."""
    service_name = "pdl"
    logger.info(f"Using mock {service_name} enrichment provider")
    
    first_name = lead.get("first_name", "Test")
    last_name = lead.get("last_name", "User")
    company_raw = lead.get("company", "company")
    company = company_raw.lower().replace(" ", "").replace("(", "").replace(")", "").replace("+1", "")
    
    if not company or company == "company":
        company = "example"
    
    email_patterns = [
        f"{first_name.lower()}.{last_name.lower()}@{company}.com",
        f"{first_name.lower()}{last_name.lower()}@{company}.com",
        f"{first_name[0].lower()}{last_name.lower()}@{company}.com",
    ]
    email = random.choice(email_patterns)
    
    phone = None
    if random.random() < 0.5: # 50% chance of phone
        phone = f"+33 {random.randint(6,7)}{''.join(random.choices('0123456789', k=8))}" # French format
        
    confidence = 0
    if email and phone: confidence = random.randint(85, 95)
    elif email: confidence = random.randint(70, 85)
    elif phone: confidence = random.randint(60, 75)
    
    logger.info(f"{service_name} Mock generated: email={email}, phone={phone}, confidence={confidence}")
    
    return {
        "email": email,
        "phone": phone,
        "confidence": confidence,
        "source": service_name,
        "email_verified": True,
        "phone_verified": phone is not None,
        "raw_data": {"likelihood": confidence, "sources": ["mock_professional_network"]}
    }

# --- Clearbit (Placeholder) ---
def enrich_with_clearbit(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Placeholder for Clearbit enrichment."""
    service_name = "clearbit"
    logger.info(f"{service_name} enrichment not implemented yet")
    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

# === NEW PROVIDERS IN PRICE ORDER ===

# --- Enrow - cheapest (0.008/mail) ---
@retry_with_backoff(max_retries=2)
def call_enrow(lead: Dict[str, Any], enrich_email: bool = True, enrich_phone: bool = True) -> Dict[str, Any]:
    """
    Call the Enrow API to enrich a contact with BOTH email AND phone when requested.
    
    🎯 FIXED: Now calls BOTH email/find/single AND phone/single endpoints
    📧 Email endpoint: https://api.enrow.io/email/find/single  
    📱 Phone endpoint: https://api.enrow.io/phone/single
    """
    service_name = 'enrow'
    
    # FIXED: Reset service status to allow retry
    if not service_status.is_available(service_name):
        reset_service_availability(service_name)
        logger.info(f"Attempting {service_name} after status reset")
    
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    # FIXED: Use exact headers from Enrow documentation
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": settings.enrow_api
    }
    
    # Get full name and prepare data
    full_name = lead.get("full_name", "")
    if not full_name:
        first_name = lead.get("first_name", "")
        last_name = lead.get("last_name", "")
        if first_name and last_name:
            full_name = f"{first_name} {last_name}".strip()
        elif first_name or last_name:
            full_name = (first_name or last_name).strip()
    
    if not full_name:
        logger.warning(f"{service_name}: No full name available for contact.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    # Base payload for both email and phone requests
    base_payload = {"fullname": full_name}
    
    # Add company info
    if lead.get("company_domain"):
        base_payload["company_domain"] = lead.get("company_domain")
    if lead.get("company"):
        base_payload["company_name"] = lead.get("company")
    
    if not base_payload.get("company_domain") and not base_payload.get("company_name"):
        logger.warning(f"{service_name}: No company information available.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    logger.info(f"{service_name} payload: {base_payload}")

    # Initialize results
    email = None
    phone = None
    email_confidence = 0
    phone_confidence = 0
    raw_data = {}

    try:
        # 🎯 STEP 1: EMAIL ENRICHMENT (if requested)
        if enrich_email:
            logger.info(f"📧 {service_name}: Starting EMAIL search...")
            
            email_response = httpx.post(
                "https://api.enrow.io/email/find/single",
                json=base_payload,
                headers=headers,
                timeout=30
            )
            
            logger.info(f"{service_name} EMAIL POST: {email_response.status_code} - {email_response.text[:200]}")
            
            if email_response.status_code == 401:
                logger.error(f"{service_name} authentication failed - check API key.")
                service_status.mark_unavailable(service_name)
                return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
            
            if email_response.status_code == 200:
                email_data = email_response.json()
                email_search_id = email_data.get("id")
                
                if email_search_id:
                    logger.info(f"{service_name} email search started with ID: {email_search_id}")
                    
                    # Poll for email results
                    for i in range(5):  # Try 5 times
                        time.sleep(2 + i)  # Progressive waiting
                        
                        email_poll = httpx.get(
                            f"https://api.enrow.io/email/find/single?id={email_search_id}",
                            headers={"accept": "application/json", "x-api-key": settings.enrow_api},
                            timeout=20
                        )
                        
                        logger.info(f"{service_name} EMAIL GET attempt {i+1}: {email_poll.status_code} - {email_poll.text[:200]}")
                        
                        if email_poll.status_code == 200:
                            email_result = email_poll.json()
                            email = email_result.get("email")
                            
                            if email:
                                qualification = email_result.get("qualification", "")
                                if qualification == "valid":
                                    email_confidence = 95
                                elif qualification == "catch_all":
                                    email_confidence = 75
                                else:
                                    email_confidence = 85
                                
                                logger.info(f"{service_name} EMAIL SUCCESS: {email} (confidence: {email_confidence})")
                                raw_data["email_data"] = email_result
                                break
                        elif email_poll.status_code == 202:
                            logger.info(f"{service_name} email polling {i+1}: still processing")
                            continue
                        else:
                            break

        # 🎯 STEP 2: PHONE ENRICHMENT (if requested) 
        if enrich_phone:
            logger.info(f"📱 {service_name}: Starting PHONE search...")
            
            # Use LinkedIn URL if available (required for phone)
            phone_payload = base_payload.copy()
            if lead.get("profile_url") and "linkedin.com" in lead.get("profile_url", ""):
                phone_payload["linkedin_url"] = lead.get("profile_url")
            
            phone_response = httpx.post(
                "https://api.enrow.io/phone/single",  # 🎯 PHONE endpoint!
                json=phone_payload,
                headers=headers,
                timeout=30
            )
            
            logger.info(f"{service_name} PHONE POST: {phone_response.status_code} - {phone_response.text[:200]}")
            
            if phone_response.status_code == 200:
                phone_data = phone_response.json()
                phone_search_id = phone_data.get("id")
                
                if phone_search_id:
                    logger.info(f"{service_name} phone search started with ID: {phone_search_id}")
                    
                    # Poll for phone results
                    for i in range(5):  # Try 5 times
                        time.sleep(2 + i)  # Progressive waiting
                        
                        phone_poll = httpx.get(
                            f"https://api.enrow.io/phone/single?id={phone_search_id}",
                            headers={"accept": "application/json", "x-api-key": settings.enrow_api},
                            timeout=20
                        )
                        
                        logger.info(f"{service_name} PHONE GET attempt {i+1}: {phone_poll.status_code} - {phone_poll.text[:200]}")
                        
                        if phone_poll.status_code == 200:
                            phone_result = phone_poll.json()
                            phone = phone_result.get("phone")
                            
                            if phone:
                                phone_confidence = 85  # Default confidence for phones
                                logger.info(f"{service_name} PHONE SUCCESS: {phone} (confidence: {phone_confidence})")
                                raw_data["phone_data"] = phone_result
                                break
                        elif phone_poll.status_code == 202:
                            logger.info(f"{service_name} phone polling {i+1}: still processing")
                            continue
                        else:
                            break

        # Calculate overall confidence
        overall_confidence = max(email_confidence, phone_confidence)
        
        if email or phone:
            logger.info(f"✅ {service_name} COMBINED SUCCESS: email={email}, phone={phone}, confidence={overall_confidence}")
        else:
            logger.info(f"❌ {service_name}: No results found")
        
        return {
            "email": email,
            "phone": phone,
            "confidence": overall_confidence,
            "source": service_name,
            "raw_data": raw_data
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
        if e.response.status_code in [401, 403, 429]:
            service_status.mark_unavailable(service_name)
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")

    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


# --- Datagma (0.016/mail) ---
@retry_with_backoff(max_retries=2)
def call_datagma(lead: Dict[str, Any], enrich_email: bool = True, enrich_phone: bool = True) -> Dict[str, Any]:
    """
    Call the Datagma API to enrich a contact with BOTH email AND phone when requested.
    
    🎯 FIXED: Now uses BOTH email and phone search endpoints
    📧 Email: https://gateway.datagma.net/api/ingress/v8/findEmail
    📱 Phone: https://gateway.datagma.net/api/ingress/v1/search (phone search)
    """
    service_name = 'datagma'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    # Extract required data
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    full_name = lead.get("full_name", "")
    
    # If we don't have first/last name but have full_name, split it
    if (not first_name or not last_name) and full_name:
        name_parts = full_name.split(" ", 1)
        if len(name_parts) >= 2:
            if not first_name:
                first_name = name_parts[0]
            if not last_name:
                last_name = name_parts[1]
        elif len(name_parts) == 1:
            if not last_name:
                last_name = name_parts[0]
    
    # Create full_name if not available
    if not full_name and (first_name or last_name):
        full_name = f"{first_name} {last_name}".strip()
    
    # Get company information
    company = lead.get("company", "")
    company_domain = lead.get("company_domain", "")
    
    if not full_name or not (company or company_domain):
        logger.warning(f"{service_name}: Missing required data (full_name and company).")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    # Initialize results
    email = None
    phone = None
    email_confidence = 0
    phone_confidence = 0
    raw_data = {}

    try:
        # 🎯 STEP 1: EMAIL ENRICHMENT (if requested)
        if enrich_email:
            logger.info(f"📧 {service_name}: Starting EMAIL search...")
            
            email_params = {
                "apiId": settings.datagma_api,
                "fullName": full_name,
                "company": company_domain if company_domain else company
            }
            
            if first_name:
                email_params["firstName"] = first_name
            if last_name:
                email_params["lastName"] = last_name

            email_response = httpx.get(
                "https://gateway.datagma.net/api/ingress/v8/findEmail",
                params=email_params,
                headers={"accept": "application/json"},
                timeout=30
            )
            
            logger.info(f"{service_name} EMAIL response: {email_response.status_code} - {email_response.text[:200]}")
            
            if email_response.status_code == 401 or email_response.status_code == 403:
                logger.error(f"{service_name} authentication failed.")
                service_status.mark_unavailable(service_name)
                return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
            
            if email_response.status_code == 200:
                email_data = email_response.json()
                
                # Extract email from Datagma response
                if email_data.get("emailOutput"):
                    email = email_data.get("emailOutput")
                    email_confidence = 90  # High confidence for verified emails
                    logger.info(f"{service_name} EMAIL SUCCESS: {email} (verified)")
                elif email_data.get("mostProbableEmailOutput"):
                    email = email_data.get("mostProbableEmailOutput")
                    email_confidence = 60  # Lower confidence for probable emails
                    logger.info(f"{service_name} EMAIL SUCCESS: {email} (probable)")
                elif email_data.get("email"):
                    email = email_data.get("email")
                    email_confidence = 75
                
                if email:
                    raw_data["email_data"] = email_data

        # 🎯 STEP 2: PHONE ENRICHMENT (if requested)
        if enrich_phone:
            logger.info(f"📱 {service_name}: Starting PHONE search...")
            
            # Use the phone search endpoint with username/email for better results
            phone_params = {
                "apiId": settings.datagma_api,
                "minimumMatch": 1,  # Standard match level
                "whatsapp_check": True  # Check if mobile is WhatsApp
            }
            
            # Add username (LinkedIn URL if available)
            if lead.get("profile_url") and "linkedin.com" in lead.get("profile_url", ""):
                phone_params["username"] = lead.get("profile_url")
            
            # Add email if we found one or already have one
            if email or lead.get("email"):
                phone_params["email"] = email or lead.get("email")
            
            # Only proceed if we have a username or email for phone search
            if phone_params.get("username") or phone_params.get("email"):
                phone_response = httpx.get(
                    "https://gateway.datagma.net/api/ingress/v1/search",  # 🎯 Phone search endpoint
                    params=phone_params,
                    headers={"accept": "application/json"},
                    timeout=30
                )
                
                logger.info(f"{service_name} PHONE response: {phone_response.status_code} - {phone_response.text[:200]}")
                
                if phone_response.status_code == 200:
                    phone_data = phone_response.json()
                    
                    # Extract phone from response
                    phones = phone_data.get("phones", [])
                    if phones and len(phones) > 0:
                        phone_obj = phones[0]
                        if isinstance(phone_obj, dict):
                            phone = phone_obj.get("phone") or phone_obj.get("number")
                        else:
                            phone = phone_obj
                        
                        if phone:
                            phone_confidence = 80  # Good confidence for Datagma phone
                            logger.info(f"{service_name} PHONE SUCCESS: {phone} (confidence: {phone_confidence})")
                            raw_data["phone_data"] = phone_data
            else:
                logger.info(f"{service_name}: Skipping phone search - need LinkedIn URL or email")

        # Calculate overall confidence
        overall_confidence = max(email_confidence, phone_confidence)
        
        if email or phone:
            logger.info(f"✅ {service_name} COMBINED SUCCESS: email={email}, phone={phone}, confidence={overall_confidence}")
        else:
            logger.info(f"❌ {service_name}: No results found")

        return {
            "email": email,
            "phone": phone,
            "confidence": overall_confidence,
            "source": service_name,
            "raw_data": raw_data
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")

    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


# --- Anymailfinder (0.021/mail) ---
@retry_with_backoff(max_retries=2)
def call_anymailfinder(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Anymailfinder API to enrich a contact."""
    service_name = 'anymailfinder'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    # FIXED: Use correct Anymailfinder headers from v5.0 docs
    headers = {
        "Authorization": f"Bearer {settings.anymailfinder_api}",  # FIXED: Use Bearer authentication
        "Content-Type": "application/json"
    }
    
    # Extract required data
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    full_name = lead.get("full_name", "")
    
    # If we don't have first/last name but have full_name, split it
    if (not first_name or not last_name) and full_name:
        name_parts = full_name.split(" ", 1)
        if len(name_parts) >= 2:
            if not first_name:
                first_name = name_parts[0]
            if not last_name:
                last_name = name_parts[1]
        elif len(name_parts) == 1:
            if not last_name:
                last_name = name_parts[0]
    
    # Create full_name if not available
    if not full_name and (first_name or last_name):
        full_name = f"{first_name} {last_name}".strip()
    
    # Get domain
    domain = lead.get("company_domain", "")
    company_name = lead.get("company", "")
    
    # Create domain from company name if needed
    if not domain and company_name:
        company = company_name.lower().strip()
        # Clean up common business suffixes
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co", " sa", " sas", " limited"]:
            if company.endswith(suffix):
                company = company[:-len(suffix)].strip()
        if company:
            domain = f"{company.replace(' ', '').replace('-', '').replace('_', '')}.com"
    
    # FIXED: Build correct Anymailfinder v5.0 payload (JSON body)
    payload = {}
    
    # Add name information (prefer first_name + last_name over full_name per docs)
    if first_name and last_name:
        payload["first_name"] = first_name
        payload["last_name"] = last_name
    elif full_name:
        payload["full_name"] = full_name
    
    # Add company information (domain is preferred per docs)
    if domain:
        payload["domain"] = domain
    elif company_name:
        payload["company_name"] = company_name
    
    # Validate required fields per API docs
    has_name = payload.get("full_name") or (payload.get("first_name") and payload.get("last_name"))
    has_company = payload.get("domain") or payload.get("company_name")
    
    if not has_name or not has_company:
        logger.warning(f"{service_name}: Missing required data (name and company info).")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    logger.info(f"{service_name} payload: {payload}")

    try:
        # FIXED: Use correct Anymailfinder v5.0 endpoint with POST method
        response = httpx.post(
            "https://api.anymailfinder.com/v5.0/search/person.json",  # FIXED: Use v5.0 endpoint
            json=payload,  # FIXED: Use JSON body instead of query params
            headers=headers,
            timeout=180  # FIXED: Use recommended 180s timeout
        )
        
        logger.info(f"Anymailfinder response: {response.status_code} - {response.text[:200]}")
        
        if response.status_code == 401:
            logger.error(f"{service_name} authentication failed.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
        
        if response.status_code == 402:
            logger.warning(f"{service_name} insufficient credits.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
        
        if response.status_code == 400:
            error_data = response.json() if response.text else {}
            logger.error(f"{service_name} bad request: {error_data.get('error_explained', 'Invalid parameters')}")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": error_data}
        
        if response.status_code == 404 or response.status_code == 451:
            logger.info(f"{service_name}: Email not found")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

        response.raise_for_status()
        
        # Parse the response based on v5.0 API format
        data = response.json()
        results = data.get("results", {})
        
        email = results.get("email")
        validation = results.get("validation", "")
        
        # Set confidence based on validation status
        confidence = 0
        if email:
            if validation == "valid":
                confidence = 95  # High confidence for validated emails
            elif validation == "risky":
                confidence = 60  # Lower confidence for risky emails
            elif validation == "invalid":
                confidence = 0   # Don't use invalid emails
                email = None     # Filter out invalid emails
            else:
                confidence = 75  # Default confidence
        
        if email:
            logger.info(f"{service_name} SUCCESS: email={email}, validation={validation}, confidence={confidence}")
        else:
            logger.info(f"{service_name}: No email found or email invalid")
        
        return {
            "email": email,
            "phone": None,  # Anymailfinder focuses on email
            "confidence": confidence,
            "source": service_name,
            "raw_data": data
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")

    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


# --- Snov.io (0.024/mail) ---
@retry_with_backoff(max_retries=2)
def call_snov(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Snov.io API to enrich a contact."""
    service_name = 'snov'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    # First, get OAuth access token
    access_token = get_snov_access_token()
    if not access_token:
        logger.error(f"{service_name} failed to get access token.")
        service_status.mark_unavailable(service_name)
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name

    if not first_name or not last_name:
        logger.warning(f"{service_name}: Need both first and last name for search.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    company_domain = lead.get("company_domain", "")
    if not company_domain and lead.get("company"):
        company_clean = lead.get("company", "").lower().strip()
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co"]:
            if company_clean.endswith(suffix):
                company_clean = company_clean[:-len(suffix)].strip()
        if company_clean:
            company_domain = f"{company_clean.replace(' ', '')}.com"

    if not company_domain:
        logger.warning(f"{service_name}: No domain available for search.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    # Use current Snov.io API v2 format
    payload = {
        "rows": [
            {
                "first_name": first_name,
                "last_name": last_name,
                "domain": company_domain
            }
        ]
    }

    logger.info(f"{service_name} payload: {payload}")

    try:
        # Step 1: Start the async search
        response = httpx.post(
            f"{settings.api_urls[service_name]}/v2/emails-by-domain-by-name/start",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 401 or response.status_code == 403:
            logger.error(f"{service_name} authentication failed.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

        response.raise_for_status()
        
        start_data = response.json()
        task_hash = start_data.get("data", {}).get("task_hash")
        
        if not task_hash:
            logger.warning(f"{service_name} did not return task_hash. Response: {start_data}")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": start_data}
            
        logger.info(f"{service_name} search started with task_hash: {task_hash}")
        
        # Step 2: Poll for results
        wait_times = [3, 5, 8, 12, 20]
        
        for i, wait_time in enumerate(wait_times):
            time.sleep(wait_time)
            
            poll_response = httpx.get(
                f"{settings.api_urls[service_name]}/v2/emails-by-domain-by-name/result",
                params={"task_hash": task_hash},
                headers=headers,
                timeout=20
            )
            
            if poll_response.status_code != 200:
                logger.warning(f"{service_name} polling attempt {i+1}: HTTP {poll_response.status_code}")
                continue
            
            poll_data = poll_response.json()
            status = poll_data.get("status")
            
            if status == "in_progress":
                logger.info(f"{service_name} polling {i+1}: still in progress")
                continue
            elif status == "completed":
                data_results = poll_data.get("data", [])
                if data_results:
                    result = data_results[0]
                    result_list = result.get("result", [])
                    
                    if result_list:
                        email_result = result_list[0]
                        email = email_result.get("email")
                        smtp_status = email_result.get("smtp_status", "")
                        
                        # Map SMTP status to confidence
                        confidence_score = 0
                        if email:
                            if smtp_status == "valid":
                                confidence_score = 90
                            elif smtp_status == "unknown":
                                confidence_score = 60
                            else:
                                confidence_score = 75
                        
                        if email:
                            logger.info(f"{service_name} found: email={email}, smtp_status={smtp_status}, confidence={confidence_score}")
                        
                        return {
                            "email": email,
                            "phone": None,
                            "confidence": confidence_score,
                            "source": service_name,
                            "raw_data": poll_data
                        }
                
                logger.info(f"{service_name}: No results found")
                return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": poll_data}
            else:
                logger.warning(f"{service_name} unexpected status: {status}")
                break
        
        logger.warning(f"{service_name} polling timeout for task_hash {task_hash}")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")

    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


def get_snov_access_token() -> str:
    """Get OAuth access token for Snov.io API."""
    try:
        params = {
            'grant_type': 'client_credentials',
            'client_id': settings.snov_client_id,
            'client_secret': settings.snov_client_secret
        }
        
        response = httpx.post(
            f"{settings.api_urls['snov']}/v1/oauth/access_token",
            data=params,
            timeout=15
        )
        
        response.raise_for_status()
        token_data = response.json()
        return token_data.get('access_token', '')
        
    except Exception as e:
        logger.error(f"Failed to get Snov.io access token: {e}")
        return ""


# --- Findymail (0.024/mail) ---
@retry_with_backoff(max_retries=2)
def call_findymail(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Findymail API to enrich a contact."""
    service_name = 'findymail'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    headers = {
        "X-API-Key": settings.findymail_api,  # FIXED: Use X-API-Key format
        "Content-Type": "application/json"
    }
    
    # Extract required data
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    # If we don't have first/last name but have full_name, split it
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            if not first_name:
                first_name = name_parts[0]
            if not last_name:
                last_name = name_parts[1]
        elif len(name_parts) == 1:
            if not last_name:
                last_name = name_parts[0]
    
    # Get domain
    domain = lead.get("company_domain", "")
    if not domain and lead.get("company"):
        # Try to create domain from company name
        company = lead.get("company", "").lower().strip()
        company = company.replace(" ", "").replace("(", "").replace(")", "").replace("+", "").replace("1", "")
        if company:
            domain = f"{company}.com"
    
    if not domain or not last_name:
        logger.warning(f"{service_name}: Missing domain or last name for contact.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    # FIXED: Use correct Findymail payload format
    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "domain": domain
    }

    logger.info(f"{service_name} payload: {payload}")

    try:
        # FIXED: Use GET method instead of POST based on most email finder APIs
        response = httpx.get(
            f"{settings.api_urls[service_name]}/v1/email/find",  # FIXED: correct endpoint
            params=payload,  # FIXED: Use params for GET request
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 401 or response.status_code == 403:
            logger.error(f"{service_name} authentication failed.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
        
        if response.status_code == 405:
            logger.error(f"{service_name} method not allowed - trying POST instead.")
            # Try POST as backup
            response = httpx.post(
                f"{settings.api_urls[service_name]}/v1/email/find",
                json=payload,
                headers=headers,
                timeout=30
            )

        response.raise_for_status()
        
        data = response.json()
        
        # Extract email from response
        email = None
        confidence = 0
        
        if data.get("status") == "found" or data.get("found"):
            email = data.get("email")
            confidence_score = data.get("confidence", 0)
        
        if email:
                confidence = min(max(confidence_score, 60), 95)  # Map to 60-95 range
                logger.info(f"{service_name} found: email={email}, confidence={confidence}")
        
        return {
            "email": email,
            "phone": None,  # Findymail focuses on email
            "confidence": confidence,
            "source": service_name,
            "raw_data": data
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")

    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


# --- Kaspr - most expensive (0.071/mail) ---
@retry_with_backoff(max_retries=2)
def call_kaspr(lead: Dict[str, Any], enrich_email: bool = True, enrich_phone: bool = True) -> Dict[str, Any]:
    """
    Call the Kaspr API to enrich a contact with BOTH email AND phone when requested.
    
    🎯 FIXED: Now properly requests phones using isPhoneRequired parameter
    📧📱 Endpoint: https://api.developers.kaspr.io/profile/linkedin
    
    PRODUCTION-READY KASPR API IMPLEMENTATION
    ========================================
    - Uses Bearer token authentication as per official docs
    - Supports both email and phone enrichment via isPhoneRequired
    - Tracks rate limits and credits via response headers
    - Only works with LinkedIn URLs (API requirement)
    """
    service_name = 'kaspr'
    if not service_status.is_available(service_name):
        logger.warning(f"⚠️ {service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    # FIXED: Use Bearer authentication as per official Kaspr docs
    headers = {
        "authorization": settings.kaspr_api,  # 🎯 FIXED: Use provided format from user
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    # Extract name information
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    # Split full_name if needed
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name

    # Create full name
    full_name = f"{first_name} {last_name}".strip() if first_name and last_name else lead.get("full_name", "")

    # LinkedIn URL is REQUIRED for Kaspr API
    linkedin_url = lead.get("profile_url", "")
    if not linkedin_url or "linkedin.com" not in linkedin_url:
        logger.warning(f"🚫 {service_name}: LinkedIn URL required but not provided. Skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {"error": "linkedin_required"}}

    # Extract LinkedIn ID from URL
    linkedin_id = None
    if "/in/" in linkedin_url:
        try:
            linkedin_id = linkedin_url.split("/in/")[1].split("/")[0].split("?")[0]
        except:
            logger.warning(f"⚠️ {service_name}: Could not extract LinkedIn ID from URL: {linkedin_url}")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {"error": "invalid_linkedin_url"}}

    # 🎯 FIXED: Use correct Kaspr API payload format with isPhoneRequired
    payload = {
        "id": linkedin_id,  # LinkedIn ID as per docs
        "name": full_name,  # Full name as per docs
        "isPhoneRequired": enrich_phone  # 🎯 KEY FIX: Request phone numbers!
    }

    logger.info(f"🔍 {service_name} payload: id={linkedin_id}, name={full_name}, isPhoneRequired={enrich_phone}")

    try:
        # 🎯 FIXED: Use correct Kaspr API endpoint from user documentation
        response = httpx.post(
            "https://api.developers.kaspr.io/profile/linkedin",  # 🎯 CORRECT endpoint
            json=payload,
            headers=headers,
            timeout=30
        )
        
        # Log rate limit and credit information from headers
        if hasattr(response, 'headers'):
            daily_remaining = response.headers.get('X-Daily-RateLimit-Remaining', 'unknown')
            hourly_remaining = response.headers.get('X-Hourly-RateLimit-Remaining', 'unknown')
            work_email_credits = response.headers.get('Remaining-Work-Email-Credits', 'unknown')
            phone_credits = response.headers.get('Remaining-Phone-Credits', 'unknown')
            export_credits = response.headers.get('Remaining-Export-Credits', 'unknown')
            
            logger.info(f"📊 {service_name} limits: Daily={daily_remaining}, Hourly={hourly_remaining}")
            logger.info(f"💳 {service_name} credits: Email={work_email_credits}, Phone={phone_credits}, Export={export_credits}")
        
        logger.info(f"{service_name} response: {response.status_code} - {response.text[:300]}")
        
        # Handle authentication errors
        if response.status_code == 401 or response.status_code == 403:
            logger.error(f"🚫 {service_name} authentication failed.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {"error": "auth_failed"}}

        # Handle rate limit exceeded
        if response.status_code == 429:
            logger.warning(f"⏱️ {service_name} rate limit exceeded - marking temporarily unavailable")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {"error": "rate_limited"}}

        # Handle payment required
        if response.status_code == 402:
            logger.warning(f"💳 {service_name} insufficient credits - marking temporarily unavailable")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {"error": "insufficient_credits"}}

        response.raise_for_status()
        
        # Parse response according to Kaspr API docs
        data = response.json()
        
        # Extract contact information from profile data
        email = None
        phone = None
        confidence_score = 0
        
        # Get profile data (as per Kaspr docs structure)
        profile_data = data.get("profile", {})
        
        if profile_data:
            # Extract emails
            if enrich_email:
                # Try different email fields as per Kaspr docs
                email = (profile_data.get("professionalEmail") or 
                        profile_data.get("personalEmail") or
                        (profile_data.get("emails", [{}])[0].get("email") if profile_data.get("emails") else None))
            
            # Extract phone
            if enrich_phone:
                # Try different phone fields as per Kaspr docs
                phone = (profile_data.get("phone") or 
                        profile_data.get("starryPhone") or
                        (profile_data.get("phones", [])[0] if profile_data.get("phones") else None))
        
        # Fallback: check top-level data
        if not email and enrich_email:
            email = data.get("email")
        if not phone and enrich_phone:
            phone = data.get("phone")
        
        # Calculate confidence based on results found
        if email and phone:
            confidence_score = 95  # High confidence when both found
            logger.info(f"✅ {service_name} BOTH found: email={email}, phone={phone}")
        elif email:
            confidence_score = 85  # Good confidence for email only
            logger.info(f"✅ {service_name} EMAIL found: {email}")
        elif phone:
            confidence_score = 80  # Good confidence for phone only
            logger.info(f"✅ {service_name} PHONE found: {phone}")
        else:
            logger.info(f"❌ {service_name}: No contact info found for LinkedIn ID {linkedin_id}")
        
        # Clean up phone format if found
        if phone:
            phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
            if not phone.startswith("+"):
                phone = f"+{phone}" if phone.isdigit() else phone
        
        return {
            "email": email,
            "phone": phone,
            "confidence": confidence_score,
            "source": service_name,
            "cost": 0.071,  # Kaspr cost per successful request
            "raw_data": data
        }

    except httpx.HTTPStatusError as e:
        error_detail = ""
        try:
            error_data = e.response.json()
            error_detail = error_data.get("message", error_data.get("error", ""))
        except:
            error_detail = e.response.text[:100]
            
        logger.error(f"❌ HTTP error calling {service_name}: {e.response.status_code} - {error_detail}")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {"error": f"http_{e.response.status_code}"}}
        
    except httpx.RequestError as e:
        logger.error(f"❌ Request error calling {service_name}: {e}")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {"error": "request_failed"}}
        
    except Exception as e:
        logger.error(f"❌ Unexpected error in {service_name}: {e}")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {"error": "unexpected_error"}}


# Mapping of service names to functions
PROVIDER_FUNCTIONS = {
    "enrow": call_enrow,           # 1st - cheapest
    "icypeas": call_icypeas,       # 2nd
    "apollo": call_apollo,         # 3rd
    "datagma": call_datagma,       # 4th
    "anymailfinder": call_anymailfinder,  # 5th
    "snov": call_snov,             # 6th
    "findymail": call_findymail,   # 7th
    "dropcontact": call_dropcontact,  # 8th
    "hunter": call_hunter,         # 9th
    "kaspr": call_kaspr,           # 10th - most expensive
    "pdl": enrich_with_pdl,
    "clearbit": enrich_with_clearbit,
}