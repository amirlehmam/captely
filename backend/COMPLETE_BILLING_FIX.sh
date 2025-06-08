#!/bin/bash

# ================================================================
# COMPLETE BILLING & SUBSCRIPTION FIX SCRIPT
# ================================================================

echo "🚀 Starting complete billing and subscription fix..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ================================================================
# 1. CHECK ENVIRONMENT VARIABLES
# ================================================================

echo -e "${BLUE}📋 Step 1: Checking environment variables...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file missing!${NC}"
    echo -e "${YELLOW}Please create backend/.env with your Stripe keys!${NC}"
    exit 1
else
    echo -e "${GREEN}✅ .env file found${NC}"
fi

# Check if Stripe keys are in .env
if grep -q "STRIPE_SECRET_KEY=sk_live" .env; then
    echo -e "${GREEN}✅ Stripe secret key found in .env${NC}"
else
    echo -e "${RED}❌ Stripe secret key missing or invalid in .env${NC}"
    exit 1
fi

# ================================================================
# 2. RESTART SERVICES WITH ENVIRONMENT
# ================================================================

echo -e "${BLUE}🔄 Step 2: Restarting services with updated environment...${NC}"

docker compose down
sleep 3
docker compose up -d --force-recreate

# Wait for services to start
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 10

# ================================================================
# 3. CHECK SERVICE HEALTH
# ================================================================

echo -e "${BLUE}🏥 Step 3: Checking service health...${NC}"

# Check billing service
if curl -s http://localhost:8007/health | grep -q "healthy"; then
    echo -e "${GREEN}✅ Billing service is healthy${NC}"
else
    echo -e "${RED}❌ Billing service is not responding${NC}"
fi

# Check database
if docker exec captely-db pg_isready -U postgres -d postgres | grep -q "accepting connections"; then
    echo -e "${GREEN}✅ Database is healthy${NC}"
else
    echo -e "${RED}❌ Database is not responding${NC}"
fi

# ================================================================
# 4. VERIFY STRIPE CONFIGURATION
# ================================================================

echo -e "${BLUE}🔧 Step 4: Testing Stripe configuration...${NC}"

# Check if billing service can load Stripe
STRIPE_TEST=$(docker logs captely-billing-service 2>&1 | grep -i "stripe")
if echo "$STRIPE_TEST" | grep -q "initialized successfully"; then
    echo -e "${GREEN}✅ Stripe initialized successfully${NC}"
else
    echo -e "${RED}❌ Stripe initialization failed${NC}"
    echo "Billing service logs:"
    docker logs captely-billing-service --tail 20
fi

# ================================================================
# 5. VERIFY SUBSCRIPTIONS IN DATABASE
# ================================================================

echo -e "${BLUE}📊 Step 5: Checking user subscriptions...${NC}"

SUBSCRIPTION_COUNT=$(docker exec -i captely-db psql -U postgres -d postgres -t -c "
SELECT COUNT(*) as subscription_count 
FROM user_subscriptions us 
JOIN packages p ON us.package_id = p.id 
WHERE us.status = 'active';" | tr -d ' ')

echo -e "${GREEN}✅ Found ${SUBSCRIPTION_COUNT} active subscriptions${NC}"

# Show subscription details
echo -e "${BLUE}Subscription details:${NC}"
docker exec -i captely-db psql -U postgres -d postgres -c "
SELECT 
    u.email,
    p.display_name as plan,
    us.status,
    us.billing_cycle,
    us.created_at
FROM user_subscriptions us
JOIN packages p ON us.package_id = p.id
JOIN users u ON us.user_id = u.id
ORDER BY u.email;"

# ================================================================
# 6. TEST BILLING ENDPOINTS
# ================================================================

echo -e "${BLUE}🌐 Step 6: Testing billing endpoints...${NC}"

# Test billing packages endpoint
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8007/api/billing/packages" | grep -q "200"; then
    echo -e "${GREEN}✅ Billing packages endpoint working${NC}"
else
    echo -e "${RED}❌ Billing packages endpoint failed${NC}"
fi

# ================================================================
# 7. CHECK NGINX ROUTING
# ================================================================

echo -e "${BLUE}🔀 Step 7: Testing nginx routing...${NC}"

# Test nginx config
if docker exec captely-nginx nginx -t 2>/dev/null; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration has errors${NC}"
fi

# Reload nginx config
docker exec captely-nginx nginx -s reload

# ================================================================
# 8. CREATE MISSING CREDIT BALANCES
# ================================================================

echo -e "${BLUE}💳 Step 8: Ensuring all users have credit balances...${NC}"

docker exec -i captely-db psql -U postgres -d postgres -c "
-- Create credit balances for users who don't have them
INSERT INTO credit_balances (user_id, total_credits, used_credits, expired_credits, created_at, updated_at)
SELECT 
    u.id,
    500, -- Default starter credits
    0,   -- No credits used initially 
    0,   -- No expired credits
    NOW(),
    NOW()
FROM users u
LEFT JOIN credit_balances cb ON u.id = cb.user_id
WHERE cb.user_id IS NULL;

-- Show credit balance summary
SELECT 
    u.email,
    COALESCE(cb.total_credits, 0) as total_credits,
    COALESCE(cb.used_credits, 0) as used_credits
FROM users u
LEFT JOIN credit_balances cb ON u.id = cb.user_id
ORDER BY u.email;
"

# ================================================================
# 9. SHOW FINAL STATUS
# ================================================================

echo -e "${BLUE}📈 Step 9: Final status check...${NC}"

echo ""
echo "=== FINAL STATUS ==="
echo ""

# Show users and their subscriptions
echo -e "${GREEN}Users and Subscriptions:${NC}"
docker exec -i captely-db psql -U postgres -d postgres -c "
SELECT 
    u.email,
    CASE 
        WHEN us.id IS NOT NULL THEN p.display_name
        ELSE 'NO_SUBSCRIPTION'
    END as current_plan,
    CASE 
        WHEN us.id IS NOT NULL THEN us.status
        ELSE 'N/A'
    END as status
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
LEFT JOIN packages p ON us.package_id = p.id
ORDER BY u.email;"

echo ""
echo -e "${GREEN}🎉 Billing fix script completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Visit https://captely.com/billing"
echo "2. Check if 'Current Plan' shows 'Starter' instead of 'Unknown'"
echo "3. Try clicking 'Buy this pack' to test Stripe integration"
echo ""
echo "If issues persist, check:"
echo "- Docker logs: docker logs captely-billing-service"
echo "- Nginx logs: docker logs captely-nginx"
echo "- Database connectivity" 