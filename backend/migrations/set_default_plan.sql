-- Set all existing users to pack-500
UPDATE users SET plan = 'pack-500' WHERE plan IS NULL OR plan != 'pack-500';

-- Set default value for new users
ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'pack-500';

-- Verify the changes
SELECT 'All users updated to pack-500 plan' as status; 