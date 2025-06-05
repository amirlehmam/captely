-- Migration: Add email verification table for signup process
-- Date: January 2025
-- Description: Creates table to store email verification codes for professional email validation

-- Create the email_verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for efficient email lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);

-- Create index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Insert a comment to document the table purpose
COMMENT ON TABLE email_verifications IS 'Stores email verification codes for signup process with professional email validation';
COMMENT ON COLUMN email_verifications.email IS 'Professional email address to be verified';
COMMENT ON COLUMN email_verifications.code IS '6-digit verification code sent to user';
COMMENT ON COLUMN email_verifications.expires_at IS 'Code expiration time (10 minutes from creation)';
COMMENT ON COLUMN email_verifications.verified IS 'Whether the code has been successfully verified';
COMMENT ON COLUMN email_verifications.attempts IS 'Number of verification attempts (max 5)';
COMMENT ON COLUMN email_verifications.created_at IS 'When the verification code was generated';

-- Print success message
DO $$
BEGIN
    RAISE NOTICE '✅ Email verification table created successfully';
    RAISE NOTICE 'Table: email_verifications';
    RAISE NOTICE 'Indexes: idx_email_verifications_email, idx_email_verifications_expires_at';
END $$; 