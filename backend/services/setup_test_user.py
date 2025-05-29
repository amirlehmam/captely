import asyncio
import asyncpg
from datetime import datetime, timezone
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgrespw@localhost:5432/postgres')

async def setup_test_user():
    """Create a test user with enterprise package"""
    
    # Connect to database
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Create test user
        email = "test@captely.com"
        password = "TestUser123!"
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Check if user exists
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", email)
        
        if existing:
            user_id = existing['id']
            print(f"User already exists with ID: {user_id}")
        else:
            # Create new user
            user_id = await conn.fetchval("""
                INSERT INTO users (email, password, first_name, last_name, is_active, is_verified, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            """, email, hashed_password.decode('utf-8'), "Test", "User", True, True, datetime.now(timezone.utc), datetime.now(timezone.utc))
            print(f"Created user with ID: {user_id}")
        
        # Check if packages exist, if not create them
        packages = await conn.fetch("SELECT * FROM billing_packages")
        if not packages:
            print("Creating billing packages...")
            
            # Create packages
            packages_data = [
                ('free', 'Free', 0, 0, 100, 50, '{"enrichment_providers": ["icypeas"], "imports_per_month": 1, "export_formats": ["csv"], "support_level": "basic"}'),
                ('starter', 'Starter', 9.99, 99.99, 1000, 500, '{"enrichment_providers": ["icypeas", "dropcontact", "hunter"], "imports_per_month": 10, "export_formats": ["csv", "excel"], "support_level": "priority", "team_members": 1}'),
                ('professional', 'Professional', 49.99, 499.99, 5000, 2000, '{"enrichment_providers": ["all"], "imports_per_month": null, "export_formats": ["csv", "excel", "json"], "support_level": "priority", "team_members": 5, "api_access": true, "custom_integrations": true, "credit_rollover": true}'),
                ('enterprise', 'Enterprise', 199.99, 1999.99, 20000, 10000, '{"enrichment_providers": ["all"], "imports_per_month": null, "export_formats": ["all"], "support_level": "dedicated", "team_members": null, "api_access": true, "custom_integrations": true, "credit_rollover": true, "sla": true, "custom_features": true}')
            ]
            
            for pkg_data in packages_data:
                await conn.execute("""
                    INSERT INTO billing_packages (name, display_name, price_monthly, price_yearly, credits_monthly, daily_enrichment_limit, features, created_at, updated_at, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
                """, *pkg_data, datetime.now(timezone.utc), datetime.now(timezone.utc), True)
            
            print("Created billing packages")
        
        # Get enterprise package
        enterprise_pkg = await conn.fetchrow("SELECT * FROM billing_packages WHERE name = 'enterprise'")
        
        # Check existing subscription
        existing_sub = await conn.fetchrow("""
            SELECT * FROM billing_subscriptions 
            WHERE user_id = $1 AND status IN ('active', 'trialing')
        """, user_id)
        
        if existing_sub:
            print(f"User already has an active subscription")
            # Update to enterprise if not already
            if existing_sub['package_id'] != enterprise_pkg['id']:
                await conn.execute("""
                    UPDATE billing_subscriptions 
                    SET package_id = $1, updated_at = $2
                    WHERE id = $3
                """, enterprise_pkg['id'], datetime.now(timezone.utc), existing_sub['id'])
                print("Updated subscription to Enterprise")
        else:
            # Create enterprise subscription
            subscription_id = await conn.fetchval("""
                INSERT INTO billing_subscriptions (
                    user_id, package_id, status, billing_cycle, 
                    current_period_start, current_period_end,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            """, user_id, enterprise_pkg['id'], 'active', 'monthly',
                datetime.now(timezone.utc), datetime(2025, 6, 29, tzinfo=timezone.utc),
                datetime.now(timezone.utc), datetime.now(timezone.utc))
            print(f"Created enterprise subscription: {subscription_id}")
        
        # Set credit balance
        existing_balance = await conn.fetchrow("SELECT * FROM credit_balances WHERE user_id = $1", user_id)
        
        if existing_balance:
            # Update existing balance
            await conn.execute("""
                UPDATE credit_balances 
                SET balance = $1, 
                    limit_daily = $2,
                    limit_monthly = $3,
                    updated_at = $4
                WHERE user_id = $5
            """, 20000, 10000, 20000, datetime.now(timezone.utc), user_id)
            print("Updated credit balance to 20,000 credits")
        else:
            # Create credit balance
            await conn.execute("""
                INSERT INTO credit_balances (
                    user_id, balance, limit_daily, limit_monthly,
                    used_today, used_this_month, last_reset_at,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, user_id, 20000, 10000, 20000, 0, 0, 
                datetime.now(timezone.utc), datetime.now(timezone.utc), datetime.now(timezone.utc))
            print("Created credit balance with 20,000 credits")
        
        # Add some sample credit history
        await conn.execute("""
            INSERT INTO credit_transactions (
                user_id, amount, type, provider, description,
                metadata, created_at
            ) VALUES 
            ($1, 20000, 'topup', 'system', 'Enterprise package allocation', '{"package": "enterprise"}'::jsonb, $2),
            ($1, -50, 'enrichment', 'icypeas', 'Lead enrichment - 50 leads', '{"job_id": "sample-001"}'::jsonb, $3),
            ($1, -25, 'enrichment', 'dropcontact', 'Email verification - 25 emails', '{"job_id": "sample-002"}'::jsonb, $4)
        """, user_id, datetime.now(timezone.utc), datetime.now(timezone.utc), datetime.now(timezone.utc))
        
        print("\n✅ Test user setup complete!")
        print(f"📧 Email: {email}")
        print(f"🔑 Password: {password}")
        print(f"💎 Package: Enterprise (20,000 credits/month)")
        print(f"💰 Current Balance: 20,000 credits")
        print("\nYou can now login with these credentials!")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(setup_test_user()) 