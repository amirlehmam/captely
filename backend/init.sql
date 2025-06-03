-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    phone VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    credits INTEGER DEFAULT 100,
    total_spent FLOAT DEFAULT 0,
    daily_limit INTEGER DEFAULT NULL,
    monthly_limit INTEGER DEFAULT NULL,
    provider_limits JSONB DEFAULT NULL,
    notification_preferences JSONB DEFAULT NULL,
    last_credit_alert TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    current_subscription_id UUID,
    credits_purchased INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    company_name VARCHAR(255),
    company_size VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    key VARCHAR(255) NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Import Jobs table for tracking CSV imports
CREATE TABLE IF NOT EXISTS import_jobs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processing',
    total INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    file_name VARCHAR(255),
    mapping JSONB DEFAULT '{}',
    type VARCHAR(50) DEFAULT 'csv',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Contacts table for storing enriched leads
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) REFERENCES import_jobs(id),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    position VARCHAR(255),
    company VARCHAR(255),
    company_domain VARCHAR(255),
    profile_url TEXT,
    location VARCHAR(255),
    industry VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    enriched BOOLEAN DEFAULT FALSE,
    enrichment_status VARCHAR(50) DEFAULT 'pending',
    enrichment_provider VARCHAR(50),
    enrichment_score FLOAT,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verification_score FLOAT DEFAULT 0,
    email_verification_level INTEGER DEFAULT 0,
    is_disposable BOOLEAN DEFAULT FALSE,
    is_role_based BOOLEAN DEFAULT FALSE,
    is_catchall BOOLEAN DEFAULT FALSE,
    phone_type VARCHAR(20), -- 'mobile', 'landline', 'voip', 'unknown'
    phone_country VARCHAR(5), -- country code
    credits_consumed INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enrichment results for tracking results from different providers
CREATE TABLE IF NOT EXISTS enrichment_results (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id),
    provider VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(255),
    confidence_score FLOAT,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    raw_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Credit logs for tracking all credit transactions
CREATE TABLE IF NOT EXISTS credit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) DEFAULT NULL,
    provider VARCHAR(50) DEFAULT NULL,
    operation_type VARCHAR(50) NOT NULL, -- 'enrichment', 'verification', 'topup'
    cost FLOAT NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    details JSONB DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    change INTEGER DEFAULT 0,
    reason VARCHAR(255) DEFAULT NULL
);

-- Notification logs for tracking email notifications
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    subject VARCHAR(500),
    status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'sent', 'delivered', 'failed'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMP DEFAULT NULL,
    error_message TEXT DEFAULT NULL
);

-- Export logs for tracking data exports
CREATE TABLE IF NOT EXISTS export_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    job_id VARCHAR(255) REFERENCES import_jobs(id),
    export_type VARCHAR(50) NOT NULL, -- 'csv', 'excel', 'hubspot', 'lemlist', etc.
    export_format VARCHAR(50),
    status VARCHAR(50) DEFAULT 'processing',
    file_url VARCHAR(500) DEFAULT NULL,
    export_config JSONB DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP DEFAULT NULL
);

-- Packages/Plans table
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
    credits_monthly INTEGER NOT NULL DEFAULT 0,
    credits_rollover BOOLEAN DEFAULT FALSE,
    features JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES packages(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP NOT NULL,
    trial_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    provider VARCHAR(50),
    provider_customer_id VARCHAR(255),
    provider_payment_method_id VARCHAR(255),
    last_four VARCHAR(4),
    brand VARCHAR(50),
    exp_month INTEGER,
    exp_year INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Credit packages for one-time purchases
CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    price_per_credit DECIMAL(10,4) GENERATED ALWAYS AS (price / credits) STORED,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- CRM Contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id),
    external_id VARCHAR(255),
    crm_provider VARCHAR(50),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    position VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new',
    lead_score INTEGER DEFAULT 0,
    deal_value DECIMAL(10,2),
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    last_contacted_at TIMESTAMP,
    last_activity_at TIMESTAMP,
    next_follow_up TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, email)
);

-- CRM Activities table
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'task', 'note', 'follow_up')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'overdue')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CRM Campaigns table
CREATE TABLE IF NOT EXISTS crm_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'email',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Integration configurations
CREATE TABLE IF NOT EXISTS integration_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    config JSONB DEFAULT '{}',
    field_mappings JSONB DEFAULT '{}',
    sync_enabled BOOLEAN DEFAULT FALSE,
    sync_direction VARCHAR(20) DEFAULT 'both',
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    job_completion_alerts BOOLEAN DEFAULT TRUE,
    credit_warnings BOOLEAN DEFAULT TRUE,
    weekly_summary BOOLEAN DEFAULT TRUE,
    low_credit_threshold INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize Captely Database

-- Insert default packages
INSERT INTO packages (id, name, display_name, price_monthly, price_yearly, credits_monthly, features, limits, is_active) VALUES
    ('00000000-0000-0000-0000-000000000001', 'free', 'Free Tier', 0, 0, 100, '{"basic_enrichment": true, "export_csv": true}', '{"daily_enrichment": 50}', true),
    ('00000000-0000-0000-0000-000000000002', 'starter', 'Starter', 49, 468, 1000, '{"advanced_enrichment": true, "export_all": true, "api_access": true}', '{"daily_enrichment": 500}', true),
    ('00000000-0000-0000-0000-000000000003', 'professional', 'Professional', 149, 1428, 5000, '{"priority_support": true, "custom_integrations": true, "bulk_operations": true}', '{"daily_enrichment": 2000}', true),
    ('00000000-0000-0000-0000-000000000004', 'enterprise', 'Enterprise', 499, 4788, 20000, '{"dedicated_support": true, "custom_features": true, "unlimited_integrations": true}', '{"daily_enrichment": 10000}', true)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    credits_monthly = EXCLUDED.credits_monthly,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits;

-- Insert credit packages
INSERT INTO credit_packages (id, name, credits, price, is_active) VALUES
    ('00000000-0000-0000-0001-000000000001', '1,000 Credits', 1000, 10, true),
    ('00000000-0000-0000-0001-000000000002', '5,000 Credits', 5000, 45, true),
    ('00000000-0000-0000-0001-000000000003', '10,000 Credits', 10000, 80, true),
    ('00000000-0000-0000-0001-000000000004', '50,000 Credits', 50000, 350, true),
    ('00000000-0000-0000-0001-000000000005', '100,000 Credits', 100000, 600, true)
ON CONFLICT (id) DO NOTHING;

-- Create test user with enterprise package
-- Email: test@captely.com
-- Password: TestUser123! (bcrypt hash)
INSERT INTO users (
    id, 
    email, 
    password_hash,
    first_name,
    last_name,
    company,
    phone,
    is_active,
    created_at, 
    updated_at, 
    credits,
    onboarding_completed,
    company_name,
    current_subscription_id
) VALUES (
    '00000000-0000-0000-0002-000000000001',
    'test@captely.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGGS6oKgo7K',
    'Test',
    'User',
    'Test Company',
    '+1234567890',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    20000,
    true,
    'Test Company',
    '00000000-0000-0000-0003-000000000001'
) ON CONFLICT (email) DO UPDATE SET
    first_name = 'Test',
    last_name = 'User',
    company = 'Test Company',
    phone = '+1234567890',
    is_active = true,
    credits = 20000,
    onboarding_completed = true,
    current_subscription_id = '00000000-0000-0000-0003-000000000001';

-- Add enterprise subscription for test user
INSERT INTO user_subscriptions (
    id,
    user_id,
    package_id,
    status,
    billing_cycle,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0000-000000000004',
    'active',
    'monthly',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    current_period_end = CURRENT_TIMESTAMP + INTERVAL '30 days';

-- Update user's current subscription
UPDATE users 
SET current_subscription_id = '00000000-0000-0000-0003-000000000001'
WHERE id = '00000000-0000-0000-0002-000000000001';

-- Log initial credits
INSERT INTO credit_logs (
    user_id,
    operation_type,
    cost,
    change,
    reason,
    created_at
) VALUES (
    '00000000-0000-0000-0002-000000000001',
    'topup',
    0,
    20000,
    'Initial enterprise package credits',
    CURRENT_TIMESTAMP
);

-- Add some sample notification preferences for test user
INSERT INTO notification_preferences (
    user_id,
    email_notifications,
    job_completion_alerts,
    credit_warnings,
    weekly_summary,
    low_credit_threshold
) VALUES (
    '00000000-0000-0000-0002-000000000001',
    true,
    true,
    true,
    true,
    1000
) ON CONFLICT (user_id) DO NOTHING;

-- Create indexes for CRM tables (for better performance)
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON crm_contacts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_status ON crm_activities(status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_type ON crm_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_created_at ON crm_campaigns(created_at DESC);

-- Insert sample CRM data for testing
INSERT INTO crm_contacts (id, user_id, first_name, last_name, email, phone, company, position, status, lead_score) VALUES
    ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0002-000000000001', 'John', 'Smith', 'john@techcorp.com', '+1-555-0101', 'TechCorp Inc.', 'CEO', 'qualified', 85),
    ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0002-000000000001', 'Sarah', 'Johnson', 'sarah@marketingco.com', '+1-555-0102', 'Marketing Co.', 'VP Marketing', 'contacted', 70),
    ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0002-000000000001', 'Mike', 'Chen', 'mike@techstart.io', '+1-555-0103', 'TechStart', 'CTO', 'new', 60),
    ('00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0002-000000000001', 'Lisa', 'Wong', 'lisa@datacorp.com', '+1-555-0104', 'DataCorp', 'Data Scientist', 'customer', 95),
    ('00000000-0000-0000-0004-000000000005', '00000000-0000-0000-0002-000000000001', 'David', 'Brown', 'david@salesforce.example', '+1-555-0105', 'SalesForce Pro', 'Sales Director', 'new', 45)
ON CONFLICT (user_id, email) DO NOTHING;

-- Insert sample CRM activities
INSERT INTO crm_activities (id, type, title, description, contact_id, status, priority, due_date, created_by, assigned_to) VALUES
    ('00000000-0000-0000-0005-000000000001', 'call', 'Follow-up call with John Smith', 'Discuss pricing and next steps for enterprise plan', '00000000-0000-0000-0004-000000000001', 'pending', 'high', NOW() + INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000002', 'email', 'Send proposal to Sarah Johnson', 'Include custom integration details and timeline', '00000000-0000-0000-0004-000000000002', 'completed', 'medium', NOW() - INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000003', 'meeting', 'Product demo with TechStart team', 'Showcase new features and answer technical questions', '00000000-0000-0000-0004-000000000003', 'pending', 'high', NOW() + INTERVAL '3 days', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000004', 'task', 'Prepare contract for Enterprise deal', 'Include custom terms discussed in last meeting', NULL, 'overdue', 'urgent', NOW() - INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000005', 'follow_up', 'Check in with trial users', 'Send feedback survey and offer support', NULL, 'pending', 'low', NOW() + INTERVAL '7 days', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000006', 'note', 'Client feedback on latest features', 'Positive response to new dashboard, requested mobile app', '00000000-0000-0000-0004-000000000004', 'completed', 'medium', NULL, 'test_user', 'test_user')
ON CONFLICT (id) DO NOTHING;

-- Insert sample CRM campaigns
INSERT INTO crm_campaigns (id, name, type, status, from_email, from_name, total_contacts, sent_count, open_count, click_count, reply_count) VALUES
    ('00000000-0000-0000-0006-000000000001', 'Q2 Product Launch Campaign', 'email', 'active', 'marketing@captely.com', 'Captely Marketing', 1500, 1200, 420, 85, 24),
    ('00000000-0000-0000-0006-000000000002', 'Enterprise Outreach', 'email', 'active', 'sales@captely.com', 'Captely Sales', 300, 280, 145, 32, 8),
    ('00000000-0000-0000-0006-000000000003', 'Customer Feedback Survey', 'email', 'completed', 'success@captely.com', 'Captely Success', 850, 850, 380, 127, 89),
    ('00000000-0000-0000-0006-000000000004', 'New Feature Announcement', 'email', 'draft', 'product@captely.com', 'Captely Product', 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;
