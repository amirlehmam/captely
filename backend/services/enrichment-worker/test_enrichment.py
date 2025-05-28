#!/usr/bin/env python3
"""
Comprehensive test script for enrichment worker APIs
Tests all providers (Hunter, Dropcontact, Icypeas, Apollo) with real API calls
"""

import requests
import time
import os
import json
from typing import Dict, Any

# Get API keys from environment
API_KEYS = {
    'hunter': os.getenv('HUNTER_API_KEY'),
    'dropcontact': os.getenv('DROPCONTACT_API_KEY'),
    'icypeas_api': os.getenv('ICYPEAS_API_KEY'),
    'icypeas_secret': os.getenv('ICYPEAS_API_SECRET'),
    'apollo': os.getenv('APOLLO_API_KEY')
}

# Test contact data
TEST_CONTACT = {
    "First Name": "John",
    "Last Name": "Doe", 
    "Company": "Microsoft",
    "Domain": "microsoft.com",
    "LinkedIn URL": "https://www.linkedin.com/in/johndoe/"
}

def test_hunter():
    """Test Hunter.io API"""
    print("\n=== Testing Hunter.io ===")
    
    if not API_KEYS['hunter']:
        print("❌ Hunter API key not found")
        return False
        
    try:
        # Test 1: Account info
        account_url = f"https://api.hunter.io/v2/account?api_key={API_KEYS['hunter']}"
        response = requests.get(account_url, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ Hunter account check failed: {response.status_code}")
            return False
            
        account_data = response.json().get('data', {})
        calls_left = account_data.get('calls', {}).get('left', 0)
        print(f"✅ Hunter account OK. Calls remaining: {calls_left}")
        
        # Test 2: Email finder
        if calls_left > 0:
            finder_url = "https://api.hunter.io/v2/email-finder"
            params = {
                'domain': TEST_CONTACT['Domain'],
                'first_name': TEST_CONTACT['First Name'],
                'last_name': TEST_CONTACT['Last Name'],
                'api_key': API_KEYS['hunter']
            }
            
            response = requests.get(finder_url, params=params, timeout=15)
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                email = data.get('email')
                score = data.get('score', 0)
                print(f"✅ Hunter email finder OK. Email: {email}, Score: {score}")
                return True
            else:
                print(f"❌ Hunter email finder failed: {response.status_code}")
        else:
            print("⚠️ Hunter has no API calls remaining")
            return True  # Account is working, just no credits
            
    except Exception as e:
        print(f"❌ Hunter test error: {str(e)}")
        return False

def test_dropcontact():
    """Test Dropcontact API"""
    print("\n=== Testing Dropcontact ===")
    
    if not API_KEYS['dropcontact']:
        print("❌ Dropcontact API key not found")
        return False
        
    try:
        headers = {
            "X-Access-Token": API_KEYS['dropcontact'],
            "Content-Type": "application/json"
        }
        
        # Test 1: Credits check with empty probe
        probe_data = {"data": [{}]}
        response = requests.post(
            "https://api.dropcontact.io/v1/enrich/all",
            json=probe_data,
            headers=headers,
            timeout=10
        )
        
        if response.status_code in (200, 201):
            result = response.json()
            credits = result.get('credits_left', 0)
            print(f"✅ Dropcontact API accessible. Credits remaining: {credits}")
            
            # Test 2: Real enrichment if we have credits
            if credits > 0:
                enrich_data = {
                    "data": [{
                        "first_name": TEST_CONTACT['First Name'],
                        "last_name": TEST_CONTACT['Last Name'],
                        "company": TEST_CONTACT['Company']
                    }],
                    "siren": True,
                    "language": "en",
                    "num": True,
                    "sync": False
                }
                
                response = requests.post(
                    "https://api.dropcontact.io/v1/enrich/all",
                    json=enrich_data,
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code in (200, 201):
                    result = response.json()
                    if "request_id" in result:
                        print(f"✅ Dropcontact enrichment submitted. Request ID: {result['request_id']}")
                        # Note: We'd normally poll for results here
                        return True
                    elif "data" in result:
                        print("✅ Dropcontact returned synchronous results")
                        return True
                else:
                    print(f"❌ Dropcontact enrichment failed: {response.status_code}")
            else:
                print("⚠️ Dropcontact has no credits remaining")
                return True  # API is working, just no credits
                
        elif response.status_code in (401, 403):
            print(f"❌ Dropcontact authentication failed: {response.status_code}")
            return False
        else:
            print(f"❌ Dropcontact probe failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Dropcontact test error: {str(e)}")
        return False

def test_icypeas():
    """Test Icypeas API"""
    print("\n=== Testing Icypeas ===")
    
    if not API_KEYS['icypeas_api'] or not API_KEYS['icypeas_secret']:
        print("❌ Icypeas API key or secret not found")
        return False
        
    try:
        # Try multiple authentication methods
        auth_methods = [
            {
                "name": "Authorization header (working method)",
                "headers": {
                    "Content-Type": "application/json",
                    "Authorization": API_KEYS['icypeas_api']
                }
            },
            {
                "name": "X-API-KEY/X-API-SECRET headers",
                "headers": {
                    "Content-Type": "application/json",
                    "X-API-KEY": API_KEYS['icypeas_api'],
                    "X-API-SECRET": API_KEYS['icypeas_secret']
                }
            },
            {
                "name": "Authorization Bearer token",
                "headers": {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {API_KEYS['icypeas_api']}"
                }
            }
        ]
        
        launch_data = {
            "firstname": TEST_CONTACT['First Name'],
            "lastname": TEST_CONTACT['Last Name'],
            "domainOrCompany": TEST_CONTACT['Company']
        }
        
        for method in auth_methods:
            print(f"Trying {method['name']}...")
            
            response = requests.post(
                "https://app.icypeas.com/api/email-search",
                json=launch_data,
                headers=method['headers'],
                timeout=30
            )
            
            if response.status_code in (200, 201):
                result = response.json()
                request_id = result.get("item", {}).get("_id")
                if request_id:
                    print(f"✅ Icypeas email search submitted. Request ID: {request_id}")
                    return True
                else:
                    print("❌ Icypeas returned success but no request ID")
            elif response.status_code == 401:
                print(f"❌ Authentication failed with {method['name']}")
                continue
            else:
                print(f"❌ Icypeas failed with {method['name']}: {response.status_code}")
                print(f"Response: {response.text}")
                continue
        
        print("❌ All Icypeas authentication methods failed")
        return False
        
    except Exception as e:
        print(f"❌ Icypeas test error: {str(e)}")
        return False

def test_apollo():
    """Test Apollo.io API"""
    print("\n=== Testing Apollo.io ===")
    
    if not API_KEYS['apollo']:
        print("❌ Apollo API key not found")
        return False
        
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Api-Key": API_KEYS['apollo']
        }
        
        # Test with people search endpoint
        params = {
            "q_organization_domains": TEST_CONTACT['Domain'],
            "q_names": f"{TEST_CONTACT['First Name']} {TEST_CONTACT['Last Name']}"
        }
        
        response = requests.get(
            "https://api.apollo.io/v1/people/search",
            params=params,
            headers=headers,
            timeout=20
        )
        
        if response.status_code == 200:
            data = response.json()
            people = data.get('people', [])
            print(f"✅ Apollo search successful. Found {len(people)} people")
            
            if people:
                person = people[0]
                email = person.get('email')
                print(f"✅ Apollo found email: {email}")
            
            return True
        elif response.status_code in (401, 403):
            print(f"❌ Apollo authentication failed: {response.status_code}")
            return False
        else:
            print(f"❌ Apollo search failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Apollo test error: {str(e)}")
        return False

def main():
    """Run all API tests"""
    print("🔍 Testing Enrichment Worker APIs")
    print(f"Test contact: {TEST_CONTACT['First Name']} {TEST_CONTACT['Last Name']} at {TEST_CONTACT['Company']}")
    
    results = {
        'hunter': test_hunter(),
        'dropcontact': test_dropcontact(),
        'icypeas': test_icypeas(),
        'apollo': test_apollo()
    }
    
    print("\n" + "="*50)
    print("📊 TEST RESULTS SUMMARY")
    print("="*50)
    
    working_services = []
    failed_services = []
    
    for service, success in results.items():
        status = "✅ WORKING" if success else "❌ FAILED"
        print(f"{service.upper():<12} {status}")
        
        if success:
            working_services.append(service)
        else:
            failed_services.append(service)
    
    print("\n📈 Overall Status:")
    print(f"Working services: {len(working_services)}/4")
    print(f"Failed services: {len(failed_services)}/4")
    
    if len(working_services) == 0:
        print("\n⚠️  NO SERVICES ARE WORKING! Please check your API keys.")
    elif len(working_services) < 4:
        print(f"\n⚠️  Some services failed: {', '.join(failed_services)}")
        print("Check API keys and account status for failed services.")
    else:
        print("\n🎉 ALL SERVICES ARE WORKING!")

if __name__ == "__main__":
    main() 