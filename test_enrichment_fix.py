#!/usr/bin/env python3
"""
Test script to verify enrichment is working after fixes
"""

import requests
import json
import time

BASE_URL = "http://localhost"

# Get auth token from existing test user
def get_auth_token():
    """Get auth token for test user"""
    print("🔐 Getting auth token...")
    
    login_data = {
        "email": "test@test.com",
        "password": "password123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}:8001/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print("✅ Auth token obtained")
            return token
        else:
            print(f"❌ Login failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Auth error: {e}")
        return None

# Test enrichment with specific providers
def test_enrichment_providers():
    """Test enrichment with the new provider setup"""
    
    token = get_auth_token()
    if not token:
        print("❌ Failed to get auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test leads that should work with different providers
    test_leads = [
        {
            "first_name": "Test",
            "last_name": "Icypeas",
            "company": "TestCompany",
            "position": "CEO",
            "linkedin_url": "https://linkedin.com/in/test-icypeas"
        },
        {
            "first_name": "Demo",
            "last_name": "Dropcontact",
            "company": "DemoInc",
            "position": "CTO"
        },
        {
            "first_name": "Mock",
            "last_name": "PDL",
            "company": "MockCorp",
            "position": "CFO"
        }
    ]
    
    print("\n🚀 Creating test enrichment job...")
    
    try:
        response = requests.post(
            f"{BASE_URL}:8002/api/imports/leads",
            headers=headers,
            json={"leads": test_leads}
        )
        
        if response.status_code == 201:
            data = response.json()
            job_id = data.get("job_id")
            print(f"✅ Job created: {job_id}")
            
            # Wait for processing
            print("\n⏳ Waiting for enrichment to process...")
            for i in range(10):
                time.sleep(3)
                
                # Check job status
                status_response = requests.get(
                    f"{BASE_URL}:8002/api/jobs/{job_id}",
                    headers=headers
                )
                
                if status_response.status_code == 200:
                    job_data = status_response.json()
                    print(f"\n📊 Progress: {job_data.get('progress')}%")
                    print(f"   Status: {job_data.get('status')}")
                    print(f"   Emails found: {job_data.get('emails_found')}")
                    print(f"   Phones found: {job_data.get('phones_found')}")
                    print(f"   Success rate: {job_data.get('success_rate')}%")
                    
                    if job_data.get('progress', 0) >= 100:
                        print("\n✅ Job completed!")
                        
                        # Get contacts to see which providers worked
                        contacts_response = requests.get(
                            f"{BASE_URL}:8002/api/jobs/{job_id}/contacts",
                            headers=headers
                        )
                        
                        if contacts_response.status_code == 200:
                            contacts_data = contacts_response.json()
                            print("\n📋 Contact Results:")
                            for contact in contacts_data.get('contacts', []):
                                print(f"\n   {contact['first_name']} {contact['last_name']}:")
                                print(f"   - Email: {contact.get('email', 'None')}")
                                print(f"   - Phone: {contact.get('phone', 'None')}")
                                print(f"   - Provider: {contact.get('enrichment_provider', 'None')}")
                                print(f"   - Status: {contact.get('enrichment_status')}")
                        break
            
            # Check Flower tasks
            print("\n🌸 Checking Flower tasks...")
            check_flower_tasks()
            
        else:
            print(f"❌ Job creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Test error: {e}")

def check_flower_tasks():
    """Check Flower API for recent task results"""
    try:
        # Note: This requires Flower to be accessible
        response = requests.get(f"{BASE_URL}:5555/api/tasks?limit=10")
        if response.status_code == 200:
            tasks = response.json()
            print("\n📊 Recent Flower Tasks:")
            for task_id, task_data in list(tasks.items())[:5]:
                if task_data.get('name') == 'app.tasks.cascade_enrich':
                    result = task_data.get('result', {})
                    print(f"\n   Task: {task_id[:8]}...")
                    print(f"   - Status: {result.get('status')}")
                    print(f"   - Provider: {result.get('provider_used')}")
                    print(f"   - Credits: {result.get('credits_consumed')}")
    except Exception as e:
        print(f"   ℹ️ Could not access Flower API: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("ENRICHMENT FIX VERIFICATION TEST")
    print("=" * 60)
    
    test_enrichment_providers()
    
    print("\n" + "=" * 60) 