#!/usr/bin/env python3
"""
Test script to verify the enrichment pipeline is working properly
"""

import requests
import json
import time

# Test configuration
BASE_URL = "http://localhost"

def get_auth_token():
    """Get a fresh auth token"""
    print("🔐 Getting fresh auth token...")
    
    login_data = {
        "email": "test@test.com",
        "password": "password123"
    }
    
    try:
        # Try to login first
        response = requests.post(f"{BASE_URL}:8001/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"✅ Auth token obtained")
            return token
        else:
            print(f"⚠️ Login failed, trying to create account...")
            
            # Try to create account
            signup_data = {
                "email": "test@test.com",
                "password": "password123",
                "first_name": "Test",
                "last_name": "User",
                "company": "Test Company"
            }
            
            response = requests.post(f"{BASE_URL}:8001/auth/signup", json=signup_data)
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                token = data.get("access_token")
                print(f"✅ Account created and auth token obtained")
                return token
            else:
                print(f"❌ Signup failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return None
                
    except Exception as e:
        print(f"❌ Auth exception: {e}")
        return None

# Get fresh token
AUTH_TOKEN = get_auth_token()
if not AUTH_TOKEN:
    print("❌ Failed to get auth token. Exiting...")
    exit(1)

def test_dashboard():
    """Test the analytics dashboard endpoint"""
    print("\n🔍 Testing Analytics Dashboard...")
    
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    
    try:
        response = requests.get(f"{BASE_URL}:8005/api/analytics/dashboard", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Dashboard Response:")
            print(f"   Total Contacts: {data.get('overview', {}).get('total_contacts', 0)}")
            print(f"   Emails Found: {data.get('overview', {}).get('emails_found', 0)}")
            print(f"   Email Hit Rate: {data.get('overview', {}).get('email_hit_rate', 0)}%")
            print(f"   Current Batch: {data.get('current_batch', {}).get('job_id', 'None')}")
            print(f"   Recent Jobs: {len(data.get('recent_jobs', []))}")
            return True
        else:
            print(f"❌ Dashboard Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Dashboard Exception: {e}")
        return False

def test_export(job_id):
    """Test the export functionality"""
    print(f"\n📥 Testing Export for Job {job_id}...")
    
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    
    # Test CSV export
    try:
        response = requests.get(
            f"{BASE_URL}:8002/api/jobs/{job_id}/export?format=csv", 
            headers=headers
        )
        
        if response.status_code == 200:
            print("✅ CSV Export successful")
            print(f"   Content Length: {len(response.content)} bytes")
            return True
        else:
            print(f"❌ Export Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Export Exception: {e}")
        return False

def test_job_status(job_id):
    """Test job status endpoint"""
    print(f"\n📊 Testing Job Status for {job_id}...")
    
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    
    try:
        response = requests.get(f"{BASE_URL}:8002/api/jobs/{job_id}", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Job Status:")
            print(f"   Status: {data.get('status')}")
            print(f"   Progress: {data.get('progress')}%")
            print(f"   Total: {data.get('total')}")
            print(f"   Completed: {data.get('completed')}")
            print(f"   Emails Found: {data.get('emails_found')}")
            print(f"   Success Rate: {data.get('success_rate')}%")
            return True
        else:
            print(f"❌ Job Status Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Job Status Exception: {e}")
        return False

def test_new_enrichment():
    """Test creating a new enrichment with mock data"""
    print("\n🚀 Testing New Enrichment...")
    
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    
    # Create test data
    test_leads = [
        {
            "first_name": "Test",
            "last_name": "User",
            "company": "TestCompany",
            "position": "CEO",
            "linkedin_url": "https://linkedin.com/in/testuser"
        },
        {
            "first_name": "Demo",
            "last_name": "Contact",
            "company": "DemoInc",
            "position": "CTO"
        }
    ]
    
    try:
        response = requests.post(
            f"{BASE_URL}:8002/api/imports/leads",
            headers=headers,
            json={"leads": test_leads}
        )
        
        if response.status_code == 201:
            data = response.json()
            job_id = data.get("job_id")
            print(f"✅ New enrichment created: {job_id}")
            
            # Wait for processing
            print("   Waiting for enrichment to process...")
            time.sleep(5)
            
            # Check status
            test_job_status(job_id)
            
            return job_id
        else:
            print(f"❌ Enrichment Creation Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Enrichment Creation Exception: {e}")
        return None

def main():
    """Run all tests"""
    print("=" * 60)
    print("CAPTELY ENRICHMENT SYSTEM TEST")
    print("=" * 60)
    
    # Test dashboard
    dashboard_ok = test_dashboard()
    
    # Test existing job (from user's data)
    existing_job_id = "35d12122-e580-4322-b3e4-cdb22a142e70"
    job_ok = test_job_status(existing_job_id)
    export_ok = test_export(existing_job_id)
    
    # Test new enrichment
    new_job_id = test_new_enrichment()
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY:")
    print(f"  Dashboard API: {'✅ PASS' if dashboard_ok else '❌ FAIL'}")
    print(f"  Job Status API: {'✅ PASS' if job_ok else '❌ FAIL'}")
    print(f"  Export API: {'✅ PASS' if export_ok else '❌ FAIL'}")
    print(f"  New Enrichment: {'✅ PASS' if new_job_id else '❌ FAIL'}")
    print("=" * 60)

if __name__ == "__main__":
    main() 