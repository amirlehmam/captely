-- Create new billing schema with credit system
-- This replaces the old billing tables with the new credit-based system

-- Drop old tables if they exist
DROP TABLE IF EXISTS billing_transactions CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS credit_packages CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS enrichment_history CASCADE;
DROP TABLE IF EXISTS credit_allocations CASCADE;
DROP TABLE IF EXISTS credit_balances CASCADE;

-- Create enums
CREATE TYPE plan_type AS ENUM ('starter', 'pro', 'enterprise');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'cancelled', 'expired');
CREATE TYPE enrichment_type AS ENUM ('email', 'phone');
CREATE TYPE enrichment_status AS ENUM ('success', 'failed', 'cached');
CREATE TYPE enrichment_source AS ENUM ('internal', 'apollo', 'hunter', 'clearbit', 'zoominfo', 'lusha', 'snov');

-- Packages table with exact pricing structure
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Credit balances
CREATE TABLE credit_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    total_credits INTEGER DEFAULT 0,
    used_credits INTEGER DEFAULT 0,
    expired_credits INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit allocations (for FIFO tracking)
CREATE TABLE credit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    credits_allocated INTEGER NOT NULL,
    credits_remaining INTEGER NOT NULL,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    source VARCHAR NOT NULL,
    billing_cycle billing_cycle,
    subscription_id UUID
);

-- User subscriptions
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    package_id UUID NOT NULL REFERENCES packages(id),
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

-- Enrichment history
CREATE TABLE enrichment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Payment methods
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Billing transactions
CREATE TABLE billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Credit packages
CREATE TABLE credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    credits INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (simplified for billing)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    first_name VARCHAR,
    last_name VARCHAR,
    current_subscription_id UUID REFERENCES user_subscriptions(id),
    stripe_customer_id VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_credit_allocations_user_id ON credit_allocations(user_id);
CREATE INDEX idx_credit_allocations_expires_at ON credit_allocations(expires_at);
CREATE INDEX idx_enrichment_history_user_id ON enrichment_history(user_id);
CREATE INDEX idx_enrichment_history_created_at ON enrichment_history(created_at);
CREATE INDEX idx_billing_transactions_user_id ON billing_transactions(user_id);
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- Insert exact pricing plans as specified
INSERT INTO packages (name, display_name, plan_type, credits_monthly, price_monthly, price_annual, features, popular) VALUES

-- Starter Plan
('starter', 'Starter', 'starter', 500, 19.00, 182.40, 
 '["Import CSV files", "API enrichment", "Chrome extension", "Shared database access", "Standard support", "All platform features"]', 
 false),

-- Pro Plans (modular)
('pro-1k', 'Pro 1K', 'pro', 1000, 38.00, 364.80, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 false),

('pro-2k', 'Pro 2K', 'pro', 2000, 76.00, 729.60, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 false),

('pro-3k', 'Pro 3K', 'pro', 3000, 113.00, 1084.80, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 false),

('pro-5k', 'Pro 5K', 'pro', 5000, 186.00, 1785.60, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 true),

('pro-10k', 'Pro 10K', 'pro', 10000, 366.00, 3513.60, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 false),

('pro-15k', 'Pro 15K', 'pro', 15000, 542.00, 5203.20, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 false),

('pro-20k', 'Pro 20K', 'pro', 20000, 701.00, 6729.60, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 false),

('pro-30k', 'Pro 30K', 'pro', 30000, 1018.00, 9772.80, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 false),

('pro-50k', 'Pro 50K', 'pro', 50000, 1683.00, 16156.80, 
 '["All Starter features", "Modular credit volumes", "Priority support", "Advanced analytics", "Bulk operations", "Custom integrations"]', 
 false),

-- Enterprise Plan
('enterprise', 'Enterprise', 'enterprise', 0, 0.00, 0.00, 
 '["All Pro features", "Custom credit volumes", "SSO integration", "Enhanced security", "Dedicated support", "Custom API endpoints", "White-label options"]', 
 false);

-- Insert some credit packages
INSERT INTO credit_packages (name, credits, price, discount_percentage, popular) VALUES
('Small Top-up', 1000, 10.00, 0, false),
('Medium Top-up', 5000, 40.00, 20, true),
('Large Top-up', 15000, 100.00, 33, false),
('Mega Top-up', 50000, 300.00, 40, false);

-- Insert test user if not exists
INSERT INTO users (id, email, first_name, last_name) 
VALUES ('00000000-0000-0000-0002-000000000001', 'test@captely.com', 'Test', 'User')
ON CONFLICT (email) DO NOTHING;

-- Create test subscription and credit allocation
DO $$
DECLARE
    test_user_id UUID := '00000000-0000-0000-0002-000000000001';
    pro_5k_package_id UUID;
    test_subscription_id UUID;
BEGIN
    -- Get Pro 5K package ID
    SELECT id INTO pro_5k_package_id FROM packages WHERE name = 'pro-5k';
    
    -- Create test subscription
    INSERT INTO user_subscriptions (
        id, user_id, package_id, billing_cycle, status,
        current_period_start, current_period_end
    ) VALUES (
        gen_random_uuid(), test_user_id, pro_5k_package_id, 'monthly', 'active',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days'
    ) RETURNING id INTO test_subscription_id;
    
    -- Create credit balance
    INSERT INTO credit_balances (user_id, total_credits, used_credits, expired_credits)
    VALUES (test_user_id, 15000, 8240, 120)
    ON CONFLICT (user_id) DO UPDATE SET
        total_credits = 15000,
        used_credits = 8240,
        expired_credits = 120;
    
    -- Create credit allocations (3 months)
    INSERT INTO credit_allocations (user_id, credits_allocated, credits_remaining, expires_at, source, billing_cycle, subscription_id) VALUES
    (test_user_id, 5000, 1200, CURRENT_TIMESTAMP + INTERVAL '1 month', 'subscription', 'monthly', test_subscription_id),
    (test_user_id, 5000, 2560, CURRENT_TIMESTAMP + INTERVAL '2 months', 'subscription', 'monthly', test_subscription_id),
    (test_user_id, 5000, 3000, CURRENT_TIMESTAMP + INTERVAL '3 months', 'subscription', 'monthly', test_subscription_id);
    
    -- Create sample enrichment history
    INSERT INTO enrichment_history (user_id, contact_name, contact_email, enrichment_type, status, source, result_data, credits_used) VALUES
    (test_user_id, 'John Smith', 'john@techcorp.com', 'email', 'success', 'apollo', 'john.smith@techcorp.com', 1),
    (test_user_id, 'Sarah Johnson', 'sarah@marketingco.com', 'phone', 'success', 'hunter', '+1-555-0123', 10),
    (test_user_id, 'Mike Chen', 'mike@techstart.io', 'email', 'cached', 'internal', 'mike@techstart.io', 1),
    (test_user_id, 'Alice Brown', NULL, 'phone', 'failed', 'clearbit', NULL, 0);
    
    -- Create sample transaction
    INSERT INTO billing_transactions (user_id, subscription_id, type, amount, currency, status, description, credits_added) VALUES
    (test_user_id, test_subscription_id, 'subscription', 186.00, 'EUR', 'succeeded', 'Pro 5K Monthly Subscription', 5000);
    
END $$; 