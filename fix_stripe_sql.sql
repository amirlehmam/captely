-- DIRECT FIX FOR STRIPE PRICE ID ISSUE
-- Run this SQL to clear invalid Stripe price IDs so the system can create new ones

-- Show current packages with invalid price IDs
SELECT 'BEFORE FIX - Current packages:' as status;
SELECT name, display_name, credits_monthly, price_monthly, price_annual, 
       stripe_price_id_monthly, stripe_price_id_annual 
FROM packages 
WHERE is_active = true 
ORDER BY credits_monthly;

-- Clear all invalid Stripe price IDs
UPDATE packages 
SET stripe_price_id_monthly = NULL, 
    stripe_price_id_annual = NULL 
WHERE is_active = true;

-- Show updated packages
SELECT 'AFTER FIX - Updated packages (NULL price IDs will be auto-created):' as status;
SELECT name, display_name, credits_monthly, price_monthly, price_annual, 
       stripe_price_id_monthly, stripe_price_id_annual 
FROM packages 
WHERE is_active = true 
ORDER BY credits_monthly;

SELECT '✅ FIXED! Now try clicking "Buy this pack" - it should work!' as result; 