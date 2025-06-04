#!/usr/bin/env python3
"""
Script to trigger verification for existing contacts
Run this after your services are up and running
"""

import requests
import time

def trigger_verification():
    """Trigger verification for all existing contacts"""
    
    # Replace with your actual API endpoint and auth token
    API_BASE = "http://localhost:8002"  # Import service URL
    
    # You'll need to get a valid auth token for your API
    # This is just an example - replace with your actual auth mechanism
    headers = {
        "Authorization": "Bearer YOUR_AUTH_TOKEN_HERE",  # Replace with real token
        "Content-Type": "application/json"
    }
    
    try:
        print("🔍 Triggering verification for existing contacts...")
        
        # Get list of jobs first
        jobs_response = requests.get(f"{API_BASE}/api/jobs", headers=headers, timeout=30)
        
        if jobs_response.status_code == 200:
            jobs = jobs_response.json()
            print(f"📋 Found {len(jobs)} jobs")
            
            for job in jobs[:5]:  # Verify first 5 jobs for testing
                job_id = job.get("id")
                if job_id:
                    print(f"🔍 Triggering verification for job: {job_id}")
                    
                    verify_response = requests.post(
                        f"{API_BASE}/api/verification/job/{job_id}/verify",
                        headers=headers,
                        timeout=30
                    )
                    
                    if verify_response.status_code == 200:
                        result = verify_response.json()
                        print(f"✅ Verification started for job {job_id}: {result}")
                    else:
                        print(f"❌ Failed to start verification for job {job_id}: {verify_response.status_code}")
                    
                    time.sleep(2)  # Wait between requests
        else:
            print(f"❌ Failed to get jobs: {jobs_response.status_code}")
            print("Make sure your services are running and you have a valid auth token")
            
    except Exception as e:
        print(f"❌ Error triggering verification: {e}")
        print("Make sure Docker containers are running: docker-compose up -d")

if __name__ == "__main__":
    trigger_verification() 