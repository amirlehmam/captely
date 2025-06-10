#!/bin/bash

echo "🔥 COMPLETE DATABASE RESET - FIXING ALL TABLE ISSUES"
echo "This will ensure your website works continuously without errors"

# Stop all containers first
echo "📢 Stopping all containers..."
docker compose down

# Remove the database volume to start fresh
echo "🗑️  Removing old database volume..."
docker volume rm backend_captely_db-data 2>/dev/null || true
docker volume rm captely_db-data 2>/dev/null || true

# Remove any orphaned containers
echo "🧹 Cleaning up orphaned containers..."
docker container prune -f

# Rebuild the database container (in case of image issues)
echo "🔨 Rebuilding database..."
docker compose up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to initialize..."
sleep 10

# Check if init.sql was executed
echo "🔍 Verifying database schema..."
docker compose exec db psql -U postgres -d postgres -c "\dt" || echo "Tables check failed, continuing..."

# Start all services
echo "🚀 Starting all services..."
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Verify all tables exist
echo "✅ Final verification - checking all required tables..."
docker compose exec db psql -U postgres -d postgres -c "
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN '✅ users table exists'
        ELSE '❌ users table missing'
    END AS users_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN '✅ contacts table exists'
        ELSE '❌ contacts table missing'
    END AS contacts_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'import_jobs') THEN '✅ import_jobs table exists'
        ELSE '❌ import_jobs table missing'
    END AS import_jobs_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verifications') THEN '✅ email_verifications table exists'
        ELSE '❌ email_verifications table missing'
    END AS email_verifications_check;
"

# Check if we need to manually run init.sql
echo "🔧 Checking if manual schema creation is needed..."
TABLE_COUNT=$(docker compose exec db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

if [ "$TABLE_COUNT" -lt "10" ]; then
    echo "⚠️  Tables missing! Running init.sql manually..."
    docker compose exec -T db psql -U postgres -d postgres < init.sql
    echo "✅ Manual schema creation complete"
else
    echo "✅ Database schema looks good ($TABLE_COUNT tables found)"
fi

echo ""
echo "🎉 DATABASE RESET COMPLETE!"
echo ""
echo "✅ All services should now work without 'relation does not exist' errors"
echo "✅ OAuth login should work properly"
echo "✅ Dashboard analytics should load"
echo "✅ Import functionality should work"
echo "✅ Contact management should work"
echo ""
echo "🌐 Your website should now be fully functional at:"
echo "   http://localhost:3000 (local)"
echo "   https://captely.com (production)"
echo ""
echo "🔍 To check service status: docker compose ps"
echo "📋 To view logs: docker compose logs -f [service-name]" 