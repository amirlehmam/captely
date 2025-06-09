-- HubSpot Integration Schema Migration
-- Creates tables for storing HubSpot OAuth tokens and integration configurations

-- Create HubSpot integration configurations table
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

-- Create HubSpot sync logs table
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

-- Create HubSpot contact mappings table
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

-- Create indexes for performance
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hubspot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hubspot_integrations_updated_at_trigger
    BEFORE UPDATE ON hubspot_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_hubspot_updated_at();

CREATE TRIGGER update_hubspot_contact_mappings_updated_at_trigger
    BEFORE UPDATE ON hubspot_contact_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_hubspot_updated_at(); 