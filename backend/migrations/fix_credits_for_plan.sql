-- Update credits for users with pack-500 plan
UPDATE users 
SET credits = 500 
WHERE plan = 'pack-500' AND credits > 500;

-- Verify the changes
SELECT 'Credits updated for pack-500 users' as status; 