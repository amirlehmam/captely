-- Fix Credit Service Schema Issues
-- Add missing 'plan' column to users table

-- Add plan column to users table (credit service expects this)
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter';

-- Update existing users to have a default plan
UPDATE users SET plan = 'starter' WHERE plan IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Verify the change
SELECT 'Users table updated with plan column' as status; 