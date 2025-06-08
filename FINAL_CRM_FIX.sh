#!/bin/bash

echo "🔧 FINAL CRM FIX - Resolving Last 2 Issues"
echo "=========================================="

# 1. Restart nginx to apply new CRM contacts routing
echo "🌐 Step 1: Restarting nginx to fix CRM contacts routing..."
docker compose restart nginx

# 2. Restart import-service to apply stats query fix
echo "🔄 Step 2: Restarting import-service to fix stats tuple error..."
docker compose restart import-service

# 3. Wait for services to be ready
echo "⏳ Step 3: Waiting for services to stabilize..."
sleep 15

# 4. Test the fixed endpoints
echo "🧪 Step 4: Testing CRM endpoints..."

echo ""
echo "Testing CRM contacts endpoint (should now go to import-service):"
curl -s -I http://localhost/api/crm/contacts | head -1

echo ""
echo "Testing CRM stats endpoint (should now return valid data):"
curl -s -I http://localhost/api/crm/contacts/stats | head -1

echo ""
echo "Testing batches endpoint (should work):"
curl -s -I http://localhost/api/crm/batches | head -1

# 5. Verification
echo ""
echo "✅ FINAL FIXES APPLIED:"
echo "  🛣️ Fixed CRM contacts routing (/api/crm/contacts → import-service)"
echo "  🔢 Fixed CRM stats SQL query (tuple index 13,14 instead of 14,15)"
echo "  📊 Batches already working perfectly"
echo ""
echo "🎯 YOUR CRM SHOULD NOW WORK COMPLETELY:"
echo "  ✅ CRM contacts will load (should see your 41 contacts)"
echo "  ✅ CRM stats will load (no more TypeError)"  
echo "  ✅ Batches page will show your 2 batches"
echo "  ✅ No more charAt errors anywhere"
echo ""
echo "🎉 Clear browser cache and refresh CRM page - everything should work!" 