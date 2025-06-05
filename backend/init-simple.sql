-- Simplified init.sql for troubleshooting
-- Only essential tables with OAuth support

-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Essential users table with OAuth support
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- nullable for OAuth
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    phone VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    -- OAuth fields (CRITICAL)
    auth_provider VARCHAR(20) DEFAULT 'email',
    email_verified BOOLEAN DEFAULT FALSE,
    -- Basic fields
    credits INTEGER DEFAULT 100,
    total_spent DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verification table (ESSENTIAL)
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);

-- Test user
INSERT INTO users (
    id, email, password_hash, first_name, last_name, 
    is_active, auth_provider, email_verified, credits
) VALUES (
    '00000000-0000-0000-0002-000000000001',
    'test@captely.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGGS6oKgo7K',
    'Test', 'User',
    true, 'email', true, 20000
) ON CONFLICT (email) DO UPDATE SET
    auth_provider = 'email',
    email_verified = true,
    credits = 20000;

-- Success message
SELECT 'Database initialized successfully with basic schema' as status; 