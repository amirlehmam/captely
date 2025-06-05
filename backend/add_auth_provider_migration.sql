-- 🔧 Database Migration: Add missing columns to users table
-- Run this to fix the "column users.auth_provider does not exist" error

-- Add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_limit INTEGER,
ADD COLUMN IF NOT EXISTS monthly_limit INTEGER,
ADD COLUMN IF NOT EXISTS provider_limits JSONB,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB,
ADD COLUMN IF NOT EXISTS last_credit_alert TIMESTAMP WITH TIME ZONE;

-- Update existing users to have default values
UPDATE users 
SET 
    auth_provider = 'email' WHERE auth_provider IS NULL,
    email_verified = false WHERE email_verified IS NULL,
    total_spent = 0 WHERE total_spent IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Display migration status
SELECT 'Migration completed successfully! Added auth_provider and other missing columns.' as status; 