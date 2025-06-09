-- =============================================
-- Captely Database Initialization Script
-- Consolidates ALL migration functionality into one file
-- =============================================

-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Test comment to see if file is created

-- =============================================
-- CREATE ENUM TYPES FOR CRM (Critical for CRM service)
-- =============================================
DO $$
BEGIN
    CREATE TYPE activitytype AS ENUM ('call', 'email', 'meeting', 'task', 'note', 'follow_up');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE activitystatus AS ENUM ('pending', 'completed', 'cancelled', 'overdue');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE campaignstatus AS ENUM ('draft', 'active', 'paused', 'completed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE contactstatus AS ENUM ('new', 'contacted', 'qualified', 'customer', 'lost');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- CREATE BILLING ENUM TYPES
-- =============================================
DO $$
BEGIN
    CREATE TYPE plan_type AS ENUM ('starter', 'pro', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE enrichment_type AS ENUM ('email', 'phone');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE enrichment_status AS ENUM ('success', 'failed', 'cached');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE enrichment_source AS ENUM ('internal', 'apollo', 'hunter', 'clearbit', 'zoominfo', 'lusha', 'snov');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- USERS TABLE WITH COMPLETE OAUTH SUPPORT
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- Made nullable for OAuth users
    -- Profile fields
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    phone VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    -- OAuth support fields (CRITICAL FOR AUTH TO WORK)
    auth_provider VARCHAR(20) DEFAULT 'email', -- 'email', 'google', 'apple'
    google_id VARCHAR(255), -- Google user ID for OAuth
    apple_id VARCHAR(255), -- Apple user ID for OAuth
    email_verified BOOLEAN DEFAULT FALSE,
    profile_picture_url TEXT, -- OAuth profile picture URL
    -- Credit and billing fields
    credits INTEGER DEFAULT 100,
    total_spent DECIMAL(10,2) DEFAULT 0,
    daily_limit INTEGER DEFAULT NULL,
    monthly_limit INTEGER DEFAULT NULL,
    provider_limits JSONB DEFAULT NULL,
    notification_preferences JSONB DEFAULT NULL,
    last_credit_alert TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Subscription fields
    current_subscription_id UUID,
    credits_purchased INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    company_name VARCHAR(255),
    company_size VARCHAR(50),
    -- Plan field for billing compatibility
    plan VARCHAR(50) DEFAULT 'pack-500'
);

-- =============================================
-- EMAIL VERIFICATION TABLE (ESSENTIAL)
-- =============================================
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- API KEYS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    key VARCHAR(255) NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- IMPORT JOBS TABLE
-- =============================================
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

-- =============================================
-- CONTACTS TABLE WITH ALL ENRICHMENT FIELDS
-- =============================================
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
    enrichment_score REAL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    -- Verification scores (REAL type for compatibility)
    email_verification_score REAL DEFAULT 0,
    phone_verification_score REAL DEFAULT 0,
    email_verification_level INTEGER DEFAULT 0,
    is_disposable BOOLEAN DEFAULT FALSE,
    is_role_based BOOLEAN DEFAULT FALSE,
    is_catchall BOOLEAN DEFAULT FALSE,
    phone_type VARCHAR(20), -- 'mobile', 'landline', 'voip', 'unknown'
    phone_country VARCHAR(5), -- country code
    credits_consumed INTEGER DEFAULT 0,
    -- CRM Enhancement fields
    lead_score INTEGER DEFAULT 0,
    email_reliability VARCHAR(20) DEFAULT 'unknown',
    -- Batch management field
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================
-- ENRICHMENT RESULTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS enrichment_results (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id),
    provider VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(255),
    confidence_score REAL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    raw_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================
-- CREDIT LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS credit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) DEFAULT NULL,
    provider VARCHAR(50) DEFAULT NULL,
    operation_type VARCHAR(50) NOT NULL, -- 'enrichment', 'verification', 'topup'
    cost REAL NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    details JSONB DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    change INTEGER DEFAULT 0,
    reason VARCHAR(255) DEFAULT NULL
);

-- =============================================
-- NOTIFICATION LOGS TABLE
-- =============================================
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

-- =============================================
-- EXPORT LOGS TABLE (Enhanced with platform support)
-- =============================================
CREATE TABLE IF NOT EXISTS export_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    contact_id INTEGER,
    job_id VARCHAR(255) REFERENCES import_jobs(id),
    platform VARCHAR(50) NOT NULL DEFAULT 'csv',
    platform_contact_id VARCHAR(255),
    export_type VARCHAR(50) NOT NULL, -- 'csv', 'excel', 'hubspot', 'lemlist', etc.
    export_format VARCHAR(50),
    status VARCHAR(50) DEFAULT 'success',
    file_url VARCHAR(500) DEFAULT NULL,
    export_config JSONB DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for contact_id (from batch management migration)
DO $$
BEGIN
    ALTER TABLE export_logs ADD CONSTRAINT fk_export_logs_contact_id 
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- COMPREHENSIVE BILLING SYSTEM
-- =============================================

-- Packages table with exact pricing structure
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL UNIQUE,
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
CREATE TABLE IF NOT EXISTS credit_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    total_credits INTEGER DEFAULT 0,
    used_credits INTEGER DEFAULT 0,
    expired_credits INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit allocations (for FIFO tracking)
CREATE TABLE IF NOT EXISTS credit_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Payment methods
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

-- Billing transactions
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

-- Credit packages
CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL UNIQUE,
    credits INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CRM SYSTEM WITH PROPER ENUM TYPES
-- =============================================

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
    status contactstatus DEFAULT 'new',
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

-- CRM Activities with proper enum types
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type activitytype NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    status activitystatus DEFAULT 'pending',
    priority priority DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CRM Campaigns with proper enum types
CREATE TABLE IF NOT EXISTS crm_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'email',
    status campaignstatus DEFAULT 'draft',
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

-- =============================================
-- INTEGRATION CONFIGURATIONS
-- =============================================
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

-- =============================================
-- NOTIFICATION PREFERENCES
-- =============================================
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

-- =============================================
-- HUBSPOT INTEGRATION TABLES
-- =============================================

-- HubSpot integration configurations
CREATE TABLE IF NOT EXISTS hubspot_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hubspot_portal_id VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, hubspot_portal_id)
);

-- HubSpot sync logs
CREATE TABLE IF NOT EXISTS hubspot_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES hubspot_integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'export', 'import'
    operation VARCHAR(50) NOT NULL, -- 'contacts', 'batch'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_message TEXT,
    sync_data JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HubSpot contact mappings
CREATE TABLE IF NOT EXISTS hubspot_contact_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    captely_contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    hubspot_contact_id VARCHAR(255) NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status VARCHAR(50) DEFAULT 'synced', -- 'synced', 'modified', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, captely_contact_id),
    UNIQUE(user_id, hubspot_contact_id)
);

-- =============================================
-- CREATE ALL PERFORMANCE INDEXES
-- =============================================

-- Email verification indexes
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON email_verifications(code);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Auth service critical indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Contacts table indexes
CREATE INDEX IF NOT EXISTS idx_contacts_job_id ON contacts(job_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_enriched ON contacts(enriched);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_notes ON contacts(notes) WHERE notes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email_verification_score ON contacts(email_verification_score) WHERE email_verification_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone_verification_score ON contacts(phone_verification_score) WHERE phone_verification_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score);
CREATE INDEX IF NOT EXISTS idx_contacts_email_reliability ON contacts(email_reliability);

-- Import jobs indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);

-- Credit logs indexes
CREATE INDEX IF NOT EXISTS idx_credit_logs_user_id ON credit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_logs_operation_type ON credit_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_credit_logs_created_at ON credit_logs(created_at DESC);

-- Export logs indexes
CREATE INDEX IF NOT EXISTS idx_export_logs_user_id ON export_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_contact_id ON export_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_platform ON export_logs(platform);
CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON export_logs(created_at);

-- CRM table indexes
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON crm_contacts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_status ON crm_activities(status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_priority ON crm_activities(priority);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_type ON crm_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_created_at ON crm_campaigns(created_at DESC);

-- Billing indexes
CREATE INDEX IF NOT EXISTS idx_credit_allocations_user_id ON credit_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_allocations_expires_at ON credit_allocations(expires_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_history_user_id ON enrichment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_history_created_at ON enrichment_history(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_id ON billing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- HubSpot integration indexes
CREATE INDEX IF NOT EXISTS idx_hubspot_integrations_user_id ON hubspot_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_integrations_is_active ON hubspot_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_hubspot_integrations_expires_at ON hubspot_integrations(expires_at);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_logs_user_id ON hubspot_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_logs_integration_id ON hubspot_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_logs_sync_type ON hubspot_sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_logs_status ON hubspot_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_logs_created_at ON hubspot_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_mappings_user_id ON hubspot_contact_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_mappings_captely_contact_id ON hubspot_contact_mappings(captely_contact_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_mappings_hubspot_contact_id ON hubspot_contact_mappings(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_mappings_sync_status ON hubspot_contact_mappings(sync_status);

-- =============================================
-- INSERT SAMPLE DATA FOR TESTING
-- =============================================

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
 false)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    plan_type = EXCLUDED.plan_type,
    credits_monthly = EXCLUDED.credits_monthly,
    price_monthly = EXCLUDED.price_monthly,
    price_annual = EXCLUDED.price_annual,
    features = EXCLUDED.features,
    popular = EXCLUDED.popular;

-- Insert credit packages
INSERT INTO credit_packages (name, credits, price, discount_percentage, popular) VALUES
('Small Top-up', 1000, 10.00, 0, false),
('Medium Top-up', 5000, 40.00, 20, true),
('Large Top-up', 15000, 100.00, 33, false),
('Mega Top-up', 50000, 300.00, 40, false)
ON CONFLICT (name) DO UPDATE SET
    credits = EXCLUDED.credits,
    price = EXCLUDED.price,
    discount_percentage = EXCLUDED.discount_percentage,
    popular = EXCLUDED.popular;

-- Create test user with OAuth support
INSERT INTO users (
    id, 
    email, 
    password_hash,
    first_name,
    last_name,
    company,
    phone,
    is_active,
    auth_provider,
    email_verified,
    created_at, 
    updated_at, 
    credits,
    onboarding_completed,
    company_name
) VALUES (
    '00000000-0000-0000-0002-000000000001',
    'test@captely.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGGS6oKgo7K',
    'Test',
    'User',
    'Test Company',
    '+1234567890',
    true,
    'email',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    20000,
    true,
    'Test Company'
) ON CONFLICT (email) DO UPDATE SET
    first_name = 'Test',
    last_name = 'User',
    company = 'Test Company',
    phone = '+1234567890',
    is_active = true,
    auth_provider = 'email',
    email_verified = true,
    credits = 20000,
    onboarding_completed = true;

-- Add test notification preferences
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

-- Create test credit balance and allocations
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
        uuid_generate_v4(), test_user_id, pro_5k_package_id, 'monthly', 'active',
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

-- Insert sample CRM data for testing
INSERT INTO crm_contacts (id, user_id, first_name, last_name, email, phone, company, position, status, lead_score) VALUES
    ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0002-000000000001', 'John', 'Smith', 'john@techcorp.com', '+1-555-0101', 'TechCorp Inc.', 'CEO', 'qualified', 85),
    ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0002-000000000001', 'Sarah', 'Johnson', 'sarah@marketingco.com', '+1-555-0102', 'Marketing Co.', 'VP Marketing', 'contacted', 70),
    ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0002-000000000001', 'Mike', 'Chen', 'mike@techstart.io', '+1-555-0103', 'TechStart', 'CTO', 'new', 60),
    ('00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0002-000000000001', 'Lisa', 'Wong', 'lisa@datacorp.com', '+1-555-0104', 'DataCorp', 'Data Scientist', 'customer', 95),
    ('00000000-0000-0000-0004-000000000005', '00000000-0000-0000-0002-000000000001', 'David', 'Brown', 'david@salesforce.example', '+1-555-0105', 'SalesForce Pro', 'Sales Director', 'new', 45)
ON CONFLICT (user_id, email) DO NOTHING;

-- Insert sample CRM activities with proper enum values
INSERT INTO crm_activities (id, type, title, description, contact_id, status, priority, due_date, created_by, assigned_to) VALUES
    ('00000000-0000-0000-0005-000000000001', 'call', 'Follow-up call with John Smith', 'Discuss pricing and next steps for enterprise plan', '00000000-0000-0000-0004-000000000001', 'pending', 'high', NOW() + INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000002', 'email', 'Send proposal to Sarah Johnson', 'Include custom integration details and timeline', '00000000-0000-0000-0004-000000000002', 'completed', 'medium', NOW() - INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000003', 'meeting', 'Product demo with TechStart team', 'Showcase new features and answer technical questions', '00000000-0000-0000-0004-000000000003', 'pending', 'high', NOW() + INTERVAL '3 days', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000004', 'task', 'Prepare contract for Enterprise deal', 'Include custom terms discussed in last meeting', NULL, 'overdue', 'urgent', NOW() - INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000005', 'follow_up', 'Check in with trial users', 'Send feedback survey and offer support', NULL, 'pending', 'low', NOW() + INTERVAL '7 days', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000006', 'note', 'Client feedback on latest features', 'Positive response to new dashboard, requested mobile app', '00000000-0000-0000-0004-000000000004', 'completed', 'medium', NULL, 'test_user', 'test_user')
ON CONFLICT (id) DO NOTHING;

-- Insert sample CRM campaigns with proper enum values
INSERT INTO crm_campaigns (id, name, type, status, from_email, from_name, total_contacts, sent_count, open_count, click_count, reply_count) VALUES
    ('00000000-0000-0000-0006-000000000001', 'Q2 Product Launch Campaign', 'email', 'active', 'marketing@captely.com', 'Captely Marketing', 1500, 1200, 420, 85, 24),
    ('00000000-0000-0000-0006-000000000002', 'Enterprise Outreach', 'email', 'active', 'sales@captely.com', 'Captely Sales', 300, 280, 145, 32, 8),
    ('00000000-0000-0000-0006-000000000003', 'Customer Feedback Survey', 'email', 'completed', 'success@captely.com', 'Captely Success', 850, 850, 380, 127, 89),
    ('00000000-0000-0000-0006-000000000004', 'New Feature Announcement', 'email', 'draft', 'product@captely.com', 'Captely Product', 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- CREATE TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =============================================

-- Trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables that need them
DO $$
BEGIN
    DROP TRIGGER IF EXISTS update_contacts_updated_at_trigger ON contacts;
    CREATE TRIGGER update_contacts_updated_at_trigger
        BEFORE UPDATE ON contacts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS update_export_logs_updated_at_trigger ON export_logs;
    CREATE TRIGGER update_export_logs_updated_at_trigger
        BEFORE UPDATE ON export_logs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- HubSpot integration triggers
DO $$
BEGIN
    DROP TRIGGER IF EXISTS update_hubspot_integrations_updated_at_trigger ON hubspot_integrations;
    CREATE TRIGGER update_hubspot_integrations_updated_at_trigger
        BEFORE UPDATE ON hubspot_integrations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS update_hubspot_contact_mappings_updated_at_trigger ON hubspot_contact_mappings;
    CREATE TRIGGER update_hubspot_contact_mappings_updated_at_trigger
        BEFORE UPDATE ON hubspot_contact_mappings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- =============================================
-- VERIFICATION AND COMPLETION MESSAGE
-- =============================================

-- Verify everything is working
DO $$
DECLARE
    user_count INTEGER;
    contact_count INTEGER;
    activity_count INTEGER;
    campaign_count INTEGER;
    package_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO contact_count FROM crm_contacts;
    SELECT COUNT(*) INTO activity_count FROM crm_activities;
    SELECT COUNT(*) INTO campaign_count FROM crm_campaigns;
    SELECT COUNT(*) INTO package_count FROM packages;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 CAPTELY DATABASE INITIALIZATION COMPLETE! 🎉';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 Database Statistics:';
    RAISE NOTICE '   Users: %', user_count;
    RAISE NOTICE '   CRM Contacts: %', contact_count;
    RAISE NOTICE '   CRM Activities: %', activity_count;
    RAISE NOTICE '   CRM Campaigns: %', campaign_count;
    RAISE NOTICE '   Billing Packages: %', package_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Features Included:';
    RAISE NOTICE '   • Complete OAuth Support (email, Google, Apple)';
    RAISE NOTICE '   • Email Verification System';
    RAISE NOTICE '   • Full CRM System with Enum Types';
    RAISE NOTICE '   • Comprehensive Billing & Credit System';
    RAISE NOTICE '   • Contact Enrichment Pipeline';
    RAISE NOTICE '   • Export/Import Functionality';
    RAISE NOTICE '   • Performance Indexes';
    RAISE NOTICE '   • Sample Data for Testing';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔐 Test Account:';
    RAISE NOTICE '   Email: test@captely.com';
    RAISE NOTICE '   Password: TestUser123!';
    RAISE NOTICE '   Auth Provider: email';
    RAISE NOTICE '   Email Verified: true';
    RAISE NOTICE '========================================';
    
END $$; 