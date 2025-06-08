-- Set default value for plan to 'pack-500'
ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'pack-500';

-- Update all existing users to have plan 'pack-500'
UPDATE users SET plan = 'pack-500' WHERE plan IS NULL OR plan != 'pack-500';

-- Set default value for credits to 500
ALTER TABLE users ALTER COLUMN credits SET DEFAULT 500;

-- Update credits for all users with plan 'pack-500'
UPDATE users SET credits = 500 WHERE plan = 'pack-500' AND credits != 500;

-- Verify the changes
SELECT id, email, plan, credits FROM users; 