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

# --- Icypeas ---
@retry_with_backoff(max_retries=2)
def call_icypeas(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Icypeas API to enrich a contact."""
    service_name = 'icypeas'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    headers = {
        "Authorization": settings.icypeas_api,
        "Content-Type": "application/json"
    }
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name
        elif len(name_parts) == 1 and not last_name:
            last_name = name_parts[0]
    
    if not last_name: # Icypeas requires last name
        logger.warning(f"{service_name}: No last name for contact.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    company_info = lead.get("company_domain", "") or lead.get("company", "")
    
    payload = {
        "firstname": first_name,
        "lastname": last_name,
        "domainOrCompany": company_info
    }
    
    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            payload["linkedin"] = linkedin_url
    
    logger.info(f"{service_name} payload: {payload}")
    
    try:
        response = httpx.post(
            f"{settings.api_urls[service_name]}/email-search",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 401 or response.status_code == 403:
            logger.error(f"{service_name} authentication failed.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}
        
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        
        data = response.json()
        request_id = data.get("item", {}).get("_id")
        
        if not request_id:
            logger.warning(f"{service_name} did not return request ID. Response: {data}")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": data}
            
        logger.info(f"{service_name} request started with ID: {request_id}")
        
        poll_url = f"{settings.api_urls[service_name]}/bulk-single-searchs/read"
        wait_times = [3, 5, 8, 12, 20, 30]
        
        for i, wait_time in enumerate(wait_times):
            time.sleep(wait_time)
            poll_response = httpx.post(
                poll_url,
                json={"id": request_id},
                headers=headers,
                timeout=20
            )
            
            if poll_response.status_code != 200:
                logger.warning(f"{service_name} polling attempt {i+1}: HTTP {poll_response.status_code}")
                continue
            
            poll_data = poll_response.json()
            items = poll_data.get("items", [])
            
            if not items:
                logger.info(f"{service_name} polling {i+1}: no items yet")
                continue
            
            item = items[0]
            status = item.get("status")
            
            if status not in ("DEBITED", "FREE"):
                logger.info(f"{service_name} polling {i+1}: status={status}")
                continue
            
            results_data = item.get("results", {})
            emails_list = results_data.get("emails", [])
            phones_list = results_data.get("phones", [])
            
            email = None
            phone = None
            
            if emails_list:
                email_obj = emails_list[0]
                email = email_obj.get("email") if isinstance(email_obj, dict) else email_obj
            
            if phones_list:
                phone_obj = phones_list[0]
                phone = phone_obj.get("phone") or phone_obj.get("number") if isinstance(phone_obj, dict) else phone_obj
            
            if email or phone:
                logger.info(f"{service_name} found: email={email}, phone={phone}")
            
            return {
                "email": email,
                "phone": phone,
                "confidence": 85 if email else 0,
                "source": service_name,
                "raw_data": results_data
            }
        
        logger.warning(f"{service_name} polling timeout for request ID {request_id}")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")
    
    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


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
    
    name_to_use = lead.get("full_name", "")
    if not name_to_use:
        name_to_use = f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip()
    
    params = {
        "q_organization_domains": lead.get("company_domain", ""),
        "q_names": name_to_use,
    }
    
    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            params["contact_linkedin_url"] = linkedin_url
            
    logger.info(f"{service_name} payload: name={name_to_use}, company_domain={lead.get('company_domain', '')}")
    
    headers = {"X-Api-Key": settings.apollo_api, "Content-Type": "application/json"}

    try:
        response = httpx.get(
            f"{settings.api_urls[service_name]}/people/search",
            params=params,
            headers=headers,
            timeout=20
        )
        
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

        response.raise_for_status()
        
        data = response.json()
        people = data.get("people", [])
        
        if not people:
            logger.info(f"{service_name}: No results for {name_to_use}")
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": data}
            
        person = people[0]
        email = person.get("email")
        phone = person.get("phone_number")
        
        if email and any(lock_str in email.lower() for lock_str in ["email_not_unlocked", "not_unlocked", "@domain.com", "placeholder"]):
            logger.info(f"{service_name} returned placeholder/locked email {email} - filtering out")
            email = None
            
        return {"email": email, "phone": phone, "confidence": 85 if email else 0, "source": service_name, "raw_data": person}

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
def call_enrow(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Enrow API to enrich a contact."""
    service_name = 'enrow'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    headers = {
        "Authorization": f"Bearer {settings.enrow_api}",
        "Content-Type": "application/json"
    }
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name
        elif len(name_parts) == 1 and not last_name:
            last_name = name_parts[0]

    company_domain = lead.get("company_domain", "")
    if not company_domain and lead.get("company"):
        company_clean = lead.get("company", "").lower().strip()
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co"]:
            if company_clean.endswith(suffix):
                company_clean = company_clean[:-len(suffix)].strip()
        if company_clean:
            company_domain = f"{company_clean.replace(' ', '')}.com"

    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "domain": company_domain,
        "company": lead.get("company", "")
    }

    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            payload["linkedin_url"] = linkedin_url

    logger.info(f"{service_name} payload: {payload}")

    try:
        response = httpx.post(
            f"{settings.api_urls[service_name]}/find-email",
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
        email = data.get("email")
        confidence_score = data.get("confidence", 0)
        phone = data.get("phone")  # If available
        
        if email:
            logger.info(f"{service_name} found: email={email}, confidence={confidence_score}")
        
        return {
            "email": email,
            "phone": phone,
            "confidence": confidence_score,
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


# --- Datagma (0.016/mail) ---
@retry_with_backoff(max_retries=2)
def call_datagma(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Datagma API to enrich a contact."""
    service_name = 'datagma'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    headers = {
        "X-API-Key": settings.datagma_api,
        "Content-Type": "application/json"
    }
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name

    payload = {
        "firstName": first_name,
        "lastName": last_name,
        "company": lead.get("company", ""),
        "domain": lead.get("company_domain", "")
    }

    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            payload["linkedInUrl"] = linkedin_url

    logger.info(f"{service_name} payload: {payload}")

    try:
        response = httpx.post(
            f"{settings.api_urls[service_name]}/contacts/enrich",
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
        contact_data = data.get("contact", {})
        email = contact_data.get("email")
        phone = contact_data.get("phone")
        confidence_score = data.get("confidence", 75) if email else 0
        
        if email:
            logger.info(f"{service_name} found: email={email}, phone={phone}")
        
        return {
            "email": email,
            "phone": phone,
            "confidence": confidence_score,
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


# --- Anymailfinder (0.021/mail) ---
@retry_with_backoff(max_retries=2)
def call_anymailfinder(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Anymailfinder API to enrich a contact."""
    service_name = 'anymailfinder'
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

    company_domain = lead.get("company_domain", "")
    if not company_domain and lead.get("company"):
        company_clean = lead.get("company", "").lower().strip()
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co"]:
            if company_clean.endswith(suffix):
                company_clean = company_clean[:-len(suffix)].strip()
        if company_clean:
            company_domain = f"{company_clean.replace(' ', '')}.com"

    if not company_domain:
        logger.warning(f"{service_name}: No domain for contact.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    params = {
        "apikey": settings.anymailfinder_api,
        "first_name": first_name,
        "last_name": last_name,
        "domain": company_domain
    }

    logger.info(f"{service_name} params: {params}")

    try:
        response = httpx.get(
            f"{settings.api_urls[service_name]}/find-email",
            params=params,
            timeout=30
        )
        
        if response.status_code == 401 or response.status_code == 403:
            logger.error(f"{service_name} authentication failed.")
            service_status.mark_unavailable(service_name)
            return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

        response.raise_for_status()
        
        data = response.json()
        email = data.get("email")
        confidence_score = data.get("confidence", 75) if email else 0
        
        if email:
            logger.info(f"{service_name} found: email={email}")
        
        return {
            "email": email,
            "phone": None,  # Anymailfinder typically doesn't return phone
            "confidence": confidence_score,
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
    
    headers = {
        "Content-Type": "application/json"
    }
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name

    company_domain = lead.get("company_domain", "")
    if not company_domain and lead.get("company"):
        company_clean = lead.get("company", "").lower().strip()
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co"]:
            if company_clean.endswith(suffix):
                company_clean = company_clean[:-len(suffix)].strip()
        if company_clean:
            company_domain = f"{company_clean.replace(' ', '')}.com"

    payload = {
        "user_id": settings.snov_api_id,
        "secret": settings.snov_api_secret,
        "firstName": first_name,
        "lastName": last_name,
        "domain": company_domain
    }

    logger.info(f"{service_name} payload: {payload}")

    try:
        response = httpx.post(
            f"{settings.api_urls[service_name]}/v1/get-emails-from-names",
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
        success = data.get("success", False)
        
        if success and data.get("data"):
            emails = data["data"].get("emails", [])
            if emails:
                best_email = emails[0]
                email = best_email.get("email")
                confidence_score = best_email.get("probability", 75)
                
                if email:
                    logger.info(f"{service_name} found: email={email}, confidence={confidence_score}")
                
                return {
                    "email": email,
                    "phone": None,
                    "confidence": confidence_score,
                    "source": service_name,
                    "raw_data": data
                }
        
        logger.info(f"{service_name}: No results found")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": data}

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {service_name}: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"Request error calling {service_name}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in {service_name}: {e}")

    return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}


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
        "Authorization": f"Bearer {settings.findymail_api}",
        "Content-Type": "application/json"
    }
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name

    company_domain = lead.get("company_domain", "")
    if not company_domain and lead.get("company"):
        company_clean = lead.get("company", "").lower().strip()
        for suffix in [" inc", " ltd", " llc", " corp", " corporation", " company", " co"]:
            if company_clean.endswith(suffix):
                company_clean = company_clean[:-len(suffix)].strip()
        if company_clean:
            company_domain = f"{company_clean.replace(' ', '')}.com"

    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "domain": company_domain
    }

    if linkedin_url := lead.get("profile_url", ""):
        if "linkedin.com" in linkedin_url:
            payload["linkedin_url"] = linkedin_url

    logger.info(f"{service_name} payload: {payload}")

    try:
        response = httpx.post(
            f"{settings.api_urls[service_name]}/v1/contact/find",
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
        contact = data.get("contact", {})
        email = contact.get("email")
        phone = contact.get("phone")
        confidence_score = contact.get("confidence", 75) if email else 0
        
        if email:
            logger.info(f"{service_name} found: email={email}, phone={phone}")
        
        return {
            "email": email,
            "phone": phone,
            "confidence": confidence_score,
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
def call_kaspr(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Kaspr API to enrich a contact."""
    service_name = 'kaspr'
    if not service_status.is_available(service_name):
        logger.warning(f"{service_name} is marked unavailable, skipping.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    rate_limiters[service_name].wait()
    
    headers = {
        "X-API-KEY": settings.kaspr_api,
        "Content-Type": "application/json"
    }
    
    first_name = lead.get("first_name", "")
    last_name = lead.get("last_name", "")
    
    if (not first_name or not last_name) and lead.get("full_name"):
        name_parts = lead.get("full_name", "").split(" ", 1)
        if len(name_parts) >= 2:
            first_name = name_parts[0] if not first_name else first_name
            last_name = name_parts[1] if not last_name else last_name

    linkedin_url = lead.get("profile_url", "")
    if not linkedin_url or "linkedin.com" not in linkedin_url:
        logger.warning(f"{service_name}: LinkedIn URL required but not provided.")
        return {"email": None, "phone": None, "confidence": 0, "source": service_name, "raw_data": {}}

    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "linkedin_url": linkedin_url
    }

    logger.info(f"{service_name} payload: {payload}")

    try:
        response = httpx.post(
            f"{settings.api_urls[service_name]}/enrich",
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
        person_data = data.get("person", {})
        email = person_data.get("email")
        phone = person_data.get("phone")
        confidence_score = data.get("confidence", 80) if email else 0
        
        if email or phone:
            logger.info(f"{service_name} found: email={email}, phone={phone}")
        
        return {
            "email": email,
            "phone": phone,
            "confidence": confidence_score,
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