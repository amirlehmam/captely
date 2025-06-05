-- Quick fix for missing OAuth columns
-- Run this on your server: docker exec -i captely-db psql -U postgres -d captely -c "$(cat fix_oauth_migration.sql)"

-- Add missing OAuth columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Allow password_hash to be null for OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Update existing users to have email_verified = true if they have a password
UPDATE users 
SET email_verified = TRUE, auth_provider = 'email'
WHERE password_hash IS NOT NULL AND password_hash != '';

-- Verify the columns were added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('auth_provider', 'email_verified'); 