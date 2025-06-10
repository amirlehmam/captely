-- Fix user subscription to 10,000 credits package
-- User ID: 0f92ca2a-8fb4-48c7-b2a6-560fd2a7a774

-- First, get the 10K package ID
DO $$
DECLARE
    user_uuid UUID := '0f92ca2a-8fb4-48c7-b2a6-560fd2a7a774';
    package_10k_id UUID;
    subscription_id UUID;
BEGIN
    -- Get the 10K credits package
    SELECT id INTO package_10k_id FROM packages WHERE credits_monthly = 10000 LIMIT 1;
    
    IF package_10k_id IS NULL THEN
        RAISE NOTICE 'No 10K package found, creating one...';
        INSERT INTO packages (id, name, display_name, plan_type, credits_monthly, price_monthly, price_annual, is_active, popular)
        VALUES (uuid_generate_v4(), 'pro-10k', 'Enterprise', 'enterprise', 10000, 380.00, 3800.00, true, false)
        RETURNING id INTO package_10k_id;
    END IF;
    
    RAISE NOTICE 'Using package ID: %', package_10k_id;
    
    -- Delete existing subscription for this user
    DELETE FROM user_subscriptions WHERE user_id = user_uuid;
    
    -- Create new subscription
    INSERT INTO user_subscriptions (
        id, user_id, package_id, billing_cycle, status,
        current_period_start, current_period_end
    ) VALUES (
        uuid_generate_v4(), user_uuid, package_10k_id, 'monthly', 'active',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days'
    ) RETURNING id INTO subscription_id;
    
    RAISE NOTICE 'Created subscription ID: %', subscription_id;
    
    -- Delete existing credit allocations
    DELETE FROM credit_allocations WHERE user_id = user_uuid;
    
    -- Create new credit allocation
    INSERT INTO credit_allocations (
        id, user_id, credits_allocated, credits_remaining,
        allocated_at, expires_at, source, billing_cycle, subscription_id
    ) VALUES (
        uuid_generate_v4(), user_uuid, 10000, 9980,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days',
        'manual_fix_10k', 'monthly', subscription_id
    );
    
    -- Update or create credit balance
    INSERT INTO credit_balances (user_id, total_credits, used_credits, expired_credits)
    VALUES (user_uuid, 10000, 20, 0)
    ON CONFLICT (user_id) DO UPDATE SET
        total_credits = 10000,
        used_credits = 20,
        expired_credits = 0,
        updated_at = CURRENT_TIMESTAMP;
    
    RAISE NOTICE '✅ Successfully updated user % to 10K credits package', user_uuid;
    
END $$; 