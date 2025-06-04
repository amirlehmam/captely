-- =============================================
-- Batch Management Schema Updates
-- =============================================

-- Add notes field to contacts table
ALTER TABLE contacts ADD COLUMN notes TEXT;

-- Create export_logs table for tracking HubSpot exports
CREATE TABLE IF NOT EXISTS export_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    contact_id VARCHAR(255),
    platform VARCHAR(50) NOT NULL DEFAULT 'hubspot',
    platform_contact_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_export_logs_user_id ON export_logs(user_id);
CREATE INDEX idx_export_logs_contact_id ON export_logs(contact_id);
CREATE INDEX idx_export_logs_platform ON export_logs(platform);
CREATE INDEX idx_export_logs_created_at ON export_logs(created_at);

-- Add comment to document the table
COMMENT ON TABLE export_logs IS 'Tracks exports of contacts to external platforms like HubSpot';
COMMENT ON COLUMN export_logs.platform IS 'The external platform (hubspot, salesforce, etc.)';
COMMENT ON COLUMN export_logs.platform_contact_id IS 'The contact ID in the external platform';
COMMENT ON COLUMN export_logs.status IS 'Export status (success, failed, pending)';

-- Update contacts table to ensure all verification score columns exist
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS email_verification_score REAL,
ADD COLUMN IF NOT EXISTS phone_verification_score REAL;

-- Create indexes on new fields for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_notes ON contacts(notes) WHERE notes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email_verification_score ON contacts(email_verification_score) WHERE email_verification_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone_verification_score ON contacts(phone_verification_score) WHERE phone_verification_score IS NOT NULL;

-- Add a trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_contact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contacts table
DROP TRIGGER IF EXISTS trigger_update_contact_updated_at ON contacts;
CREATE TRIGGER trigger_update_contact_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_updated_at();

-- Create trigger for export_logs table
CREATE OR REPLACE FUNCTION update_export_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_export_log_updated_at ON export_logs;
CREATE TRIGGER trigger_update_export_log_updated_at
    BEFORE UPDATE ON export_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_export_log_updated_at();

-- Update existing contacts to have default verification scores if null
UPDATE contacts 
SET email_verification_score = 0.0 
WHERE email_verification_score IS NULL AND email IS NOT NULL;

UPDATE contacts 
SET phone_verification_score = 0.0 
WHERE phone_verification_score IS NULL AND phone IS NOT NULL;

-- Verify the schema updates
SELECT 
    'Schema update complete!' as message,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'notes') as notes_field_added,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'export_logs') as export_logs_table_created; 