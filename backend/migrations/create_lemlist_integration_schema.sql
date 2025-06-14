-- Lemlist Integration Schema Migration
-- Creates tables for storing Lemlist API keys and integration configurations

-- Create Lemlist integration configurations table
CREATE TABLE IF NOT EXISTS lemlist_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lemlist_api_key TEXT NOT NULL,
    lemlist_account_id VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE, -- API keys don't expire but we keep for consistency
    scopes TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lemlist_account_id)
);

-- Create Lemlist sync logs table
CREATE TABLE IF NOT EXISTS lemlist_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES lemlist_integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'export', 'import'
    operation VARCHAR(50) NOT NULL, -- 'contacts', 'batch', 'campaigns'
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

-- Create Lemlist contact mappings table
CREATE TABLE IF NOT EXISTS lemlist_contact_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    captely_contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    lemlist_contact_id VARCHAR(255) NOT NULL,
    lemlist_campaign_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(captely_contact_id, lemlist_contact_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lemlist_integrations_user_id ON lemlist_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_lemlist_sync_logs_user_id ON lemlist_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lemlist_sync_logs_status ON lemlist_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_lemlist_contact_mappings_user_id ON lemlist_contact_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_lemlist_contact_mappings_captely_id ON lemlist_contact_mappings(captely_contact_id); 