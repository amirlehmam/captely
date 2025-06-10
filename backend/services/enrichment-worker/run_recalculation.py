#!/usr/bin/env python3
"""
Script to recalculate lead scores for all contacts
Run this from the enrichment-worker directory
"""
import os
import sys

# Set up the environment
os.environ.setdefault('PYTHONPATH', '/app')

try:
    # Import the recalculation function
    from app.tasks import recalculate_all_lead_scores
    
    print('🔢 Starting lead score recalculation for all contacts...')
    print('📊 This will calculate lead scores and email reliability for existing contacts')
    print('⏳ Please wait, this may take a few minutes...')
    
    # Run the recalculation - calling it as a direct function, not Celery task
    task_instance = recalculate_all_lead_scores()
    
    # Execute the task logic directly
    result = task_instance.run()
    
    print(f'✅ Recalculation completed!')
    print(f'📊 Result: {result}')
    
    if result and result.get('success'):
        updated_count = result.get('updated_count', 0)
        print(f"🎯 Successfully updated {updated_count} contacts with lead scores!")
        print("📈 Your lead scores and email reliability should now be working properly")
        print("")
        print("🔍 You can now check your CRM contacts page to see:")
        print("   ✅ Lead scores (0-100 scale)")
        print("   ✅ Email reliability (excellent, good, fair, poor, unknown)")
    else:
        error = result.get('error', 'Unknown error') if result else 'Task returned no result'
        print(f"❌ Recalculation failed: {error}")
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("💡 Make sure you're in the enrichment-worker directory and have the right environment")
except Exception as e:
    print(f"❌ Error running recalculation: {e}")
    print("💡 Make sure your database is running and accessible")
    import traceback
    traceback.print_exc() 