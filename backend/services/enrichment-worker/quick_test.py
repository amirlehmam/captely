#!/usr/bin/env python3
"""
Quick test to verify enrichment APIs are working
"""

import os
import sys
import time
import logging

# Add the app directory to Python path
sys.path.append('/app')

from app.enrichment_cascade import EnrichmentCascade

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_enrichment():
    """Test enrichment with a sample contact"""
    
    # Test contact
    test_contact = {
        "First Name": "Elon",
        "Last Name": "Musk", 
        "Company": "Tesla",
        "LinkedIn URL": "https://www.linkedin.com/in/elonmusk/",
        "Full Name": "Elon Musk"
    }
    
    print("🔍 Testing Enrichment Worker")
    print(f"Test contact: {test_contact['Full Name']} at {test_contact['Company']}")
    print("-" * 50)
    
    # Check API keys are available
    api_keys = {
        'HUNTER_API_KEY': os.getenv('HUNTER_API_KEY'),
        'DROPCONTACT_API_KEY': os.getenv('DROPCONTACT_API_KEY'), 
        'ICYPEAS_API_KEY': os.getenv('ICYPEAS_API_KEY'),
        'ICYPEAS_API_SECRET': os.getenv('ICYPEAS_API_SECRET'),
        'APOLLO_API_KEY': os.getenv('APOLLO_API_KEY')
    }
    
    print("API Keys Status:")
    for key, value in api_keys.items():
        status = "✅ Found" if value else "❌ Missing"
        masked_value = f"{value[:8]}...{value[-4:]}" if value and len(value) > 12 else value
        print(f"  {key}: {status} ({masked_value})")
    
    print("\n" + "-" * 50)
    
    # Initialize enrichment cascade
    try:
        print("🚀 Initializing enrichment cascade...")
        cascade = EnrichmentCascade()
        print("✅ Enrichment cascade initialized successfully")
        
        # Test enrichment
        print(f"\n🔄 Starting enrichment for {test_contact['Full Name']}...")
        start_time = time.time()
        
        result = cascade.enrich_contact(test_contact)
        
        elapsed_time = time.time() - start_time
        
        print(f"\n📊 Enrichment Results (completed in {elapsed_time:.2f}s):")
        print("-" * 50)
        
        if result.get("Email"):
            print(f"✅ Email Found: {result['Email']}")
            print(f"📞 Phone: {result.get('Phone', 'Not found')}")
            print(f"🎯 Source: {result.get('Email Source', 'Unknown')}")
            print(f"📈 Confidence: {result.get('Confidence', 0):.2f}")
            
            # Validate email format
            email = result.get("Email", "")
            if "@" in email and "." in email.split("@")[-1]:
                print("✅ Email format looks valid")
            else:
                print("⚠️ Email format may be invalid")
                
        else:
            print("❌ No email found")
            print(f"📞 Phone: {result.get('Phone', 'Not found')}")
            
        print(f"\n🎉 Test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error during enrichment test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_enrichment()
    exit(0 if success else 1) 