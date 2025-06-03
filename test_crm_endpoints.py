#!/usr/bin/env python3
"""
Test script to verify CRM service setup and database tables
"""

import httpx
import asyncio
import json

# Test configuration - Update these URLs for your cloud server
CRM_SERVICE_URL = "http://localhost:8008"  # Update this to your cloud server URL
AUTH_SERVICE_URL = "http://localhost:8001"  # Update this to your cloud server URL

# Test user credentials (using the test user from init.sql)
TEST_EMAIL = "test@captely.com"
TEST_PASSWORD = "TestUser123!"

async def test_crm_setup():
    """Test CRM service setup and database connectivity"""
    
    print("🧪 Testing CRM Service Setup...")
    print("=" * 50)
    
    async with httpx.AsyncClient() as client:
        
        # Step 1: Test CRM service health
        print("1️⃣ Testing CRM service health...")
        try:
            health_response = await client.get(f"{CRM_SERVICE_URL}/health")
            if health_response.status_code == 200:
                print("✅ CRM service is running!")
            else:
                print(f"❌ CRM service health check failed: {health_response.status_code}")
                return
        except Exception as e:
            print(f"❌ Cannot connect to CRM service: {e}")
            return
        
        # Step 2: Login to get authentication token
        print("\n2️⃣ Getting authentication token...")
        try:
            login_response = await client.post(
                f"{AUTH_SERVICE_URL}/auth/login",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                }
            )
            
            if login_response.status_code != 200:
                print(f"❌ Login failed: {login_response.status_code}")
                print("Make sure you have a test user created or update credentials in the script")
                return
                
            token_data = login_response.json()
            access_token = token_data["access_token"]
            print("✅ Authentication successful!")
            
        except Exception as e:
            print(f"❌ Authentication failed: {e}")
            return
        
        # Step 3: Test CRM activities endpoint
        print("\n3️⃣ Testing CRM activities endpoint...")
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            activities_response = await client.get(
                f"{CRM_SERVICE_URL}/api/activities",
                headers=headers
            )
            
            print(f"📊 Activities Response Status: {activities_response.status_code}")
            if activities_response.status_code == 200:
                activities = activities_response.json()
                print(f"✅ CRM activities endpoint working! Found {len(activities)} activities")
            else:
                error_data = activities_response.json()
                print(f"❌ Activities endpoint failed: {error_data}")
                
        except Exception as e:
            print(f"❌ Activities test failed: {e}")
        
        # Step 4: Test CRM campaigns endpoint
        print("\n4️⃣ Testing CRM campaigns endpoint...")
        try:
            campaigns_response = await client.get(
                f"{CRM_SERVICE_URL}/api/campaigns",
                headers=headers
            )
            
            print(f"📊 Campaigns Response Status: {campaigns_response.status_code}")
            if campaigns_response.status_code == 200:
                campaigns = campaigns_response.json()
                print(f"✅ CRM campaigns endpoint working! Found {len(campaigns)} campaigns")
            else:
                error_data = campaigns_response.json()
                print(f"❌ Campaigns endpoint failed: {error_data}")
                
        except Exception as e:
            print(f"❌ Campaigns test failed: {e}")
        
        # Step 5: Test creating a new activity
        print("\n5️⃣ Testing activity creation...")
        try:
            activity_data = {
                "type": "call",
                "title": "Test Activity",
                "description": "This is a test activity created by the setup script",
                "status": "pending",
                "priority": "medium",
                "created_by": "setup_script"
            }
            
            create_response = await client.post(
                f"{CRM_SERVICE_URL}/api/activities",
                headers=headers,
                json=activity_data
            )
            
            if create_response.status_code == 200:
                created_activity = create_response.json()
                print(f"✅ Activity creation successful! ID: {created_activity['id']}")
            else:
                error_data = create_response.json()
                print(f"❌ Activity creation failed: {error_data}")
                
        except Exception as e:
            print(f"❌ Activity creation test failed: {e}")
        
        print("\n" + "=" * 50)
        print("🎉 CRM Setup Test Complete!")
        print("\nNext steps:")
        print("1. If all tests passed, your CRM service is working correctly")
        print("2. If tests failed, check the database connection and table creation")
        print("3. Make sure to update the URLs in this script for your cloud server")

if __name__ == "__main__":
    asyncio.run(test_crm_setup()) 