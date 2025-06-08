-- ================================================================
-- Fix User Subscriptions Migration - FOR ALL USERS
-- Adds starter subscriptions for all users who don't have one
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
-- 2. CREATE SUBSCRIPTIONS FOR ALL USERS WITHOUT ONE
-- ================================================================

-- Get all users who don't have any subscription and create starter subscriptions
DO $$
DECLARE 
    starter_package_id UUID;
    user_record RECORD;
    users_processed INTEGER := 0;
BEGIN
    -- Get the starter package ID
    SELECT id INTO starter_package_id 
    FROM packages 
    WHERE name = 'starter' 
    LIMIT 1;
    
    IF starter_package_id IS NULL THEN
        RAISE EXCEPTION 'Starter package not found!';
    END IF;
    
    RAISE NOTICE 'Found starter package ID: %', starter_package_id;
    
    -- Loop through all users who don't have subscriptions
    FOR user_record IN 
        SELECT DISTINCT u.id as user_id
        FROM users u
        LEFT JOIN user_subscriptions us ON u.id = us.user_id
        WHERE us.user_id IS NULL
    LOOP
        -- Create subscription for this user
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
            user_record.user_id,
            starter_package_id,
            'monthly',
            'active',
            NOW(),
            NOW() + INTERVAL '30 days',
            NOW(),
            NOW()
        );
        
        users_processed := users_processed + 1;
        RAISE NOTICE 'Created starter subscription for user: %', user_record.user_id;
    END LOOP;
    
    RAISE NOTICE 'Total users processed: %', users_processed;
END $$;

-- ================================================================
-- 3. VERIFY ALL SUBSCRIPTIONS WERE CREATED
-- ================================================================

-- Show all users and their subscription status
SELECT 
    u.id as user_id,
    u.email,
    CASE 
        WHEN us.id IS NOT NULL THEN 'HAS_SUBSCRIPTION'
        ELSE 'NO_SUBSCRIPTION'
    END as subscription_status,
    p.name as package_name,
    p.display_name,
    us.status as sub_status,
    us.billing_cycle
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
LEFT JOIN packages p ON us.package_id = p.id
ORDER BY u.email;

-- ================================================================
-- 4. SUMMARY STATISTICS
-- ================================================================

-- Show summary of subscriptions
SELECT 
    'TOTAL_USERS' as metric,
    COUNT(*) as count
FROM users
UNION ALL
SELECT 
    'USERS_WITH_SUBSCRIPTIONS' as metric,
    COUNT(DISTINCT us.user_id) as count
FROM user_subscriptions us
UNION ALL
SELECT 
    'USERS_WITHOUT_SUBSCRIPTIONS' as metric,
    COUNT(*) as count
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
WHERE us.user_id IS NULL
UNION ALL
SELECT 
    'STARTER_SUBSCRIPTIONS' as metric,
    COUNT(*) as count
FROM user_subscriptions us
JOIN packages p ON us.package_id = p.id
WHERE p.name = 'starter';

-- ================================================================
-- 5. SHOW CREDIT BALANCES FOR ALL USERS
-- ================================================================

SELECT 
    cb.user_id,
    u.email,
    cb.total_credits,
    cb.used_credits,
    cb.expired_credits,
    cb.updated_at as balance_updated
FROM credit_balances cb
JOIN users u ON cb.user_id = u.id
ORDER BY u.email;

COMMIT;

-- ================================================================
-- Migration completed successfully for ALL USERS!
-- ================================================================ 