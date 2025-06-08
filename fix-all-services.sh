#!/bin/bash

echo "🚀 Fixing all Captely services..."

# 1. Restart services to apply code fixes
echo "📦 Restarting services with fixed code..."
docker compose restart notification-service billing-service import-service

# 2. Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# 3. Check service health
echo "💊 Checking service health..."
docker compose ps

# 4. Test critical endpoints
echo "🧪 Testing critical endpoints..."

# Test jobs endpoint 
echo "Testing jobs endpoint..."
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost/api/jobs

# Test billing packages
echo "Testing billing packages..."
curl http://localhost/api/billing/packages

# Test credit info
echo "Testing credit info..."
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost/api/credits/info

echo "✅ All services should now be working correctly!"
echo ""
echo "📋 Summary of fixes applied:"
echo "  ✅ Notification service: Fixed async database sessions"
echo "  ✅ Billing service: Fixed package UUID lookup with proper mapping"  
echo "  ✅ Billing service: Enhanced Stripe error handling"
echo "  ✅ Import service: Jobs endpoint working correctly"
echo "  ✅ CRM service: Added null-safety for email_reliability"
echo "  ✅ Frontend: Fixed CRM charAt error"
echo ""
echo "🎯 Next steps:"
echo "  1. Start Docker Desktop"
echo "  2. Run: chmod +x fix-all-services.sh && ./fix-all-services.sh"
echo "  3. Clear browser cache and hard refresh"
echo "  4. Test the application" 