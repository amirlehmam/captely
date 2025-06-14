-- Zapier Integration Schema Migration
-- Creates tables for storing Zapier webhook URLs and integration configurations

-- Create Zapier integration configurations table
CREATE TABLE IF NOT EXISTS zapier_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zapier_webhook_url TEXT NOT NULL,
    zapier_zap_id VARCHAR(255),
    zapier_api_key TEXT, -- Optional for advanced features
    expires_at TIMESTAMP WITH TIME ZONE, -- Webhooks don't expire but we keep for consistency
    scopes TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, zapier_webhook_url)
);

-- Create Zapier sync logs table
CREATE TABLE IF NOT EXISTS zapier_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES zapier_integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'export', 'import', 'webhook'
    operation VARCHAR(50) NOT NULL, -- 'contacts', 'batch', 'trigger'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_message TEXT,
    sync_data JSONB DEFAULT '{}',
    webhook_response JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Zapier contact mappings table
CREATE TABLE IF NOT EXISTS zapier_contact_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    captely_contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    zapier_record_id VARCHAR(255) NOT NULL,
    zap_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(captely_contact_id, zapier_record_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_zapier_integrations_user_id ON zapier_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_zapier_sync_logs_user_id ON zapier_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_zapier_sync_logs_status ON zapier_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_zapier_contact_mappings_user_id ON zapier_contact_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_zapier_contact_mappings_captely_id ON zapier_contact_mappings(captely_contact_id); 