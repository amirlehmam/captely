#!/usr/bin/env python3
"""
Fix Stripe Price IDs for Captely Billing
This script will:
1. Connect to the database and get current packages
2. Create actual Stripe prices for each package
3. Update the database with the correct Stripe price IDs
"""

import os
import stripe
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from decimal import Decimal

# Set up Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    print("❌ Error: STRIPE_SECRET_KEY environment variable not set")
    print("Please set it with: export STRIPE_SECRET_KEY=sk_...")
    exit(1)

stripe.api_key = STRIPE_SECRET_KEY
print(f"✅ Stripe configured with key: {STRIPE_SECRET_KEY[:7]}...")

# Database connection
DATABASE_URL = "postgresql://captely:captely123@db-postgresql-fra1-42046-do-user-18496313-0.g.db.ondigitalocean.com:25060/captely"

def connect_db():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        exit(1)

def get_packages(conn):
    """Get all active packages from database"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, name, display_name, credits_monthly, price_monthly, price_annual,
                   stripe_price_id_monthly, stripe_price_id_annual, features
            FROM packages 
            WHERE is_active = true 
            ORDER BY credits_monthly
        """)
        return cur.fetchall()

def create_stripe_price(amount, interval, product_name, package_id, billing_cycle):
    """Create a Stripe price"""
    try:
        # Convert EUR to cents
        amount_cents = int(float(amount) * 100)
        
        print(f"Creating Stripe price: {product_name} - €{amount} {interval}ly")
        
        # Create Stripe price
        price = stripe.Price.create(
            unit_amount=amount_cents,
            currency="eur",
            recurring={"interval": interval},
            product_data={
                "name": f"{product_name} Plan",
                "description": f"Captely {product_name} subscription - {interval}ly billing"
            },
            metadata={
                "package_id": str(package_id),
                "billing_cycle": billing_cycle,
                "service": "captely-billing"
            }
        )
        
        print(f"✅ Created Stripe price: {price.id}")
        return price.id
        
    except Exception as e:
        print(f"❌ Failed to create Stripe price for {product_name}: {e}")
        return None

def update_package_price_ids(conn, package_id, monthly_price_id, annual_price_id):
    """Update package with Stripe price IDs"""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE packages 
                SET stripe_price_id_monthly = %s, stripe_price_id_annual = %s
                WHERE id = %s
            """, (monthly_price_id, annual_price_id, package_id))
        conn.commit()
        print(f"✅ Updated package {package_id} with price IDs")
        
    except Exception as e:
        print(f"❌ Failed to update package {package_id}: {e}")

def main():
    print("🚀 Starting Stripe Price ID Fix for Captely...")
    print()
    
    # Connect to database
    conn = connect_db()
    print("✅ Connected to database")
    
    # Get packages
    packages = get_packages(conn)
    print(f"📦 Found {len(packages)} active packages")
    print()
    
    for package in packages:
        print(f"Processing package: {package['display_name']} ({package['name']})")
        print(f"  Monthly: €{package['price_monthly']}")
        print(f"  Annual: €{package['price_annual']}")
        print(f"  Credits: {package['credits_monthly']}/month")
        
        # Skip enterprise packages (custom pricing)
        if package['name'] == 'enterprise':
            print("  Skipping enterprise package (custom pricing)")
            continue
        
        # Create monthly price
        monthly_price_id = None
        if package['price_monthly'] > 0:
            monthly_price_id = create_stripe_price(
                amount=package['price_monthly'],
                interval='month',
                product_name=package['display_name'],
                package_id=package['id'],
                billing_cycle='monthly'
            )
        
        # Create annual price
        annual_price_id = None
        if package['price_annual'] > 0:
            annual_price_id = create_stripe_price(
                amount=package['price_annual'],
                interval='year',
                product_name=package['display_name'],
                package_id=package['id'],
                billing_cycle='annual'
            )
        
        # Update database
        if monthly_price_id or annual_price_id:
            update_package_price_ids(conn, package['id'], monthly_price_id, annual_price_id)
        
        print()
    
    # Final verification
    print("🔍 Verifying updated packages...")
    updated_packages = get_packages(conn)
    
    for package in updated_packages:
        print(f"{package['display_name']}:")
        print(f"  Monthly Price ID: {package['stripe_price_id_monthly']}")
        print(f"  Annual Price ID: {package['stripe_price_id_annual']}")
        print()
    
    conn.close()
    print("✅ Stripe price fix completed successfully!")
    print()
    print("🎯 Next steps:")
    print("1. Test the billing flow in your app")
    print("2. Try clicking 'Buy this pack' - it should redirect to Stripe")
    print("3. Verify the prices match what you expect")

if __name__ == "__main__":
    main() 