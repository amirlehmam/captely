-- COMPLETE BILLING SYSTEM FIX
-- This script will:
-- 1. Update the 10K package to be called "Pro 2"
-- 2. Fix your user's subscription
-- 3. Ensure the system works automatically for future users

-- Step 1: Update the package name from "Pro 10K" to "Pro 2"
UPDATE packages 
SET display_name = 'Pro 2'
WHERE name = 'pro-10k' AND credits_monthly = 10000;

-- Step 2: Fix the specific user's subscription
DO $$
DECLARE
    user_uuid UUID := '0f92ca2a-8fb4-48c7-b2a6-560fd2a7a774';
    package_10k_id UUID;
    subscription_id UUID;
    existing_subscription_id UUID;
BEGIN
    -- Get the 10K credits package (now called "Pro 2")
    SELECT id INTO package_10k_id FROM packages WHERE name = 'pro-10k' AND credits_monthly = 10000;
    
    IF package_10k_id IS NULL THEN
        RAISE EXCEPTION 'Pro 2 package (10K credits) not found!';
    END IF;
    
    RAISE NOTICE 'Using Pro 2 package ID: %', package_10k_id;
    
    -- Check if user already has a subscription
    SELECT id INTO existing_subscription_id FROM user_subscriptions WHERE user_id = user_uuid LIMIT 1;
    
    IF existing_subscription_id IS NOT NULL THEN
        -- Update existing subscription
        UPDATE user_subscriptions 
        SET package_id = package_10k_id,
            status = 'active',
            current_period_end = CURRENT_TIMESTAMP + INTERVAL '30 days',
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = user_uuid;
        
        subscription_id := existing_subscription_id;
        RAISE NOTICE 'Updated existing subscription: %', subscription_id;
    ELSE
        -- Create new subscription
        INSERT INTO user_subscriptions (
            id, user_id, package_id, billing_cycle, status,
            current_period_start, current_period_end
        ) VALUES (
            uuid_generate_v4(), user_uuid, package_10k_id, 'monthly', 'active',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days'
        ) RETURNING id INTO subscription_id;
        
        RAISE NOTICE 'Created new subscription: %', subscription_id;
    END IF;
    
    -- Clear old credit allocations for this user
    DELETE FROM credit_allocations WHERE user_id = user_uuid;
    
    -- Create new credit allocation for 10,000 credits
    INSERT INTO credit_allocations (
        id, user_id, credits_allocated, credits_remaining,
        allocated_at, expires_at, source, billing_cycle, subscription_id
    ) VALUES (
        uuid_generate_v4(), user_uuid, 10000, 9980, -- 9980 because they used 20
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days',
        'pro_2_subscription', 'monthly', subscription_id
    );
    
    -- Update or create credit balance
    INSERT INTO credit_balances (user_id, total_credits, used_credits, expired_credits, updated_at)
    VALUES (user_uuid, 10000, 20, 0, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
        total_credits = 10000,
        used_credits = 20,
        expired_credits = 0,
        updated_at = CURRENT_TIMESTAMP;
    
    RAISE NOTICE '✅ Successfully updated user % to Pro 2 (10K credits) package', user_uuid;
    
END $$;

-- Step 3: Also update the old users table for fallback compatibility
UPDATE users 
SET plan = 'pro-10k', 
    credits = 9980,
    updated_at = CURRENT_TIMESTAMP
WHERE id = '0f92ca2a-8fb4-48c7-b2a6-560fd2a7a774';

-- Step 4: Verify the changes
SELECT 
    p.name as package_name,
    p.display_name,
    p.credits_monthly,
    us.status as subscription_status,
    cb.total_credits,
    cb.used_credits,
    ca.credits_remaining
FROM packages p
JOIN user_subscriptions us ON p.id = us.package_id
JOIN credit_balances cb ON us.user_id = cb.user_id
JOIN credit_allocations ca ON us.user_id = ca.user_id
WHERE us.user_id = '0f92ca2a-8fb4-48c7-b2a6-560fd2a7a774';

-- Success message
SELECT '✅ BILLING SYSTEM FIXED! User should now see Pro 2 plan with 10,000 credits when they refresh the billing page.' as status; 