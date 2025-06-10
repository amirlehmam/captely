#!/usr/bin/env python3
"""
Script to recalculate lead scores and email reliability for all existing contacts
Run this after implementing the new scoring system
"""

import sys
import os
sys.path.append('/app')  # For Docker environment
sys.path.append('services/enrichment-worker')  # For local development

try:
    from services.enrichment_worker.app.tasks import recalculate_all_lead_scores
    print("✅ Successfully imported recalculate_all_lead_scores")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Trying alternative import...")
    try:
        # Alternative import path
        sys.path.append('.')
        from enrichment_worker.app.tasks import recalculate_all_lead_scores
        print("✅ Successfully imported with alternative path")
    except ImportError as e2:
        print(f"❌ Alternative import also failed: {e2}")
        sys.exit(1)

def main():
    """
    Main function to trigger lead score recalculation
    """
    print("🔢 Starting Lead Score & Email Reliability Recalculation")
    print("=" * 60)
    
    try:
        # Trigger the Celery task
        print("📤 Sending recalculation task to Celery...")
        task_result = recalculate_all_lead_scores.delay()
        
        print(f"✅ Task sent successfully!")
        print(f"📋 Task ID: {task_result.id}")
        print(f"🔗 Task Status: {task_result.status}")
        
        print("\n" + "=" * 60)
        print("📊 WHAT THIS DOES:")
        print("   • Calculates Lead Scores (0-100) based on:")
        print("     - Email/Phone presence & verification")
        print("     - Company & position information")
        print("     - LinkedIn profile presence")
        print("     - Enrichment confidence scores")
        print()
        print("   • Calculates Email Reliability categories:")
        print("     - excellent: High verification score, not disposable/role-based")
        print("     - good: Good verification or verified emails")
        print("     - fair: Lower verification scores")
        print("     - poor: Failed verification or disposable emails")
        print("     - unknown: Email exists but not verified")
        print("     - no_email: No email address")
        print()
        print("📈 EXPECTED IMPROVEMENTS:")
        print("   • CRM page will show meaningful lead scores")
        print("   • Email reliability badges will be accurate")
        print("   • Better lead qualification and prioritization")
        print("   • Improved filtering and sorting in CRM")
        print("=" * 60)
        
        # Try to get task result (with timeout)
        print("\n⏳ Waiting for task completion (timeout: 30 seconds)...")
        try:
            result = task_result.get(timeout=30)
            print("✅ Task completed successfully!")
            print(f"📊 Result: {result}")
            
            if result.get('success'):
                updated_count = result.get('updated_count', 0)
                print(f"🎉 SUCCESS: Updated {updated_count} contacts with new lead scores!")
            else:
                print(f"❌ Task failed: {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"⏰ Task is still running in background: {e}")
            print("💡 You can check the Celery worker logs for progress")
            print("💡 Or check your CRM page in a few minutes to see results")
        
    except Exception as e:
        print(f"❌ Error triggering recalculation: {e}")
        print("\n🔧 TROUBLESHOOTING:")
        print("   1. Make sure Redis is running")
        print("   2. Make sure Celery worker is running")
        print("   3. Check Docker logs: docker-compose logs enrichment-worker")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 