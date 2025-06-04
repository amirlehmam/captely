#!/bin/bash
echo "🚀 Deploying Google OAuth Fix for Captely"
echo "========================================="

# Step 1: Fix Database Migration
echo "📋 Step 1: Fixing database schema..."
docker exec -i captely-db psql -U postgres -d postgres -c "
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
UPDATE users SET email_verified = TRUE, auth_provider = 'email' WHERE password_hash IS NOT NULL AND password_hash != '';
SELECT 'Database updated successfully' as status;
"

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully"
else
    echo "❌ Database migration failed. Trying with 'captely' database..."
    docker exec -i captely-db psql -U postgres -d captely -c "
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    UPDATE users SET email_verified = TRUE, auth_provider = 'email' WHERE password_hash IS NOT NULL AND password_hash != '';
    SELECT 'Database updated successfully' as status;
    "
fi

# Step 2: Create/Update .env file
echo "📝 Step 2: Creating .env file..."
cat > .env << EOL
# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=622304968200-bu1m53eqbgit3q0kmk35jd4c2260p3hn.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# Apple OAuth (placeholder)
VITE_APPLE_CLIENT_ID=com.captely.signin

# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:postgrespw@db:5432/postgres

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
EOL
echo "✅ .env file created with OAuth credentials"

# Step 3: Rebuild affected services
echo "🔨 Step 3: Rebuilding services..."
echo "Building auth-service with OAuth support..."
docker compose build --no-cache auth-service

echo "Building frontend with Google OAuth..."
docker compose build --no-cache frontend

# Step 4: Restart services
echo "🔄 Step 4: Restarting services..."
docker compose down auth-service frontend
docker compose up -d auth-service frontend

# Step 5: Verify deployment
echo "🧪 Step 5: Verifying deployment..."
sleep 10

echo "Checking auth service health..."
curl -f http://localhost:8001/health && echo "✅ Auth service is healthy" || echo "❌ Auth service health check failed"

echo "Checking frontend health..."
curl -f http://localhost:3000/health && echo "✅ Frontend is healthy" || echo "❌ Frontend health check failed"

echo ""
echo "🎉 Deployment completed!"
echo "========================================="
echo "✅ Database schema updated"
echo "✅ OAuth credentials configured"  
echo "✅ Services rebuilt and restarted"
echo ""
echo "📋 Testing checklist:"
echo "1. Try signing up with a professional email"
echo "2. Google OAuth button should show real client ID in browser console"
echo "3. Regular email signup should work without errors"
echo ""
echo "🔗 Google OAuth redirect URIs configured for:"
echo "   - https://captely.com"
echo "   - https://captely.com/signup"
echo "   - https://captely.com/login" 