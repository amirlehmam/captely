-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
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
