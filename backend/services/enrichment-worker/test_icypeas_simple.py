#!/usr/bin/env python3
"""
Simple Icypeas API test to debug authentication issues
"""

import os
import requests
import json

# Get API keys from environment
icypeas_api = os.getenv('ICYPEAS_API_KEY', '4faf07894e7c40eaac9c608b7f0f5556c7a903707632458c8fc985cd3cc58b8b')
icypeas_secret = os.getenv('ICYPEAS_API_SECRET', 'e7a3e867b51d1e59518d50d592e1f7aa1a5eccf7c7c56377c9d8dbddc35b2289')

print("🔍 Testing Icypeas API Authentication")
print(f"API Key: {icypeas_api[:10]}...{icypeas_api[-10:]}")
print(f"Secret: {icypeas_secret[:10]}...{icypeas_secret[-10:]}")
print("-" * 50)

# Test different authentication methods
auth_methods = [
    {
        "name": "Method 1: X-API-KEY + X-API-SECRET headers",
        "headers": {
            "Content-Type": "application/json",
            "X-API-KEY": icypeas_api,
            "X-API-SECRET": icypeas_secret
        }
    },
    {
        "name": "Method 2: Authorization Bearer token",
        "headers": {
            "Content-Type": "application/json", 
            "Authorization": f"Bearer {icypeas_api}"
        }
    },
    {
        "name": "Method 3: Authorization API key",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": icypeas_api
        }
    },
    {
        "name": "Method 4: Basic auth style",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": f"Basic {icypeas_api}:{icypeas_secret}"
        }
    }
]

# Test endpoints to try
test_endpoints = [
    {
        "name": "Email Verification",
        "url": "https://app.icypeas.com/api/email-verification",
        "method": "POST",
        "data": {"email": "test@gmail.com"}
    },
    {
        "name": "Domain Verification", 
        "url": "https://app.icypeas.com/api/domain-verification",
        "method": "POST",
        "data": {"domain": "gmail.com"}
    },
    {
        "name": "Email Search",
        "url": "https://app.icypeas.com/api/email-search",
        "method": "POST", 
        "data": {
            "firstname": "John",
            "lastname": "Doe",
            "domainOrCompany": "Microsoft"
        }
    },
    {
        "name": "Account Info",
        "url": "https://app.icypeas.com/api/account",
        "method": "GET",
        "data": None
    }
]

# Test each combination
for endpoint in test_endpoints:
    print(f"\n🎯 Testing endpoint: {endpoint['name']}")
    print(f"URL: {endpoint['url']}")
    
    for auth_method in auth_methods:
        print(f"\n  Trying {auth_method['name']}...")
        
        try:
            if endpoint['method'] == 'POST':
                response = requests.post(
                    endpoint['url'],
                    json=endpoint['data'],
                    headers=auth_method['headers'],
                    timeout=10
                )
            else:
                response = requests.get(
                    endpoint['url'],
                    headers=auth_method['headers'],
                    timeout=10
                )
            
            print(f"    Status: {response.status_code}")
            
            if response.status_code == 200:
                print("    ✅ SUCCESS!")
                result = response.json()
                print(f"    Response: {json.dumps(result, indent=2)[:200]}...")
                break
            elif response.status_code == 401:
                print("    ❌ Authentication failed")
                try:
                    error_detail = response.json()
                    print(f"    Error: {error_detail}")
                except:
                    print(f"    Error text: {response.text}")
            elif response.status_code == 404:
                print("    ⚠️ Endpoint not found")
            else:
                print(f"    ⚠️ Unexpected status: {response.status_code}")
                print(f"    Response: {response.text[:200]}")
                
        except Exception as e:
            print(f"    ❌ Request failed: {str(e)}")
    
    # If we found a working method for this endpoint, continue to next endpoint
    else:
        print(f"  ❌ All authentication methods failed for {endpoint['name']}")

print("\n" + "="*50)
print("🏁 Icypeas API test completed") 