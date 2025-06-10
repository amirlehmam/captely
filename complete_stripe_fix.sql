-- COMPLETE STRIPE PRICING FIX
-- This script will fix all pricing and Stripe integration issues


-- Step 1: Update package names and pricing
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

-- Step 2: Ensure all packages have correct structure
UPDATE packages 
SET 
    display_name = 'Starter',
    price_monthly = 25.00,
    price_annual = 250.00,
    stripe_price_id_monthly = NULL,
    stripe_price_id_annual = NULL
WHERE name = 'starter' AND credits_monthly = 500;

-- Step 3: Set Stripe price IDs to NULL so the system creates new ones with correct prices
-- This ensures the billing system will create new prices with the correct amounts
UPDATE packages SET 
    stripe_price_id_monthly = NULL,
    stripe_price_id_annual = NULL
WHERE name IN ('pro-10k', 'pro-20k', 'starter');

-- Step 4: Verify current user subscription is correct
SELECT 
    us.user_id,
    p.name as package_name,
    p.display_name,
    p.credits_monthly,
    p.price_monthly,
    us.status,
    cb.total_credits,
    cb.used_credits,
    (cb.total_credits - cb.used_credits) as credits_remaining
FROM user_subscriptions us
JOIN packages p ON p.id = us.package_id
LEFT JOIN credit_balances cb ON cb.user_id = us.user_id
WHERE us.user_id = '0f92ca2a-8fb4-48c7-b2a6-560fd2a7a774'
AND us.status = 'active';

-- Step 5: Display all packages with their pricing
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

SELECT '✅ COMPLETE STRIPE PRICING FIX APPLIED! All packages updated with correct prices. Stripe price IDs will be created automatically when users checkout.' as status; 