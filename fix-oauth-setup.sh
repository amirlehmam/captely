#!/bin/bash

echo "🔧 Fixing Captely OAuth and Database Issues..."

# Step 1: Fix Database Schema
echo "📊 Fixing database schema..."
docker exec -i captely-db psql -U postgres -d postgres -c "
-- Add OAuth columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Make password_hash nullable for OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Update existing users to mark them as email verified
UPDATE users 
SET email_verified = TRUE, auth_provider = 'email'
WHERE password_hash IS NOT NULL AND password_hash != '';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

SELECT 'Database schema updated successfully!' as message;
"

# Step 2: Create .env file if it doesn't exist
echo "⚙️  Creating .env configuration..."
if [ ! -f "./backend/.env" ]; then
cat > ./backend/.env << EOF
# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:postgrespw@db:5432/postgres

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# Apple OAuth Configuration
VITE_APPLE_CLIENT_ID=com.captely.signin

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_ALGORITHM=HS256
JWT_EXP_MINUTES=1440

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Email Configuration
FROM_EMAIL=noreply@captely.com

# CORS Origins
CORS_ORIGINS=["https://captely.com", "http://localhost:3000", "http://localhost:5173"]
EOF
    echo "✅ Created .env file with OAuth configuration"
else
    echo "ℹ️  .env file already exists - please manually add these variables:"
    echo "VITE_GOOGLE_CLIENT_ID=your-google-client-id-here"
    echo "GOOGLE_CLIENT_SECRET=your-google-client-secret-here"
fi

# Step 3: Restart services
echo "🔄 Restarting services..."
cd backend
docker-compose down
docker-compose build --no-cache frontend auth-service
docker-compose up -d

echo "✅ OAuth setup complete!"
echo ""
echo "🔍 Next steps:"
echo "1. Verify that https://captely.com is added to your Google OAuth redirect URIs"
echo "2. Add these redirect URIs to your Google Console:"
echo "   - https://captely.com"
echo "   - https://captely.com/login"
echo "   - https://captely.com/signup"
echo "3. Test OAuth login at https://captely.com/login"
echo ""
echo "🌐 Google OAuth Console: https://console.developers.google.com/apis/credentials" 