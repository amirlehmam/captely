-- =====================================================
-- CAPTELY BILLING SERVICE DATABASE MIGRATION
-- =====================================================
-- This script creates all tables and data for the billing service
-- Run with: docker exec -i captely-db psql -U postgres -d postgres < billing_service_migration.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

-- Plan types
DO $$ BEGIN
    CREATE TYPE plan_type AS ENUM ('starter', 'pro', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Billing cycles
DO $$ BEGIN
    CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Subscription statuses
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enrichment types
DO $$ BEGIN
    CREATE TYPE enrichment_type AS ENUM ('email', 'phone');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enrichment statuses
DO $$ BEGIN
    CREATE TYPE enrichment_status AS ENUM ('success', 'failed', 'cached');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enrichment sources
DO $$ BEGIN
    CREATE TYPE enrichment_source AS ENUM ('internal', 'apollo', 'hunter', 'clearbit', 'zoominfo', 'lusha', 'snov', 'enrow', 'icypeas', 'datagma');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLES
-- =====================================================

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    display_name VARCHAR NOT NULL,
    plan_type plan_type NOT NULL,
    credits_monthly INTEGER NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_annual DECIMAL(10,2) NOT NULL,
    features TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    package_id UUID REFERENCES packages(id),
    billing_cycle billing_cycle NOT NULL,
    status subscription_status DEFAULT 'trial',
    stripe_subscription_id VARCHAR,
    stripe_customer_id VARCHAR,
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit balances table
CREATE TABLE IF NOT EXISTS credit_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    total_credits INTEGER DEFAULT 0,
    used_credits INTEGER DEFAULT 0,
    expired_credits INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit allocations table
CREATE TABLE IF NOT EXISTS credit_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    credits_allocated INTEGER NOT NULL,
    credits_remaining INTEGER NOT NULL,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    source VARCHAR NOT NULL,
    billing_cycle billing_cycle,
    subscription_id UUID REFERENCES user_subscriptions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enrichment history table
CREATE TABLE IF NOT EXISTS enrichment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    contact_id UUID,
    contact_name VARCHAR,
    contact_email VARCHAR,
    enrichment_type enrichment_type NOT NULL,
    status enrichment_status NOT NULL,
    source enrichment_source NOT NULL,
    result_data TEXT,
    credits_used INTEGER DEFAULT 0,
    batch_id UUID,
    api_request_id VARCHAR,
    ip_address VARCHAR,
    user_agent VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type VARCHAR NOT NULL,
    provider VARCHAR NOT NULL,
    provider_payment_method_id VARCHAR NOT NULL,
    provider_customer_id VARCHAR,
    last_four VARCHAR,
    brand VARCHAR,
    exp_month INTEGER,
    exp_year INTEGER,
    payment_metadata TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Billing transactions table
CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    subscription_id UUID REFERENCES user_subscriptions(id),
    payment_method_id UUID REFERENCES payment_methods(id),
    type VARCHAR NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR DEFAULT 'EUR',
    status VARCHAR NOT NULL,
    provider VARCHAR,
    provider_transaction_id VARCHAR,
    provider_fee DECIMAL(10,2),
    description VARCHAR,
    transaction_metadata TEXT,
    failure_reason VARCHAR,
    credits_added INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit packages table (for one-time credit purchases)
CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    credits INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Credit balances indexes
CREATE INDEX IF NOT EXISTS idx_credit_balances_user_id ON credit_balances(user_id);

-- Credit allocations indexes
CREATE INDEX IF NOT EXISTS idx_credit_allocations_user_id ON credit_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_allocations_expires_at ON credit_allocations(expires_at);

-- Enrichment history indexes
CREATE INDEX IF NOT EXISTS idx_enrichment_history_user_id ON enrichment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_history_created_at ON enrichment_history(created_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_history_batch_id ON enrichment_history(batch_id);

-- Payment methods indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_provider_id ON payment_methods(provider_payment_method_id);

-- Billing transactions indexes
CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_id ON billing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_created_at ON billing_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_provider_id ON billing_transactions(provider_transaction_id);

-- =====================================================
-- DEFAULT PACKAGES DATA
-- =====================================================

-- Insert default packages
INSERT INTO packages (name, display_name, plan_type, credits_monthly, price_monthly, price_annual, features, is_active, popular) 
VALUES 
    (
        'starter',
        'Starter',
        'starter',
        500,
        25.00,
        240.00,
        '["500 credits per month", "Email enrichment", "Phone enrichment", "CSV import/export", "Chrome extension", "Basic support"]',
        TRUE,
        FALSE
    ),
    (
        'pro-1k',
        'Pro 1K',
        'pro',
        1000,
        49.00,
        470.40,
        '["1000 credits per month", "All Starter features", "Advanced analytics", "Priority support", "API access", "Custom integrations"]',
        TRUE,
        FALSE
    ),
    (
        'pro-3k',
        'Pro 3K',
        'pro',
        3000,
        129.00,
        1238.40,
        '["3000 credits per month", "All Pro 1K features", "Bulk operations", "Advanced filters", "CRM integrations", "Dedicated support"]',
        TRUE,
        TRUE
    ),
    (
        'pro-5k',
        'Pro 5K',
        'pro',
        5000,
        199.00,
        1910.40,
        '["5000 credits per month", "All Pro 3K features", "White-label options", "Custom workflows", "Team collaboration", "Premium support"]',
        TRUE,
        FALSE
    ),
    (
        'enterprise',
        'Enterprise',
        'enterprise',
        0,
        0.00,
        0.00,
        '["Custom credit allocation", "All Pro features", "SSO integration", "Advanced security", "Custom SLA", "Dedicated account manager"]',
        TRUE,
        FALSE
    )
ON CONFLICT (name) DO NOTHING;

-- Insert default credit packages (for one-time purchases)
INSERT INTO credit_packages (name, credits, price, discount_percentage, is_active, popular)
VALUES 
    ('Small Pack', 100, 15.00, 0, TRUE, FALSE),
    ('Medium Pack', 500, 65.00, 13, TRUE, FALSE),
    ('Large Pack', 1000, 120.00, 20, TRUE, TRUE),
    ('Mega Pack', 2500, 275.00, 25, TRUE, FALSE),
    ('Ultra Pack', 5000, 500.00, 30, TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_packages_updated_at ON packages;
CREATE TRIGGER update_packages_updated_at 
    BEFORE UPDATE ON packages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at 
    BEFORE UPDATE ON user_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_balances_updated_at ON credit_balances;
CREATE TRIGGER update_credit_balances_updated_at 
    BEFORE UPDATE ON credit_balances 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at 
    BEFORE UPDATE ON payment_methods 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_transactions_updated_at ON billing_transactions;
CREATE TRIGGER update_billing_transactions_updated_at 
    BEFORE UPDATE ON billing_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show created tables
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename IN (
    'packages', 
    'user_subscriptions', 
    'credit_balances', 
    'credit_allocations', 
    'enrichment_history', 
    'payment_methods', 
    'billing_transactions', 
    'credit_packages'
)
ORDER BY tablename;

-- Show package data
SELECT 
    name,
    display_name,
    plan_type,
    credits_monthly,
    price_monthly,
    price_annual,
    popular
FROM packages 
ORDER BY credits_monthly;

-- Show credit packages
SELECT 
    name,
    credits,
    price,
    discount_percentage,
    popular
FROM credit_packages 
ORDER BY credits;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Output success message
DO $$
BEGIN
    RAISE NOTICE '✅ Captely Billing Service migration completed successfully!';
    RAISE NOTICE '📊 Created % packages and % credit packages', 
        (SELECT COUNT(*) FROM packages),
        (SELECT COUNT(*) FROM credit_packages);
    RAISE NOTICE '🎯 Next steps:';
    RAISE NOTICE '1. Configure Stripe webhooks: https://yourdomain.com/api/webhooks/stripe';
    RAISE NOTICE '2. Set STRIPE_WEBHOOK_SECRET in your environment';
    RAISE NOTICE '3. Test billing endpoints';
END $$; 