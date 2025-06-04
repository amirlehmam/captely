# CRM Database Migration Instructions

## Issue Description
Your CRM contacts page is failing because the database is missing required columns in the `contacts` table:
- `lead_score` (INTEGER)
- `email_reliability` (VARCHAR)

## Quick Fix Applied
I've temporarily modified the API endpoints in `backend/services/import-service/app/main.py` to use `COALESCE()` functions that provide default values when these columns don't exist. This allows the CRM page to load without errors, but you should still run the proper migration.

## How to Run the Migration

### Option 1: Using Docker Compose (Recommended)

1. **Start the PostgreSQL database**:
```bash
cd backend
docker-compose up -d db
```

2. **Wait for database to be ready** (about 10-20 seconds)

3. **Run the migration using the Python script**:
```bash
python run_crm_migration.py
```

### Option 2: Using psql directly

If you have PostgreSQL client tools installed:

```bash
psql -h localhost -p 5432 -U postgres -d postgres -f backend/add_crm_enhancements_schema.sql
```

Password: `postgrespw`

### Option 3: Execute SQL manually

Connect to your PostgreSQL database and run this SQL:

```sql
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
```

## Verification

After running the migration, verify it worked:

```sql
-- Check if columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND column_name IN ('lead_score', 'email_reliability');

-- Check some sample data
SELECT id, lead_score, email_reliability, email, phone 
FROM contacts 
LIMIT 10;
```

## What the Migration Does

1. **Adds `lead_score` column**: Integer field (0-100) representing lead quality
2. **Adds `email_reliability` column**: Text field indicating email quality (excellent, good, fair, poor, unknown, no_email)
3. **Creates database indexes** for better query performance
4. **Calculates initial values** for existing contacts based on their data
5. **Sets up proper defaults** for future records

## Lead Score Calculation

The migration automatically calculates lead scores for existing contacts:
- **95 points**: Email + Phone + Both verified
- **85 points**: Email verified + Phone (unverified)  
- **75 points**: Email verified only
- **65 points**: Email + Phone (both unverified)
- **50 points**: Email only (unverified)
- **40 points**: Phone only
- **20 points**: No contact information

## Email Reliability Categories

- **excellent**: Verified email with score ≥ 0.9
- **good**: Verified email with score ≥ 0.7
- **fair**: Verified email with score ≥ 0.5
- **poor**: Unverified or failed verification
- **unknown**: Email exists but not verified
- **no_email**: No email address available

## After Migration

1. **Restart your services** to ensure they pick up the new schema
2. **Test the CRM contacts page** - it should now load without errors
3. **Remove the temporary fixes** from the code if desired (the COALESCE functions)

## Files Modified (Temporary Fixes)

- `backend/services/import-service/app/main.py`: Added COALESCE functions to handle missing columns
- `run_crm_migration.py`: Created migration script for easy execution

## Need Help?

If you encounter any issues:

1. Check if PostgreSQL is running: `docker ps` or `docker-compose ps`
2. Verify database connection: Try connecting with psql
3. Check the migration script output for any error messages
4. Ensure you have the correct database credentials

The temporary fixes will keep your CRM page working even if the migration hasn't been run yet, but running the proper migration will give you the full functionality and better performance. 