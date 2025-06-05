-- Fix missing notes column in contacts table
-- This column is required by the enrichment worker but missing from schema

-- Add the missing notes column
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify the fix
SELECT 
    'notes column added successfully' as status,
    COUNT(*) as total_contacts,
    COUNT(CASE WHEN enriched = true THEN 1 END) as enriched_contacts
FROM contacts; 