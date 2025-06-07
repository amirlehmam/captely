#!/usr/bin/env python3
"""
Database initialization script for Captely Billing Service
Creates all necessary tables and initializes default data
"""

import os
import sys
import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

try:
    from app.models import Base, Package, PlanType
except ImportError:
    print("Error importing models. Make sure you're running this from the billing service directory.")
    sys.exit(1)

def get_database_url():
    """Get database URL from environment variables"""
    return os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgrespw@localhost:5432/postgres"
    ).replace("postgresql+asyncpg://", "postgresql://")  # Use sync driver for setup

def create_database_tables():
    """Create all database tables"""
    print("Creating database tables...")
    
    try:
        engine = create_engine(get_database_url())
        Base.metadata.create_all(engine)
        print("✅ Database tables created successfully")
        return engine
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
        return None

def initialize_default_packages(engine):
    """Initialize default subscription packages"""
    print("Initializing default packages...")
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Check if packages already exist
        existing_count = session.query(Package).count()
        if existing_count > 0:
            print(f"⚠️  Packages already exist ({existing_count} found), skipping initialization")
            return
        
        # Default package configurations
        default_packages = [
            {
                "name": "starter",
                "display_name": "Starter",
                "plan_type": PlanType.starter,
                "credits_monthly": 500,
                "price_monthly": 25.00,
                "price_annual": 240.00,
                "features": ["500 credits per month", "Email enrichment", "Phone enrichment", "CSV import/export", "Chrome extension", "Basic support"],
                "is_active": True,
                "popular": False
            },
            {
                "name": "pro-3k",
                "display_name": "Pro 3K",
                "plan_type": PlanType.pro,
                "credits_monthly": 3000,
                "price_monthly": 129.00,
                "price_annual": 1238.40,
                "features": ["3000 credits per month", "All Starter features", "Advanced analytics", "Priority support", "API access", "Custom integrations"],
                "is_active": True,
                "popular": True
            }
        ]
        
        # Create package records
        for pkg_data in default_packages:
            package = Package(
                name=pkg_data["name"],
                display_name=pkg_data["display_name"],
                plan_type=pkg_data["plan_type"],
                credits_monthly=pkg_data["credits_monthly"],
                price_monthly=pkg_data["price_monthly"],
                price_annual=pkg_data["price_annual"],
                features=json.dumps(pkg_data["features"]),
                is_active=pkg_data["is_active"],
                popular=pkg_data["popular"]
            )
            session.add(package)
        
        session.commit()
        print(f"✅ Successfully created {len(default_packages)} default packages")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error initializing packages: {e}")
    finally:
        session.close()

def create_stripe_specific_tables(engine):
    """Create any Stripe-specific database extensions"""
    print("Setting up Stripe-specific database configurations...")
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create indexes for better performance
        session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_id 
            ON user_subscriptions(stripe_subscription_id);
        """))
        
        session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id 
            ON payment_methods(user_id);
        """))
        
        session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_id 
            ON billing_transactions(user_id);
        """))
        
        session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_credit_allocations_user_id 
            ON credit_allocations(user_id);
        """))
        
        session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_enrichment_history_user_id 
            ON enrichment_history(user_id);
        """))
        
        session.commit()
        print("✅ Database indexes created successfully")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error creating database indexes: {e}")
    finally:
        session.close()

def verify_stripe_configuration():
    """Verify that Stripe environment variables are configured"""
    print("Verifying Stripe configuration...")
    
    stripe_secret = os.getenv("STRIPE_SECRET_KEY")
    stripe_publishable = os.getenv("STRIPE_PUBLISHABLE_KEY")
    
    if not stripe_secret:
        print("⚠️  STRIPE_SECRET_KEY not found in environment variables")
        return False
    
    if not stripe_publishable:
        print("⚠️  STRIPE_PUBLISHABLE_KEY not found in environment variables")
        return False
    
    if stripe_secret.startswith("sk_test_"):
        print("🧪 Using Stripe TEST keys")
    elif stripe_secret.startswith("sk_live_"):
        print("🔴 Using Stripe LIVE keys")
    else:
        print("⚠️  Invalid Stripe secret key format")
        return False
    
    print("✅ Stripe configuration verified")
    return True

def main():
    """Main initialization function"""
    print("🚀 Initializing Captely Billing Service Database...")
    
    # Create database tables
    engine = create_database_tables()
    if not engine:
        print("❌ Failed to create database tables")
        sys.exit(1)
    
    # Initialize default packages
    initialize_default_packages(engine)
    
    # Create Stripe-specific optimizations
    create_stripe_specific_tables(engine)
    
    print("✅ Billing service database initialization completed!")

if __name__ == "__main__":
    main() 