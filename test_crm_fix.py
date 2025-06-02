#!/usr/bin/env python3
"""
Test script to verify CRM service fixes
Tests user authentication and contact filtering
"""

import httpx
import asyncio
import json

# Test configuration
AUTH_SERVICE_URL = "http://localhost:8001"
CRM_SERVICE_URL = "http://localhost:8009"

# Test user credentials (make sure this user exists)
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "password123"

async def test_crm_with_auth():
    """Test CRM service with proper authentication"""
    
    print("🧪 Testing CRM Service Fixes...")
    print("=" * 50)
    
    async with httpx.AsyncClient() as client:
        
        # Step 1: Login to get JWT token
        print("1️⃣ Logging in to get authentication token...")
        login_response = await client.post(
            f"{AUTH_SERVICE_URL}/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return
            
        token_data = login_response.json()
        access_token = token_data["access_token"]
        print(f"✅ Login successful! Token received.")
        
        # Step 2: Test CRM contacts endpoint with authentication
        print("\n2️⃣ Testing CRM contacts endpoint with authentication...")
        headers = {"Authorization": f"Bearer {access_token}"}
        
        contacts_response = await client.get(
            f"{CRM_SERVICE_URL}/api/contacts",
            headers=headers
        )
        
        print(f"📊 CRM Response Status: {contacts_response.status_code}")
        
        if contacts_response.status_code == 200:
            contacts_data = contacts_response.json()
            total_contacts = contacts_data.get("pagination", {}).get("total", 0)
            contacts_list = contacts_data.get("contacts", [])
            
            print(f"✅ CRM service is working!")
            print(f"📈 Found {total_contacts} total contacts for authenticated user")
            print(f"📋 Showing {len(contacts_list)} contacts on this page")
            
            if contacts_list:
                print("\n📝 Sample contacts found:")
                for i, contact in enumerate(contacts_list[:3]):  # Show first 3
                    print(f"   {i+1}. {contact.get('first_name', '')} {contact.get('last_name', '')} - {contact.get('company', '')} - {contact.get('email', 'No email')}")
            else:
                print("📄 No contacts found for this user")
                
        elif contacts_response.status_code == 401:
            print("❌ Authentication failed - CRM service rejected the token")
            print(f"Response: {contacts_response.text}")
        else:
            print(f"❌ CRM service error: {contacts_response.status_code}")
            print(f"Response: {contacts_response.text}")
            
        # Step 3: Test enrichment stats endpoint
        print("\n3️⃣ Testing enrichment stats endpoint...")
        stats_response = await client.get(
            f"{CRM_SERVICE_URL}/api/contacts/stats/enrichment",
            headers=headers
        )
        
        if stats_response.status_code == 200:
            stats_data = stats_response.json()
            overview = stats_data.get("overview", {})
            
            print(f"✅ Enrichment stats working!")
            print(f"📊 Total contacts: {overview.get('total_contacts', 0)}")
            print(f"📧 Emails found: {overview.get('emails_found', 0)}")
            print(f"📱 Phones found: {overview.get('phones_found', 0)}")
            print(f"📈 Email hit rate: {overview.get('email_hit_rate', 0):.1f}%")
            
        else:
            print(f"❌ Stats endpoint error: {stats_response.status_code}")
            
        # Step 4: Test recent contacts endpoint  
        print("\n4️⃣ Testing recent contacts endpoint...")
        recent_response = await client.get(
            f"{CRM_SERVICE_URL}/api/contacts/recent",
            headers=headers
        )
        
        if recent_response.status_code == 200:
            recent_data = recent_response.json()
            recent_contacts = recent_data.get("contacts", [])
            
            print(f"✅ Recent contacts working!")
            print(f"🕒 Found {len(recent_contacts)} recent enriched contacts")
            
        else:
            print(f"❌ Recent contacts error: {recent_response.status_code}")
            
    print("\n" + "=" * 50)
    print("🎯 CRM Service Test Complete!")

if __name__ == "__main__":
    asyncio.run(test_crm_with_auth()) 