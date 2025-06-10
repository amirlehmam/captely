-- Fix Database Schema for OAuth Support
-- Run this script to add missing columns and fix authentication issues

-- Connect to the captely database
\c captely;

-- Add OAuth columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Make password_hash nullable for OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Update existing users to mark them as email verified
UPDATE users 
SET email_verified = TRUE, auth_provider = 'email'
WHERE password_hash IS NOT NULL AND password_hash != '';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Show the updated table structure
\d users;

-- Display success message
SELECT 'Database schema updated successfully for OAuth support!' as message; 