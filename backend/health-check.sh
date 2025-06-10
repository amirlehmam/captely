#!/bin/bash

echo "🔍 CAPTELY HEALTH CHECK"
echo "========================"

# Check container status
echo "📦 Container Status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

echo ""
echo "🗄️  Database Schema Check:"
# Count tables
TABLE_COUNT=$(docker compose exec db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)

if [ "$TABLE_COUNT" -ge "25" ]; then
    echo "✅ Database schema: HEALTHY ($TABLE_COUNT tables)"
else
    echo "⚠️  Database schema: WARNING (only $TABLE_COUNT tables found)"
fi

# Check critical tables
echo ""
echo "🔧 Critical Tables Check:"
docker compose exec db psql -U postgres -d postgres -c "
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN '✅ users' ELSE '❌ users' END,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN '✅ contacts' ELSE '❌ contacts' END,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'import_jobs') THEN '✅ import_jobs' ELSE '❌ import_jobs' END,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verifications') THEN '✅ email_verifications' ELSE '❌ email_verifications' END;
" 2>/dev/null

echo ""
echo "🌐 Service Health Check:"
# Test auth service
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/health 2>/dev/null || echo "000")
if [ "$AUTH_STATUS" = "200" ]; then
    echo "✅ Auth Service: HEALTHY"
else
    echo "❌ Auth Service: DOWN (HTTP $AUTH_STATUS)"
fi

# Test import service
IMPORT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/health 2>/dev/null || echo "000")
if [ "$IMPORT_STATUS" = "200" ]; then
    echo "✅ Import Service: HEALTHY"
else
    echo "❌ Import Service: DOWN (HTTP $IMPORT_STATUS)"
fi

# Test frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend: HEALTHY"
else
    echo "❌ Frontend: DOWN (HTTP $FRONTEND_STATUS)"
fi

echo ""
echo "💾 Database Connection Test:"
DB_TEST=$(docker compose exec db psql -U postgres -d postgres -c "SELECT 'Database connection: OK';" 2>/dev/null | grep "Database connection: OK" || echo "FAILED")
if [[ "$DB_TEST" == *"OK"* ]]; then
    echo "✅ Database: CONNECTED"
else
    echo "❌ Database: CONNECTION FAILED"
fi

echo ""
echo "📊 Quick Stats:"
USER_COUNT=$(docker compose exec db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0")
echo "👥 Total users: $USER_COUNT"

echo ""
if [ "$TABLE_COUNT" -ge "25" ] && [ "$AUTH_STATUS" = "200" ] && [[ "$DB_TEST" == *"OK"* ]]; then
    echo "🎉 OVERALL STATUS: HEALTHY ✅"
    echo "Your website should be working perfectly!"
else
    echo "⚠️  OVERALL STATUS: NEEDS ATTENTION"
    echo "Some issues detected - check the details above"
fi

echo ""
echo "🔗 Access your website at:"
echo "   🏠 Local: http://localhost:3000"
echo "   🌍 Production: https://captely.com" 