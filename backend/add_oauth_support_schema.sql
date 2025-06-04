-- =============================================
-- OAuth Support Schema Updates
-- =============================================

-- Add OAuth support fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Allow password_hash to be null for OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Update existing users to have email_verified = true if they have a password
UPDATE users 
SET email_verified = TRUE, auth_provider = 'email'
WHERE password_hash IS NOT NULL AND password_hash != '';

-- Create partial index for OAuth users
CREATE INDEX IF NOT EXISTS idx_users_oauth_incomplete 
ON users(id) 
WHERE auth_provider != 'email' AND (first_name IS NULL OR last_name IS NULL OR company IS NULL OR phone IS NULL);

-- Add constraint to ensure OAuth users have either password_hash or auth_provider
ALTER TABLE users 
ADD CONSTRAINT check_auth_method 
CHECK (
    (password_hash IS NOT NULL AND password_hash != '') OR 
    (auth_provider IS NOT NULL AND auth_provider != 'email')
);

-- Grant permissions if needed
-- GRANT SELECT, INSERT, UPDATE ON users TO captely_user;

-- Verification query
SELECT 
    'oauth_fields_added' as status, 
    COUNT(*) as total_users,
    COUNT(CASE WHEN auth_provider = 'email' THEN 1 END) as email_users,
    COUNT(CASE WHEN auth_provider IN ('google', 'apple') THEN 1 END) as oauth_users,
    COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users
FROM users; 