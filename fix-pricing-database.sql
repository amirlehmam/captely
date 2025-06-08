-- Fix pricing data in packages table
-- Run this on your live server database

-- First, check current pricing data
SELECT name, display_name, price_monthly, price_annual, credits_monthly, is_active 
FROM packages 
WHERE is_active = true 
ORDER BY price_monthly;

-- Update the starter package to correct pricing
UPDATE packages 
SET 
    price_monthly = 25.00,
    price_annual = 240.00,  -- 20% discount: 25*12*0.8 = 240
    updated_at = NOW()
WHERE name = 'starter' AND is_active = true;

-- Update the professional package if it exists
UPDATE packages 
SET 
    price_monthly = 75.00,
    price_annual = 720.00,  -- 20% discount: 75*12*0.8 = 720
    updated_at = NOW()
WHERE name = 'professional' AND is_active = true;

-- Update the enterprise package if it exists
UPDATE packages 
SET 
    price_monthly = 200.00,
    price_annual = 1920.00,  -- 20% discount: 200*12*0.8 = 1920
    updated_at = NOW()
WHERE name = 'enterprise' AND is_active = true;

-- Verify the changes
SELECT name, display_name, price_monthly, price_annual, credits_monthly, is_active 
FROM packages 
WHERE is_active = true 
ORDER BY price_monthly; 