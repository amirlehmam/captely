-- Salesforce Integration Schema Migration
-- Creates tables for storing Salesforce OAuth tokens and integration configurations

-- Create Salesforce integration configurations table
CREATE TABLE IF NOT EXISTS salesforce_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salesforce_instance_url VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, salesforce_instance_url)
);

-- Create Salesforce sync logs table
CREATE TABLE IF NOT EXISTS salesforce_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES salesforce_integrations(id) ON DELETE CASCADE,
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

-- Create Salesforce contact mappings table
CREATE TABLE IF NOT EXISTS salesforce_contact_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    captely_contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    salesforce_contact_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(captely_contact_id, salesforce_contact_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_salesforce_integrations_user_id ON salesforce_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_salesforce_sync_logs_user_id ON salesforce_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_salesforce_sync_logs_status ON salesforce_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_salesforce_contact_mappings_user_id ON salesforce_contact_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_salesforce_contact_mappings_captely_id ON salesforce_contact_mappings(captely_contact_id); 