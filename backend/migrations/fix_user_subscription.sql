-- ================================================================
-- Fix User Subscription Migration
-- Adds a starter subscription for the user if they don't have one
-- ================================================================

-- Enable transactions
BEGIN;

-- ================================================================
-- 1. CREATE STARTER PACKAGE IF NOT EXISTS
-- ================================================================

INSERT INTO packages (
    name, 
    display_name, 
    plan_type, 
    credits_monthly, 
    price_monthly, 
    price_annual, 
    features, 
    is_active,
    created_at,
    updated_at
) 
SELECT 
    'starter',
    'Starter',
    'starter',
    500,
    25.00,
    240.00,
    '["500 credits per month", "Email enrichment", "Phone enrichment", "CSV import/export", "Chrome extension", "Basic support"]',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM packages WHERE name = 'starter'
);

-- ================================================================
-- 2. CREATE USER SUBSCRIPTION IF NOT EXISTS
-- ================================================================

-- Create subscription for user: 1feeef3b-fefe-403e-ae96-748bff6c5394
DO $$
DECLARE 
    starter_package_id UUID;
    subscription_exists BOOLEAN := FALSE;
    target_user_id UUID := '1feeef3b-fefe-403e-ae96-748bff6c5394';
BEGIN
    -- Check if user already has any subscription
    SELECT EXISTS(
        SELECT 1 FROM user_subscriptions 
        WHERE user_id = target_user_id
    ) INTO subscription_exists;
    
    -- If no subscription exists, create one
    IF NOT subscription_exists THEN
        -- Get the starter package ID
        SELECT id INTO starter_package_id 
        FROM packages 
        WHERE name = 'starter' 
        LIMIT 1;
        
        -- Create the subscription
        INSERT INTO user_subscriptions (
            user_id,
            package_id,
            billing_cycle,
            status,
            current_period_start,
            current_period_end,
            created_at,
            updated_at
        ) VALUES (
            target_user_id,
            starter_package_id,
            'monthly',
            'active',
            NOW(),
            NOW() + INTERVAL '30 days',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created starter subscription for user %', target_user_id;
    ELSE
        RAISE NOTICE 'User % already has a subscription', target_user_id;
    END IF;
END $$;

-- ================================================================
-- 3. VERIFY THE SUBSCRIPTION WAS CREATED
-- ================================================================

SELECT 
    us.id as subscription_id,
    us.user_id,
    us.status,
    us.billing_cycle,
    p.name as package_name,
    p.display_name,
    p.credits_monthly,
    p.price_monthly,
    us.current_period_start,
    us.current_period_end
FROM user_subscriptions us
JOIN packages p ON us.package_id = p.id
WHERE us.user_id = '1feeef3b-fefe-403e-ae96-748bff6c5394';

-- ================================================================
-- 4. SHOW CURRENT USER CREDIT BALANCE
-- ================================================================

SELECT 
    user_id,
    total_credits,
    used_credits,
    expired_credits,
    created_at as balance_created
FROM credit_balances 
WHERE user_id = '1feeef3b-fefe-403e-ae96-748bff6c5394';

COMMIT;

-- ================================================================
-- Migration completed successfully!
-- ================================================================ 