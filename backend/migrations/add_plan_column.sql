-- Add plan column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'pack-500';

-- Update all existing users to have pack-500 plan
UPDATE users SET plan = 'pack-500' WHERE plan IS NULL OR plan != 'pack-500';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Verify the changes
SELECT 'Users table updated with pack-500 plan' as status; 