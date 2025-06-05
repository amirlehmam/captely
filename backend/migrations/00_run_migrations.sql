-- 🚀 CAPTELY DATABASE MIGRATIONS - ESSENTIAL FIXES
-- This file ensures all critical migrations run in the correct order
-- Run this after any Docker volume reset to restore functionality

\echo '🔧 Starting Captely database migrations...'

-- 1. CRITICAL: Add OAuth support columns (fixes auth_provider error)
\echo '📝 Adding OAuth support columns...'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Allow password_hash to be null for OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Add missing user profile fields
\echo '📝 Adding user profile fields...'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_limit INTEGER,
ADD COLUMN IF NOT EXISTS monthly_limit INTEGER,
ADD COLUMN IF NOT EXISTS provider_limits JSONB,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB,
ADD COLUMN IF NOT EXISTS last_credit_alert TIMESTAMP WITH TIME ZONE;

-- 3. Update existing users with proper values
\echo '📝 Updating existing user data...'
UPDATE users 
SET 
    email_verified = TRUE, 
    auth_provider = 'email'
WHERE password_hash IS NOT NULL AND password_hash != '';

UPDATE users 
SET 
    total_spent = 0 WHERE total_spent IS NULL;

-- 4. Create indexes for performance
\echo '📝 Creating performance indexes...'
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 5. Verify the migration was successful
\echo '✅ Verifying migration success...'
SELECT 
    'Migration completed successfully!' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN auth_provider = 'email' THEN 1 END) as email_users,
    COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users
FROM users;

\echo '🎉 All migrations completed successfully!' 