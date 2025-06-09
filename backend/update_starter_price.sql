-- Update starter package pricing from €19 to €25
UPDATE packages 
SET 
    price_monthly = 25.00,
    price_annual = 240.00,
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'starter';

-- Verify the update
SELECT name, display_name, price_monthly, price_annual 
FROM packages 
WHERE name = 'starter'; 