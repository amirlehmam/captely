#!/usr/bin/env python3
"""
Direct test of Icypeas with the working authentication method
"""

import os
import requests
import json
import time

# Get API key from environment
icypeas_api = os.getenv('ICYPEAS_API_KEY', '4faf07894e7c40eaac9c608b7f0f5556c7a903707632458c8fc985cd3cc58b8b')

print("🔍 Testing Icypeas Email Search with Working Auth")
print(f"API Key: {icypeas_api[:10]}...{icypeas_api[-10:]}")
print("-" * 50)

# Use the working authentication method
headers = {
    "Content-Type": "application/json",
    "Authorization": icypeas_api  # This works!
}

# Test data
launch_payload = {
    "firstname": "John",
    "lastname": "Doe",
    "domainOrCompany": "Microsoft"
}

print(f"🚀 Launching search for: {launch_payload['firstname']} {launch_payload['lastname']} at {launch_payload['domainOrCompany']}")

try:
    # 1) Launch the search
    launch_url = "https://app.icypeas.com/api/email-search"
    response = requests.post(launch_url, json=launch_payload, headers=headers, timeout=30)
    
    print(f"Launch response: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Launch successful!")
        print(f"Response: {json.dumps(result, indent=2)}")
        
        request_id = result.get("item", {}).get("_id")
        if request_id:
            print(f"\n🔄 Polling for results with request ID: {request_id}")
            
            # 2) Poll for results
            poll_url = "https://app.icypeas.com/api/bulk-single-searchs/read"
            wait_times = [3, 5, 8, 12, 20]
            
            for i, wait_time in enumerate(wait_times):
                print(f"⏳ Waiting {wait_time} seconds...")
                time.sleep(wait_time)
                
                poll_response = requests.post(
                    poll_url, 
                    json={"id": request_id}, 
                    headers=headers, 
                    timeout=20
                )
                
                print(f"Poll attempt {i+1}: Status {poll_response.status_code}")
                
                if poll_response.status_code == 200:
                    poll_data = poll_response.json()
                    print(f"Poll response: {json.dumps(poll_data, indent=2)}")
                    
                    items = poll_data.get("items", [])
                    if items:
                        item = items[0]
                        status = item.get("status")
                        print(f"Search status: {status}")
                        
                        if status in ("DEBITED", "FREE"):
                            results = item.get("results", {})
                            emails = results.get("emails", [])
                            phones = results.get("phones", [])
                            
                            if emails:
                                print(f"✅ FOUND EMAIL: {emails[0]}")
                            else:
                                print("❌ No email found")
                                
                            if phones:
                                print(f"📞 FOUND PHONE: {phones[0]}")
                            else:
                                print("📞 No phone found")
                            
                            print(f"\n🎉 Icypeas search completed successfully!")
                            break
                        else:
                            print(f"Still processing... (status: {status})")
                else:
                    print(f"Poll error: {poll_response.text}")
            else:
                print("❌ Search timed out")
    else:
        print(f"❌ Launch failed: {response.status_code}")
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"❌ Error: {str(e)}")

print("\n" + "="*50)
print("🏁 Icypeas direct test completed") 