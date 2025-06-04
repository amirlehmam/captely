-- =============================================
-- CRM Enhancements Schema Updates
-- =============================================

-- Add lead scoring and email reliability fields to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_reliability VARCHAR(20) DEFAULT 'unknown';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score);
CREATE INDEX IF NOT EXISTS idx_contacts_email_reliability ON contacts(email_reliability);

-- Update existing contacts with calculated lead scores
UPDATE contacts 
SET lead_score = CASE 
    WHEN email IS NOT NULL AND phone IS NOT NULL AND email_verified = true AND phone_verified = true THEN 95
    WHEN email IS NOT NULL AND email_verified = true AND phone IS NOT NULL THEN 85
    WHEN email IS NOT NULL AND email_verified = true THEN 75
    WHEN email IS NOT NULL AND phone IS NOT NULL THEN 65
    WHEN email IS NOT NULL THEN 50
    WHEN phone IS NOT NULL THEN 40
    ELSE 20
END
WHERE lead_score = 0;

-- Update email reliability based on verification data
UPDATE contacts 
SET email_reliability = CASE 
    WHEN email IS NULL THEN 'no_email'
    WHEN email_verified = true AND email_verification_score >= 0.9 THEN 'excellent'
    WHEN email_verified = true AND email_verification_score >= 0.7 THEN 'good'
    WHEN email_verified = true AND email_verification_score >= 0.5 THEN 'fair'
    WHEN email_verified = false THEN 'poor'
    WHEN email IS NOT NULL THEN 'unknown'
    ELSE 'unknown'
END
WHERE email_reliability = 'unknown';

-- Verify the schema updates
SELECT 
    'CRM enhancements complete!' as message,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'lead_score') as lead_score_field_added,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'email_reliability') as email_reliability_field_added; 