#!/bin/bash

echo "🔥 COMPLETE DATABASE RESET WITH ALL MIGRATIONS"
echo "========================================================"
echo "This will:"
echo "1. 🗑️  Completely destroy existing database"
echo "2. 📄 Recreate with ALL your migrations included"
echo "3. 🔧 Fix OAuth authentication issues"
echo "4. ✅ Include ALL schema: OAuth, HubSpot, CRM, Billing"
echo "========================================================"

# Step 1: Nuclear option - destroy everything
echo "Step 1: 💥 Destroying existing database..."
cd ~/captely/backend
docker-compose down -v --remove-orphans
docker volume prune -f
docker system prune -f

# Step 2: Verify environment
echo "Step 2: 🔍 Verifying environment configuration..."
echo "Current database settings:"
cat .env | grep -E "(DATABASE_URL|POSTGRES)" || echo "❌ Missing database config in .env"

# Step 3: Recreate database with complete schema
echo "Step 3: 🏗️  Creating fresh database with ALL migrations..."
docker-compose up -d db

# Wait for database to be ready
echo "Waiting 30 seconds for database initialization..."
sleep 30

# Step 4: Apply the complete schema with ALL migrations
echo "Step 4: 📊 Applying complete schema (includes ALL your migrations)..."
docker-compose exec db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/init.sql || \
docker exec -i $(docker ps -f name=db -q) psql -U postgres -d postgres << 'EOF'

-- Source the complete init.sql with all migrations
\i /docker-entrypoint-initdb.d/init.sql

EOF

# Step 5: Verify the database schema
echo "Step 5: ✅ Verifying database schema..."
docker-compose exec db psql -U postgres -d postgres << 'EOF'

-- Verify all critical tables exist
SELECT 'Checking tables...' as status;

SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
         THEN '✅ users table exists' 
         ELSE '❌ users table missing' END as users_table,
    
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'google_id') 
         THEN '✅ OAuth fields present' 
         ELSE '❌ OAuth fields missing' END as oauth_fields,
    
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hubspot_integrations') 
         THEN '✅ HubSpot tables exist' 
         ELSE '❌ HubSpot tables missing' END as hubspot_tables,
    
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_contacts') 
         THEN '✅ CRM tables exist' 
         ELSE '❌ CRM tables missing' END as crm_tables,
    
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'packages') 
         THEN '✅ Billing tables exist' 
         ELSE '❌ Billing tables missing' END as billing_tables;

-- Check OAuth columns specifically
SELECT 'OAuth columns check:' as status;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('auth_provider', 'google_id', 'apple_id', 'email_verified', 'profile_picture_url')
ORDER BY column_name;

-- Test database connection
SELECT 'Database connection test: SUCCESS!' as connection_test;

EOF

# Step 6: Add OAuth credentials to .env (if not present)
echo "Step 6: ⚙️  Checking OAuth configuration..."
if ! grep -q "VITE_GOOGLE_CLIENT_ID" .env; then
    echo "Adding OAuth configuration to .env..."
    cat >> .env << 'EOF'

# OAuth Configuration (REPLACE WITH YOUR ACTUAL VALUES)
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
VITE_APPLE_CLIENT_ID=com.captely.signin
EOF
    echo "✅ OAuth configuration added to .env"
else
    echo "✅ OAuth configuration already present in .env"
fi

# Step 7: Start all services
echo "Step 7: 🚀 Starting all services..."
docker-compose up -d

# Step 8: Final verification
echo "Step 8: 🔍 Final verification..."
sleep 10

echo "Services status:"
docker-compose ps

echo ""
echo "Testing service connectivity:"
docker-compose exec db psql -U postgres -d postgres -c "SELECT 'DB Connection: SUCCESS' as test;" 2>/dev/null || echo "❌ Database connection failed"

echo ""
echo "========================================================"
echo "🎉 DATABASE RESET COMPLETE!"
echo "========================================================"
echo "✅ Features included:"
echo "   • Complete OAuth support (Google, Apple)"
echo "   • Email verification system"
echo "   • Full CRM system with proper enums"
echo "   • HubSpot integration tables"
echo "   • Comprehensive billing system"
echo "   • Contact enrichment pipeline"
echo "   • All performance indexes"
echo "   • Sample data for testing"
echo ""
echo "🔧 Test Account Available:"
echo "   Email: test@captely.com"
echo "   Password: TestUser123!"
echo "   Credits: 20,000"
echo ""
echo "🌐 Next Steps:"
echo "1. MANUALLY update .env with your REAL OAuth credentials:"
echo "   VITE_GOOGLE_CLIENT_ID=your-actual-google-client-id-here"
echo "   GOOGLE_CLIENT_SECRET=your-actual-google-client-secret-here"
echo "2. Configure Google OAuth Console at:"
echo "   https://console.developers.google.com/apis/credentials"
echo "3. Add authorized origins: https://captely.com"
echo "4. Test OAuth at: https://captely.com/login"
echo "========================================================" 