-- Migration: Add Stripe price ID columns to packages table
-- This adds the missing columns that the billing service needs

-- Add Stripe price ID columns to packages table
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS stripe_price_id_monthly VARCHAR,
ADD COLUMN IF NOT EXISTS stripe_price_id_annual VARCHAR;

-- Update package names and pricing (from previous fix)
UPDATE packages 
SET 
    display_name = 'Pro 10K',
    price_monthly = 380.00,
    price_annual = 3800.00
WHERE name = 'pro-10k' AND credits_monthly = 10000;

UPDATE packages 
SET 
    display_name = 'Pro 20K',
    price_monthly = 720.00,
    price_annual = 7200.00
WHERE name = 'pro-20k' AND credits_monthly = 20000;

-- Ensure all packages have correct structure
UPDATE packages 
SET 
    display_name = 'Starter',
    price_monthly = 25.00,
    price_annual = 250.00
WHERE name = 'starter' AND credits_monthly = 500;

-- Display updated packages structure
SELECT 
    name,
    display_name,
    credits_monthly,
    price_monthly,
    price_annual,
    stripe_price_id_monthly,
    stripe_price_id_annual,
    is_active,
    popular
FROM packages 
WHERE name IN ('starter', 'pro-10k', 'pro-20k')
ORDER BY credits_monthly;

SELECT '✅ STRIPE PRICE COLUMNS ADDED! The billing service should now work properly.' as status; 