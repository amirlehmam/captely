-- FIX PACKAGE TYPES AND CREATE PROPER ENTERPRISE PACKAGE
-- This will fix the current mess and create proper package structure

-- Step 1: Fix the existing packages - they should be "pro" not "enterprise"
UPDATE packages 
SET 
    display_name = 'Pro 10K',
    plan_type = 'pro',
    price_monthly = 380.00,
    price_annual = 3800.00,
    popular = false
WHERE name = 'pro-10k' AND credits_monthly = 10000;

UPDATE packages 
SET 
    display_name = 'Pro 20K', 
    plan_type = 'pro',
    price_monthly = 720.00,
    price_annual = 7200.00,
    popular = false
WHERE name = 'pro-20k' AND credits_monthly = 20000;

UPDATE packages 
SET 
    display_name = 'Starter',
    plan_type = 'starter',
    price_monthly = 25.00,
    price_annual = 250.00,
    popular = false
WHERE name = 'starter' AND credits_monthly = 500;

-- Step 2: Create a proper Enterprise package (Contact Us only)
INSERT INTO packages (
    id,
    name,
    display_name,
    plan_type,
    credits_monthly,
    price_monthly,
    price_annual,
    features,
    is_active,
    popular,
    stripe_price_id_monthly,
    stripe_price_id_annual
) VALUES (
    gen_random_uuid(),
    'enterprise',
    'Enterprise',
    'enterprise',
    50000,  -- 50K credits as a starting point
    0.00,   -- No direct purchase price
    0.00,   -- No direct purchase price
    '["Unlimited contacts", "Priority support", "Custom integrations", "Dedicated account manager", "Custom contract terms", "Volume discounts", "API access", "White-label options"]',
    true,
    false,
    NULL,   -- No Stripe price - contact only
    NULL    -- No Stripe price - contact only
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    plan_type = EXCLUDED.plan_type,
    credits_monthly = EXCLUDED.credits_monthly,
    price_monthly = EXCLUDED.price_monthly,
    price_annual = EXCLUDED.price_annual,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    popular = EXCLUDED.popular;

-- Step 3: Verify the package structure
SELECT 
    name,
    display_name,
    plan_type,
    credits_monthly,
    price_monthly,
    price_annual,
    stripe_price_id_monthly,
    stripe_price_id_annual,
    is_active,
    popular
FROM packages 
WHERE name IN ('starter', 'pro-10k', 'pro-20k', 'enterprise')
ORDER BY 
    CASE 
        WHEN plan_type = 'starter' THEN 1
        WHEN plan_type = 'pro' THEN 2  
        WHEN plan_type = 'enterprise' THEN 3
        ELSE 4
    END,
    credits_monthly;

SELECT '✅ PACKAGE TYPES FIXED! Pro packages are now purchasable, Enterprise is contact-only.' as status; 