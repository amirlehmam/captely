#!/usr/bin/env python3
"""
Script to trigger lead score recalculation via analytics service API
"""
import requests
import json

# Analytics service endpoint 
ANALYTICS_API_URL = "http://localhost:8000/api/analytics/recalculate-lead-scores"

# You'll need a valid user token - replace with actual token
# For now, let's try without authentication as it might be configured differently
headers = {
    "Content-Type": "application/json"
}

print('🔢 Triggering lead score recalculation via Analytics API...')
print(f'📡 Calling: {ANALYTICS_API_URL}')

try:
    # Make the API call to trigger recalculation
    response = requests.post(ANALYTICS_API_URL, headers=headers, timeout=30)
    
    print(f'📊 Response status: {response.status_code}')
    
    if response.status_code == 200:
        result = response.json()
        print(f'✅ Recalculation triggered successfully!')
        print(f'📈 Result: {json.dumps(result, indent=2)}')
        
        if result.get('success'):
            print(f"🎯 Successfully updated {result.get('updated_count', 0)} contacts!")
            print("📈 Your lead scores and email reliability should now be working!")
        else:
            print(f"❌ Recalculation failed: {result.get('error', 'Unknown error')}")
    else:
        print(f'❌ API call failed with status {response.status_code}')
        print(f'Response: {response.text}')
        
except requests.exceptions.ConnectionError:
    print(f'❌ Cannot connect to analytics service at {ANALYTICS_API_URL}')
    print('💡 Make sure the analytics service is running on port 8000')
except Exception as e:
    print(f'❌ Error calling API: {e}')

print('')
print('💡 Alternative approaches:')
print('1. Make sure all services are running with docker-compose up')
print('2. Check the CRM contacts page to see if scores are already calculated')
print('3. Try running enrichment on new contacts to test the scoring system')