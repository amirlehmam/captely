#!/usr/bin/env python3
"""
Script to recalculate lead scores for all contacts
"""
import sys
import os

# Add the enrichment worker to the path
sys.path.append('backend/services/enrichment-worker')

try:
    from app.tasks import recalculate_all_lead_scores
    print('🔢 Starting lead score recalculation for all contacts...')
    print('📊 This will calculate lead scores and email reliability for existing contacts')
    
    # Run the recalculation task
    result = recalculate_all_lead_scores()
    
    print(f'✅ Recalculation result: {result}')
    
    if result.get('success'):
        print(f"🎯 Successfully updated {result.get('updated_count', 0)} contacts with lead scores!")
        print("📈 Your lead scores and email reliability should now be working properly")
    else:
        print(f"❌ Recalculation failed: {result.get('error', 'Unknown error')}")
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("💡 Make sure you're running this from the project root directory")
except Exception as e:
    print(f"❌ Error running recalculation: {e}")
    print("💡 Make sure your database is running and accessible")