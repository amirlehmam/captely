#!/usr/bin/env python3
"""
Test script to verify backend fixes
"""

import requests
import json

# Test token (same as used in frontend)
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmOTk4MDA5YS1iNWRlLTQxOWQtOGNkMy05YzBmYWYwZWUyMmMiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJleHAiOjE3MzgzODcxOTV9.yT1YRAjvKHFwv0vfjqsgBCXaAO7AwNJlD0f6wN4lBxM"

def test_analytics_dashboard():
    """Test the analytics dashboard endpoint"""
    print("Testing Analytics Dashboard...")
    
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}"
    }
    
    try:
        response = requests.get("http://localhost:8005/api/analytics/dashboard", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Analytics Dashboard Response:")
            print(f"   Total Contacts: {data.get('total_contacts', 0)}")
            print(f"   Emails Found: {data.get('emails_found', 0)}")
            print(f"   Phones Found: {data.get('phones_found', 0)}")
            print(f"   Success Rate: {data.get('success_rate', 0)}%")
            print(f"   Active Jobs: {data.get('active_jobs', 0)}")
            print(f"   Completed Jobs: {data.get('completed_jobs', 0)}")
            print(f"   Credits Used: {data.get('credits_used', 0)}")
        else:
            print(f"❌ Failed with status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_import_jobs():
    """Test the import jobs endpoint"""
    print("\nTesting Import Jobs...")
    
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}"
    }
    
    try:
        response = requests.get("http://localhost:8002/api/jobs", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            jobs = data.get("jobs", [])
            print(f"✅ Found {len(jobs)} jobs")
            
            for job in jobs:
                print(f"\n   Job ID: {job['id']}")
                print(f"   Status: {job['status']}")
                print(f"   Total: {job['total']}")
                print(f"   Completed: {job['completed']}")
                print(f"   Progress: {job['progress']}%")
                print(f"   Emails Found: {job['emails_found']}")
                print(f"   Success Rate: {job['success_rate']}%")
        else:
            print(f"❌ Failed with status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_user_credits():
    """Test the user credits endpoint"""
    print("\nTesting User Credits...")
    
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}"
    }
    
    try:
        response = requests.get("http://localhost:8002/api/user/credits", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Credit Information:")
            print(f"   Balance: {data.get('balance', 0)}")
            print(f"   Used Today: {data.get('used_today', 0)}")
            print(f"   Used This Month: {data.get('used_this_month', 0)}")
            
            stats = data.get('statistics', {})
            print(f"\n   Statistics:")
            print(f"   Total Processed: {stats.get('total_processed', 0)}")
            print(f"   Total Enriched: {stats.get('total_enriched', 0)}")
            print(f"   Email Hit Rate: {stats.get('email_hit_rate', 0)}%")
            print(f"   Success Rate: {stats.get('success_rate', 0)}%")
        else:
            print(f"❌ Failed with status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("=== Testing Backend Fixes ===\n")
    
    test_analytics_dashboard()
    test_import_jobs()
    test_user_credits()
    
    print("\n=== Test Complete ===") 