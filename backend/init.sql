-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    credits INTEGER DEFAULT 100,
    total_spent FLOAT DEFAULT 0,
    daily_limit INTEGER DEFAULT NULL,
    monthly_limit INTEGER DEFAULT NULL,
    provider_limits JSONB DEFAULT NULL,
    notification_preferences JSONB DEFAULT NULL,
    last_credit_alert TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Import Jobs table for tracking CSV imports
CREATE TABLE IF NOT EXISTS import_jobs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processing',
    total INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
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
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
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
