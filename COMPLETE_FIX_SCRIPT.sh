#!/bin/bash

echo "🚀 COMPLETE CAPTELY FIX - Resolving ALL Issues"
echo "============================================="

# 1. Force rebuild frontend with no cache to deploy charAt fixes
echo "📦 Step 1: Force rebuilding frontend with charAt fixes..."
docker compose build --no-cache frontend

# 2. Restart nginx to apply batches routing fix
echo "🌐 Step 2: Restarting nginx to fix batches routing..."
docker compose restart nginx

# 3. Restart frontend to deploy new build
echo "🎨 Step 3: Restarting frontend service..."
docker compose restart frontend

# 4. Wait for services to be ready
echo "⏳ Step 4: Waiting for services to stabilize..."
sleep 15

# 5. Check service health
echo "💊 Step 5: Checking service health..."
docker compose ps

# 6. Test critical endpoints
echo "🧪 Step 6: Testing fixed endpoints..."

echo ""
echo "Testing batches endpoint (should now go to import-service):"
curl -s -I http://localhost/api/crm/batches | head -1

echo ""
echo "Testing CRM contacts endpoint:"
curl -s -I http://localhost/api/contacts | head -1

# 7. Final verification
echo ""
echo "✅ FIXES APPLIED:"
echo "  🔧 Fixed Sidebar charAt error (firstName/lastName null-safety)"
echo "  🔧 Fixed Import page charAt error (job.status null-safety)"  
echo "  🔧 Fixed Settings page charAt error (member.name null-safety)"
echo "  🔧 Fixed ProviderStatus charAt error (provider.status null-safety)"
echo "  🔧 Fixed RecentBatches charAt error (job.status null-safety)"
echo "  🔧 Fixed CRM charAt error (email_reliability null-safety) - ALREADY APPLIED"
echo "  🛣️ Fixed batches routing (/api/crm/batches → import-service)"
echo ""
echo "🎯 NEXT STEPS:"
echo "  1. Clear your browser cache completely (Ctrl+Shift+Del)"
echo "  2. Hard refresh the CRM page (Ctrl+Shift+R)"
echo "  3. Navigate to /batches - should now show your imported batch!"
echo "  4. CRM page should load without charAt errors"
echo ""
echo "📊 Your batch 'c317e697-1acd-4141-ac57-09f63d3932bf' should now be visible!" 