#!/usr/bin/env powershell

Write-Host "🔧 Fixing Captely OAuth and Database Issues..." -ForegroundColor Green

# Step 1: Fix Database Schema
Write-Host "📊 Fixing database schema..." -ForegroundColor Yellow
docker exec -i captely-db psql -U postgres -d postgres -c @"
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
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database schema updated successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Database schema update failed!" -ForegroundColor Red
}

# Step 2: Create .env file if it doesn't exist
Write-Host "⚙️  Checking .env configuration..." -ForegroundColor Yellow
$envPath = ".\backend\.env"

if (!(Test-Path $envPath)) {
    Write-Host "Creating .env file with OAuth configuration..." -ForegroundColor Blue
    
    $envContent = @"
# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:postgrespw@db:5432/postgres

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# Apple OAuth Configuration
VITE_APPLE_CLIENT_ID=com.captely.signin

# JWT Configuration
JWT_SECRET=$([System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random).ToString() + (Get-Date).Ticks)))
JWT_ALGORITHM=HS256
JWT_EXP_MINUTES=1440

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Email Configuration
FROM_EMAIL=noreply@captely.com

# CORS Origins
CORS_ORIGINS=["https://captely.com", "http://localhost:3000", "http://localhost:5173"]
"@
    
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    Write-Host "✅ Created .env file with OAuth configuration" -ForegroundColor Green
} else {
    Write-Host "ℹ️  .env file already exists - please manually add these variables:" -ForegroundColor Blue
    Write-Host "VITE_GOOGLE_CLIENT_ID=your-google-client-id-here" -ForegroundColor Cyan
    Write-Host "GOOGLE_CLIENT_SECRET=your-google-client-secret-here" -ForegroundColor Cyan
}

# Step 3: Restart services
Write-Host "🔄 Restarting services..." -ForegroundColor Yellow
Set-Location backend
docker-compose down
docker-compose build --no-cache frontend auth-service
docker-compose up -d

Write-Host "✅ OAuth setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Next steps:" -ForegroundColor Blue
Write-Host "1. Verify that https://captely.com is added to your Google OAuth redirect URIs" -ForegroundColor White
Write-Host "2. Add these redirect URIs to your Google Console:" -ForegroundColor White
Write-Host "   - https://captely.com" -ForegroundColor Cyan
Write-Host "   - https://captely.com/login" -ForegroundColor Cyan
Write-Host "   - https://captely.com/signup" -ForegroundColor Cyan
Write-Host "3. Test OAuth login at https://captely.com/login" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Google OAuth Console: https://console.developers.google.com/apis/credentials" -ForegroundColor Blue 