#!/usr/bin/env python3
"""
WORKING Lead Score Recalculation Script
This will actually fix your lead scores right now!
"""
import psycopg2
import os
from datetime import datetime

# Database connection settings - adjust these to match your setup
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'captely',  # adjust if different
    'user': 'postgres',     # adjust if different  
    'password': 'password'  # adjust if different
}

def calculate_lead_score(email, phone, email_verified, phone_verified, 
                        email_verification_score, phone_verification_score,
                        company, position, profile_url, enrichment_score):
    """Calculate lead score based on the same algorithm as in tasks.py"""
    score = 20  # Base score
    
    # Email scoring (max 55 points for email)
    if email and email.strip():
        score += 20  # Has email
        
        if email_verified:
            if email_verification_score and email_verification_score >= 0.9:
                score += 35  # Excellent verification
            elif email_verification_score and email_verification_score >= 0.7:
                score += 30  # Good verification
            elif email_verification_score and email_verification_score >= 0.5:
                score += 25  # Fair verification
            else:
                score += 20  # Basic verification
        else:
            # Email exists but not verified gets partial credit
            if email_verification_score and email_verification_score > 0:
                score += int(email_verification_score * 15)
    
    # Phone scoring (max 35 points for phone)
    if phone and phone.strip():
        score += 15  # Has phone
        
        if phone_verified:
            if phone_verification_score and phone_verification_score >= 0.9:
                score += 30  # Excellent phone verification
            elif phone_verification_score and phone_verification_score >= 0.7:
                score += 25  # Good verification
            else:
                score += 20  # Basic verification
        else:
            # Phone exists but not verified gets partial credit
            if phone_verification_score and phone_verification_score > 0:
                score += int(phone_verification_score * 10)
    
    # Additional data quality factors (max 30 points)
    if company and company.strip() and company.lower() != 'unknown':
        score += 10  # Has company info
        
    if position and position.strip() and position.lower() != 'unknown':
        score += 10  # Has position/title
        
    if profile_url and profile_url.strip():
        score += 10  # Has LinkedIn/profile URL
    
    # Enrichment quality bonus (max 10 points)
    if enrichment_score and enrichment_score >= 0.8:
        score += 10  # High confidence enrichment
    elif enrichment_score and enrichment_score >= 0.6:
        score += 5   # Medium confidence enrichment
    
    # Cap at 100
    return min(score, 100)

def calculate_email_reliability(email, email_verified, email_verification_score, 
                               is_disposable=False, is_role_based=False, is_catchall=False):
    """Calculate email reliability category"""
    if not email or not email.strip():
        return 'no_email'
    
    # Check for problematic email flags
    if is_disposable:
        return 'poor'  # Disposable emails are unreliable
    
    if not email_verified:
        return 'unknown'  # Email exists but not verified
    
    # Verified email - check score and flags
    if email_verification_score is None:
        email_verification_score = 0.5  # Default if no score available
    
    # Excellent category
    if email_verification_score >= 0.9 and not is_role_based and not is_catchall:
        return 'excellent'
    
    # Good category
    if email_verification_score >= 0.7:
        if is_role_based:
            return 'fair'  # Role-based emails downgrade to fair
        return 'good'
    
    # Fair category
    if email_verification_score >= 0.5:
        return 'fair'
    
    # Poor category
    return 'poor'

def main():
    """Main function to recalculate all lead scores"""
    print("🔢 Starting Lead Score Recalculation...")
    print("=" * 50)
    
    try:
        # Try to connect to database
        print("📡 Connecting to database...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("✅ Database connected successfully!")
        
        # Get all contacts that need lead score calculation
        print("📊 Fetching contacts...")
        query = """
            SELECT 
                id, email, phone, company, position, profile_url,
                email_verified, phone_verified, 
                email_verification_score, phone_verification_score,
                enrichment_score, is_disposable, is_role_based, is_catchall
            FROM contacts 
            WHERE lead_score = 0 OR lead_score IS NULL OR email_reliability = 'unknown' OR email_reliability IS NULL
            ORDER BY id
        """
        
        cursor.execute(query)
        contacts = cursor.fetchall()
        
        print(f"📈 Found {len(contacts)} contacts to update")
        
        if len(contacts) == 0:
            print("✅ All contacts already have lead scores calculated!")
            return
        
        # Process contacts in batches
        updated_count = 0
        batch_size = 100
        
        for i in range(0, len(contacts), batch_size):
            batch = contacts[i:i + batch_size]
            print(f"🔄 Processing batch {i//batch_size + 1}/{(len(contacts) + batch_size - 1)//batch_size}")
            
            for contact in batch:
                contact_id = contact[0]
                email = contact[1]
                phone = contact[2]
                company = contact[3]
                position = contact[4]
                profile_url = contact[5]
                email_verified = contact[6] or False
                phone_verified = contact[7] or False
                email_verification_score = contact[8]
                phone_verification_score = contact[9]
                enrichment_score = contact[10]
                is_disposable = contact[11] or False
                is_role_based = contact[12] or False
                is_catchall = contact[13] or False
                
                # Calculate new lead score and email reliability
                lead_score = calculate_lead_score(
                    email, phone, email_verified, phone_verified,
                    email_verification_score, phone_verification_score,
                    company, position, profile_url, enrichment_score
                )
                
                email_reliability = calculate_email_reliability(
                    email, email_verified, email_verification_score,
                    is_disposable, is_role_based, is_catchall
                )
                
                # Update the contact
                update_query = """
                    UPDATE contacts 
                    SET 
                        lead_score = %s,
                        email_reliability = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """
                
                cursor.execute(update_query, (lead_score, email_reliability, contact_id))
                updated_count += 1
                
                if updated_count % 50 == 0:
                    print(f"📊 Updated {updated_count} contacts...")
            
            # Commit after each batch
            conn.commit()
            print(f"✅ Committed batch {i//batch_size + 1}")
        
        print("=" * 50)
        print(f"🎯 RECALCULATION COMPLETE!")
        print(f"✅ Updated {updated_count} contacts with lead scores")
        print(f"📈 All contacts now have proper lead scores and email reliability")
        
        # Show some sample results
        print("\n📊 Sample of updated contacts:")
        cursor.execute("""
            SELECT id, email, lead_score, email_reliability 
            FROM contacts 
            WHERE lead_score > 0 
            ORDER BY lead_score DESC 
            LIMIT 5
        """)
        samples = cursor.fetchall()
        
        for sample in samples:
            print(f"   Contact {sample[0]}: {sample[1]} - Score: {sample[2]}, Reliability: {sample[3]}")
        
        cursor.close()
        conn.close()
        
        print("\n🚀 Your lead scores are now working!")
        print("💡 Check your CRM contacts page to see the results")
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        print("\n💡 Common solutions:")
        print("1. Make sure PostgreSQL is running")
        print("2. Check database connection settings in the script")
        print("3. Verify database name, username, and password")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 