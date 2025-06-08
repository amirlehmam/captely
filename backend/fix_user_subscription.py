#!/usr/bin/env python3
"""
Script to fix user subscription - add starter plan subscription
"""

import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database connection
DATABASE_URL = "postgresql+psycopg2://postgres:postgrespw@localhost:5432/postgres"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def fix_user_subscription():
    """Add starter subscription for the user"""
    db = SessionLocal()
    
    try:
        # User ID from logs
        user_id = "1feeef3b-fefe-403e-ae96-748bff6c5394"
        
        print(f"🔍 Checking subscription for user {user_id}")
        
        # Check if user already has a subscription
        result = db.execute(text("""
            SELECT id, package_id, status 
            FROM user_subscriptions 
            WHERE user_id = :user_id
        """), {"user_id": user_id})
        
        existing_sub = result.fetchone()
        if existing_sub:
            print(f"✅ User already has subscription: {existing_sub}")
            return
        
        # Get the starter package
        result = db.execute(text("""
            SELECT id, name, display_name, credits_monthly, price_monthly 
            FROM packages 
            WHERE name = 'starter' AND is_active = true
        """))
        
        starter_package = result.fetchone()
        if not starter_package:
            print("❌ Starter package not found. Creating it...")
            
            # Create starter package
            db.execute(text("""
                INSERT INTO packages (
                    name, display_name, plan_type, credits_monthly, 
                    price_monthly, price_annual, features, is_active
                ) VALUES (
                    'starter', 'Starter', 'starter', 500,
                    25.00, 240.00, '["500 credits per month", "Email enrichment", "Phone enrichment", "CSV import/export", "Chrome extension", "Basic support"]', 
                    true
                )
            """))
            
            # Get the newly created package
            result = db.execute(text("""
                SELECT id, name, display_name, credits_monthly, price_monthly 
                FROM packages 
                WHERE name = 'starter'
            """))
            starter_package = result.fetchone()
        
        print(f"📦 Found starter package: {starter_package}")
        
        # Create subscription for the user
        now = datetime.utcnow()
        period_end = now + timedelta(days=30)
        
        db.execute(text("""
            INSERT INTO user_subscriptions (
                user_id, package_id, billing_cycle, status,
                current_period_start, current_period_end,
                created_at, updated_at
            ) VALUES (
                :user_id, :package_id, 'monthly', 'active',
                :period_start, :period_end, :created_at, :updated_at
            )
        """), {
            "user_id": user_id,
            "package_id": starter_package[0],  # package ID
            "period_start": now,
            "period_end": period_end,
            "created_at": now,
            "updated_at": now
        })
        
        db.commit()
        print(f"✅ Created starter subscription for user {user_id}")
        
        # Verify the subscription was created
        result = db.execute(text("""
            SELECT us.id, us.status, p.name, p.display_name, p.credits_monthly
            FROM user_subscriptions us
            JOIN packages p ON us.package_id = p.id
            WHERE us.user_id = :user_id
        """), {"user_id": user_id})
        
        subscription = result.fetchone()
        print(f"🎉 Subscription created: {subscription}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_user_subscription() 