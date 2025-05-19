#!/usr/bin/env python3
import os
import json
import logging
import requests
import time
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('api_test')

# API Keys from command line arguments or environment
HUNTER_API_KEY = "1b8302af512410b685217b7fcf00be362e094f0e"
DROPCONTACT_API_KEY = "zzqP8RNF6KXajJVgYaQiWeZW64J2mX"

# API URLs
HUNTER_API_URL = "https://api.hunter.io/v2"
DROPCONTACT_API_URL = "https://api.dropcontact.com/v1"  # Fixed base URL

def test_hunter_api():
    """Test Hunter.io API with the provided key"""
    logger.info("Testing Hunter.io API...")
    
    # Test endpoint for account verification
    test_url = f"{HUNTER_API_URL}/account?api_key={HUNTER_API_KEY}"
    
    try:
        response = requests.get(test_url, timeout=10)
        
        if response.status_code == 200:
            account_data = response.json().get("data", {})
            calls_left = account_data.get("calls", {}).get("left", 0)
            logger.info(f"✅ Hunter API key is valid! Calls remaining: {calls_left}")
            return True
        elif response.status_code == 401 or response.status_code == 403:
            logger.error(f"❌ Hunter API authentication failed. Status: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
        else:
            logger.error(f"❌ Hunter API returned unexpected status: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Error testing Hunter API: {str(e)}")
        return False

def test_dropcontact_api():
    """Test Dropcontact API with the provided key"""
    logger.info("Testing Dropcontact API...")
    
    # Method 1: Test using the credits endpoint
    credit_url = f"{DROPCONTACT_API_URL}/credit"  # Fixed credit URL
    
    try:
        headers = {
            "X-Access-Token": DROPCONTACT_API_KEY
        }
        
        response = requests.get(credit_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            credit_info = response.json()
            credits_left = credit_info.get("credit", 0)
            logger.info(f"✅ Dropcontact API key is valid! Credits remaining: {credits_left}")
            
            # If credits available, test the enrichment endpoint with a minimal example
            if credits_left > 0:
                return test_dropcontact_enrichment()
            else:
                logger.warning("⚠️ Dropcontact account has no credits remaining")
                return True  # Key is valid even if no credits
        elif response.status_code == 401 or response.status_code == 403:
            logger.error(f"❌ Dropcontact API authentication failed. Status: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
        elif response.status_code == 404:
            # If credit endpoint fails, try the alternative method with empty data
            logger.info("Credit endpoint not found, trying alternative method...")
            return test_dropcontact_alt_credit()
        else:
            logger.error(f"❌ Dropcontact API returned unexpected status: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Error testing Dropcontact API: {str(e)}")
        # Try alternative method
        logger.info("Trying alternative credit check method...")
        return test_dropcontact_alt_credit()

def test_dropcontact_alt_credit():
    """Alternative method to check Dropcontact credits per their documentation"""
    logger.info("Testing Dropcontact API using alternative method...")
    
    # According to docs, send an empty request to check credits
    test_data = {
        "data": [{}]
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Access-Token": DROPCONTACT_API_KEY
    }
    
    try:
        # Make the request to check credits
        enrich_url = f"{DROPCONTACT_API_URL}/enrich/all"
        response = requests.post(
            enrich_url, 
            json=test_data, 
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200 or response.status_code == 201:
            result = response.json()
            
            if "error" in result and result["error"]:
                logger.error(f"❌ Dropcontact API error: {result.get('reason', 'Unknown reason')}")
                return False
            
            credits_left = result.get("credits_left", 0)
            logger.info(f"✅ Dropcontact API key is valid! Credits remaining: {credits_left}")
            
            # If requesting an enrichment test
            if credits_left > 0:
                return test_dropcontact_enrichment()
            else:
                logger.warning("⚠️ Dropcontact account has no credits remaining")
                return True  # Key is valid even if no credits
        else:
            logger.error(f"❌ Dropcontact API returned error status: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Error testing Dropcontact API: {str(e)}")
        return False

def test_dropcontact_enrichment():
    """Test the Dropcontact enrichment endpoint with a minimal example"""
    logger.info("Testing Dropcontact enrichment endpoint...")
    
    # Use a test contact with known company email
    test_data = {
        "data": [
            {"first_name": "Elon", "last_name": "Musk", "company": "SpaceX"}
        ],
        "siren": True,
        "language": "en"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Access-Token": DROPCONTACT_API_KEY
    }
    
    try:
        # Make the request to initiate processing
        enrich_url = f"{DROPCONTACT_API_URL}/enrich/all" 
        response = requests.post(
            enrich_url, 
            json=test_data, 
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200 or response.status_code == 201:
            result = response.json()
            
            if "error" in result and result["error"]:
                logger.error(f"❌ Dropcontact enrichment error: {result.get('reason', 'Unknown reason')}")
                return False
                
            if "request_id" in result:
                request_id = result["request_id"]
                logger.info(f"✅ Dropcontact request initiated: ID={request_id}")
                
                # Poll for results (simplified polling)
                return check_dropcontact_results(request_id, headers)
            else:
                logger.error("❌ Dropcontact request did not return a request_id")
                return False
        else:
            logger.error(f"❌ Dropcontact API returned error status: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Error testing Dropcontact enrichment: {str(e)}")
        return False

def check_dropcontact_results(request_id, headers):
    """Check for results from Dropcontact"""
    max_attempts = 4
    attempts = 0
    
    while attempts < max_attempts:
        attempts += 1
        wait_time = 5 * attempts  # Wait 5, 10, 15, 20 seconds
        
        logger.info(f"Waiting {wait_time} seconds for Dropcontact results... (attempt {attempts}/{max_attempts})")
        time.sleep(wait_time)
        
        try:
            response = requests.get(
                f"{DROPCONTACT_API_URL}/enrich/all/{request_id}", 
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get("success") and not result.get("error"):
                    if "data" in result:
                        logger.info("✅ Dropcontact enrichment successful!")
                        # Display a sample of the data
                        if result["data"] and len(result["data"]) > 0:
                            first_contact = result["data"][0]
                            emails = first_contact.get("email", [])
                            email_str = ", ".join([e.get("email", "None") for e in emails]) if emails else "None"
                            logger.info(f"Sample result - Name: {first_contact.get('first_name')} {first_contact.get('last_name')}, Emails: {email_str}")
                        return True
                elif not result.get("success") and "reason" in result and "not ready" in result.get("reason", ""):
                    logger.info(f"Results not ready yet: {result.get('reason', 'Unknown reason')}")
                    # Continue polling
                    continue
                else:
                    logger.error(f"❌ Dropcontact returned error: {result.get('reason', 'Unknown reason')}")
                    return False
            else:
                logger.error(f"❌ Dropcontact status check error: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return False
        except Exception as e:
            logger.error(f"❌ Error checking Dropcontact status: {str(e)}")
            return False
    
    logger.warning("⚠️ Dropcontact max polling attempts reached")
    logger.info("The API key is valid, but we couldn't get results in time. This is normal for Dropcontact's asynchronous processing.")
    return True  # Key is valid even if we time out waiting for results

def main():
    print("\n=== API Key Testing Utility ===\n")
    print(f"Hunter API Key: {HUNTER_API_KEY[:5]}...{HUNTER_API_KEY[-5:]}")
    print(f"Dropcontact API Key: {DROPCONTACT_API_KEY[:5]}...{DROPCONTACT_API_KEY[-5:]}")
    print("\nRunning tests...\n")
    
    hunter_result = test_hunter_api()
    print("")
    dropcontact_result = test_dropcontact_api()
    
    print("\n=== Test Results Summary ===")
    print(f"Hunter API:      {'✅ PASSED' if hunter_result else '❌ FAILED'}")
    print(f"Dropcontact API: {'✅ PASSED' if dropcontact_result else '❌ FAILED'}")
    
    if hunter_result and dropcontact_result:
        print("\n✅ All API keys are valid and working!")
        print("You can now run the enrichment process.")
    else:
        print("\n⚠️ Some API keys failed validation.")
        print("Please check the error messages above and update your keys.")
    
    return hunter_result and dropcontact_result

if __name__ == "__main__":
    main() 