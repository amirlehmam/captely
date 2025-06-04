-- Fix missing verification columns in contacts table
-- This script is safe to run multiple times

-- Add phone_verification_score column if it doesn't exist
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS phone_verification_score REAL DEFAULT 0.0;

-- Ensure email_verification_score exists and has proper type
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS email_verification_score REAL DEFAULT 0.0;

-- Update existing contacts to have default scores if null
UPDATE contacts 
SET phone_verification_score = 0.0 
WHERE phone_verification_score IS NULL;

UPDATE contacts 
SET email_verification_score = 0.0 
WHERE email_verification_score IS NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_phone_verification_score 
ON contacts(phone_verification_score) WHERE phone_verification_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_email_verification_score 
ON contacts(email_verification_score) WHERE email_verification_score IS NOT NULL;

-- Verify the columns exist
SELECT 
    'Verification columns fixed!' as message,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'phone_verification_score') as phone_score_added,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'email_verification_score') as email_score_exists; 