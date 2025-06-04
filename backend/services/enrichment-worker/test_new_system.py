#!/usr/bin/env python3
"""
Test script for the new enrichment cascade system with verification
"""
import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.enrichment_engine import enrichment_engine
from app.config import get_settings

async def test_single_contact():
    """Test enriching a single contact"""
    print("🚀 Testing Single Contact Enrichment")
    print("=" * 50)
    
    # Test contact data
    test_contact = {
        "first_name": "John",
        "last_name": "Doe", 
        "company": "Google",
        "company_domain": "google.com",
        "profile_url": "https://www.linkedin.com/in/johndoe"
    }
    
    print(f"📋 Contact: {test_contact['first_name']} {test_contact['last_name']} at {test_contact['company']}")
    print()
    
    try:
        result = await enrichment_engine.enrich_contact(test_contact)
        
        print("✅ Enrichment Results:")
        print(f"   📧 Email: {result.email or 'Not found'}")
        print(f"   📱 Phone: {result.phone or 'Not found'}")
        print(f"   🎯 Confidence: {result.confidence:.1%}")
        print(f"   🔧 Source: {result.source}")
        print(f"   ✔️ Email Verified: {result.email_verified}")
        print(f"   📞 Phone Verified: {result.phone_verified}")
        print(f"   🌟 Email Score: {result.email_verification_score:.1%}")
        print(f"   📈 Phone Score: {result.phone_verification_score:.1%}")
        print(f"   🏭 Providers Tried: {', '.join(result.providers_tried)}")
        print(f"   💰 Total Cost: ${result.total_cost:.4f}")
        print(f"   ⏱️ Processing Time: {result.processing_time:.2f}s")
        
        if result.email_verification_details:
            print()
            print("📧 Email Verification Details:")
            details = result.email_verification_details
            print(f"   Level: {details.get('verification_level', 'N/A')}")
            print(f"   Deliverable: {details.get('deliverable', False)}")
            print(f"   Catchall: {details.get('is_catchall', False)}")
            print(f"   Disposable: {details.get('is_disposable', False)}")
            print(f"   Role-based: {details.get('is_role_based', False)}")
            print(f"   Reason: {details.get('reason', 'N/A')}")
        
        if result.phone_verification_details:
            print()
            print("📞 Phone Verification Details:")
            details = result.phone_verification_details
            print(f"   Type: {'Mobile' if details.get('is_mobile') else 'Landline' if details.get('is_landline') else 'VoIP' if details.get('is_voip') else 'Unknown'}")
            print(f"   Country: {details.get('country', 'N/A')}")
            print(f"   Carrier: {details.get('carrier', 'N/A')}")
            print(f"   Region: {details.get('region', 'N/A')}")
            print(f"   International: {details.get('formatted_international', 'N/A')}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

async def test_batch_enrichment():
    """Test enriching multiple contacts"""
    print("\n🚀 Testing Batch Enrichment")
    print("=" * 50)
    
    # Test contacts
    test_contacts = [
        {
            "first_name": "Satya",
            "last_name": "Nadella",
            "company": "Microsoft",
            "company_domain": "microsoft.com"
        },
        {
            "first_name": "Tim",
            "last_name": "Cook", 
            "company": "Apple",
            "company_domain": "apple.com"
        },
        {
            "first_name": "Sundar",
            "last_name": "Pichai",
            "company": "Google",
            "company_domain": "google.com"
        }
    ]
    
    print(f"📋 Processing {len(test_contacts)} contacts...")
    print()
    
    try:
        results = await enrichment_engine.enrich_batch(test_contacts, max_concurrent=2)
        
        print("✅ Batch Results:")
        total_cost = 0
        emails_found = 0
        phones_found = 0
        
        for i, result in enumerate(results):
            contact = test_contacts[i]
            print(f"\n   Contact {i+1}: {contact['first_name']} {contact['last_name']}")
            print(f"   📧 Email: {result.email or 'Not found'}")
            print(f"   📱 Phone: {result.phone or 'Not found'}")
            print(f"   🎯 Confidence: {result.confidence:.1%}")
            print(f"   🔧 Source: {result.source}")
            print(f"   💰 Cost: ${result.total_cost:.4f}")
            print(f"   ⏱️ Time: {result.processing_time:.2f}s")
            
            total_cost += result.total_cost
            if result.email:
                emails_found += 1
            if result.phone:
                phones_found += 1
        
        print(f"\n📊 Batch Summary:")
        print(f"   📧 Emails Found: {emails_found}/{len(test_contacts)} ({emails_found/len(test_contacts):.1%})")
        print(f"   📱 Phones Found: {phones_found}/{len(test_contacts)} ({phones_found/len(test_contacts):.1%})")
        print(f"   💰 Total Cost: ${total_cost:.4f}")
        print(f"   💵 Avg Cost: ${total_cost/len(test_contacts):.4f} per contact")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

async def test_verification_only():
    """Test verification functions directly"""
    print("\n🚀 Testing Verification Functions")
    print("=" * 50)
    
    # Test email verification
    test_email = "test@gmail.com"
    print(f"📧 Testing email verification: {test_email}")
    
    try:
        from enrichment.email_verification import email_verifier
        email_result = await email_verifier.verify_email(test_email)
        
        print(f"   ✅ Valid: {email_result.is_valid}")
        print(f"   🎯 Score: {email_result.score}/100")
        print(f"   📶 Level: {email_result.verification_level}")
        print(f"   🎭 Disposable: {email_result.is_disposable}")
        print(f"   👔 Role-based: {email_result.is_role_based}")
        print(f"   🕳️ Catchall: {email_result.is_catchall}")
        print(f"   📬 Deliverable: {email_result.deliverable}")
        print(f"   💬 Reason: {email_result.reason}")
        
    except Exception as e:
        print(f"   ❌ Email verification error: {str(e)}")
    
    # Test phone verification
    test_phone = "+33612345678"
    print(f"\n📱 Testing phone verification: {test_phone}")
    
    try:
        from enrichment.phone_verification import phone_verifier
        phone_result = await phone_verifier.verify_phone(test_phone)
        
        print(f"   ✅ Valid: {phone_result.is_valid}")
        print(f"   🎯 Score: {phone_result.score}/100")
        print(f"   📱 Mobile: {phone_result.is_mobile}")
        print(f"   🏠 Landline: {phone_result.is_landline}")
        print(f"   💻 VoIP: {phone_result.is_voip}")
        print(f"   🌍 Country: {phone_result.country}")
        print(f"   📡 Carrier: {phone_result.carrier_name}")
        print(f"   📍 Region: {phone_result.region}")
        print(f"   🌐 International: {phone_result.formatted_international}")
        print(f"   💬 Reason: {phone_result.reason}")
        
    except Exception as e:
        print(f"   ❌ Phone verification error: {str(e)}")

def test_configuration():
    """Test configuration and provider setup"""
    print("\n🚀 Testing Configuration")
    print("=" * 50)
    
    settings = get_settings()
    
    print("⚙️ Service Configuration:")
    print(f"   🏭 Service Order: {' → '.join(settings.service_order)}")
    print(f"   💰 Service Costs:")
    for service in settings.service_order:
        cost = settings.service_costs.get(service, 0)
        print(f"      {service}: ${cost:.3f}/search")
    
    print(f"\n🔧 Engine Settings:")
    print(f"   📊 Max Providers per Contact: {settings.max_providers_per_contact}")
    print(f"   📧 Email Verification: {'✅' if settings.enable_email_verification else '❌'}")
    print(f"   📱 Phone Verification: {'✅' if settings.enable_phone_verification else '❌'}")
    print(f"   🛑 Stop on High Confidence: {'✅' if settings.cascade_stop_on_high_confidence else '❌'}")
    
    print(f"\n🎯 Confidence Thresholds:")
    print(f"   📧 Email Minimum: {settings.minimum_confidence:.1%}")
    print(f"   📧 Email High: {settings.high_confidence:.1%}")
    print(f"   📧 Email Excellent: {settings.excellent_confidence:.1%}")
    print(f"   📱 Phone Minimum: {settings.phone_minimum_confidence:.1%}")
    print(f"   📱 Phone High: {settings.phone_high_confidence:.1%}")

async def main():
    """Run all tests"""
    print("🔥 CAPTELY ENRICHMENT ENGINE TEST")
    print("==================================")
    print()
    
    # Test configuration first
    test_configuration()
    
    # Test verification functions
    await test_verification_only()
    
    # Test single contact enrichment
    await test_single_contact()
    
    # Test batch enrichment
    await test_batch_enrichment()
    
    # Show final stats
    print("\n📈 Final Engine Statistics:")
    print("=" * 50)
    
    stats = enrichment_engine.get_stats()
    print(f"   📊 Total Enrichments: {stats['total_enrichments']}")
    print(f"   💰 Total Cost: ${stats['total_cost']:.4f}")
    print(f"   ⏱️ Total Time: {stats['total_processing_time']:.2f}s")
    if stats['total_enrichments'] > 0:
        print(f"   📊 Avg Time/Contact: {stats['average_time_per_contact']:.2f}s")
        print(f"   💵 Avg Cost/Contact: ${stats['average_cost_per_contact']:.4f}")

if __name__ == "__main__":
    asyncio.run(main()) 