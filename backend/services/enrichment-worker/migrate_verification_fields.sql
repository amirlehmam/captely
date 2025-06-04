-- Migration script to add verification fields to the contacts table
-- This script is safe to run multiple times (uses IF NOT EXISTS)

-- Add email_verification_score column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        AND column_name = 'email_verification_score'
    ) THEN
        ALTER TABLE contacts ADD COLUMN email_verification_score FLOAT NULL;
        PRINT 'Added email_verification_score column';
    ELSE
        PRINT 'email_verification_score column already exists';
    END IF;
END $$;

-- Add phone_verification_score column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        AND column_name = 'phone_verification_score'
    ) THEN
        ALTER TABLE contacts ADD COLUMN phone_verification_score FLOAT NULL;
        PRINT 'Added phone_verification_score column';
    ELSE
        PRINT 'phone_verification_score column already exists';
    END IF;
END $$;

-- Add credits_consumed column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        AND column_name = 'credits_consumed'
    ) THEN
        ALTER TABLE contacts ADD COLUMN credits_consumed INTEGER DEFAULT 0;
        PRINT 'Added credits_consumed column';
    ELSE
        PRINT 'credits_consumed column already exists';
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_email_verified 
    ON contacts(email_verified) WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_phone_verified 
    ON contacts(phone_verified) WHERE phone IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_enrichment_provider 
    ON contacts(enrichment_provider) WHERE enrichment_provider IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_verification_scores 
    ON contacts(email_verification_score, phone_verification_score);

-- Update any existing contacts that might have emails/phones but no verification status
UPDATE contacts 
SET email_verified = false 
WHERE email IS NOT NULL AND email_verified IS NULL;

UPDATE contacts 
SET phone_verified = false 
WHERE phone IS NOT NULL AND phone_verified IS NULL;

-- Set default credits_consumed to 0 if NULL
UPDATE contacts 
SET credits_consumed = 0 
WHERE credits_consumed IS NULL;

PRINT 'Migration completed successfully!'; 