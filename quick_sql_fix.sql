-- Quick Lead Score Fix - Run this SQL directly in your database
-- This will calculate lead scores for all contacts with 0 scores

UPDATE contacts SET 
  lead_score = CASE 
    WHEN email IS NOT NULL AND phone IS NOT NULL AND email_verified = true AND phone_verified = true THEN 95
    WHEN email IS NOT NULL AND email_verified = true AND phone IS NOT NULL THEN 85
    WHEN email IS NOT NULL AND email_verified = true THEN 75
    WHEN email IS NOT NULL AND phone IS NOT NULL THEN 65
    WHEN email IS NOT NULL AND company IS NOT NULL AND position IS NOT NULL THEN 60
    WHEN email IS NOT NULL AND company IS NOT NULL THEN 55
    WHEN email IS NOT NULL THEN 50
    WHEN phone IS NOT NULL AND company IS NOT NULL THEN 45
    WHEN phone IS NOT NULL THEN 40
    WHEN company IS NOT NULL AND position IS NOT NULL THEN 35
    ELSE 20
  END,
  email_reliability = CASE 
    WHEN email IS NULL THEN 'no_email'
    WHEN email_verified = true AND email_verification_score >= 0.9 THEN 'excellent'
    WHEN email_verified = true AND email_verification_score >= 0.7 THEN 'good'
    WHEN email_verified = true AND email_verification_score >= 0.5 THEN 'fair'
    WHEN email_verified = false THEN 'poor'
    WHEN email IS NOT NULL THEN 'unknown'
    ELSE 'unknown'
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE lead_score = 0 OR lead_score IS NULL OR email_reliability = 'unknown' OR email_reliability IS NULL;

-- Check results
SELECT 
  COUNT(*) as total_contacts,
  AVG(lead_score) as avg_score,
  COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as high_quality,
  COUNT(CASE WHEN lead_score >= 50 THEN 1 END) as medium_quality,
  COUNT(CASE WHEN email_reliability = 'excellent' THEN 1 END) as excellent_emails,
  COUNT(CASE WHEN email_reliability = 'good' THEN 1 END) as good_emails
FROM contacts; 