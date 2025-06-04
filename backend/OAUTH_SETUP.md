# OAuth Setup Guide for Captely

## Quick Fix for Current Issues

### 1. Fix Database Migration (Run on your server)

```bash
# SSH to your server and run this command:
docker exec -i captely-db psql -U postgres -d captely -c "
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

UPDATE users 
SET email_verified = TRUE, auth_provider = 'email'
WHERE password_hash IS NOT NULL AND password_hash != '';
"
```

### 2. Create .env file on your server

Create `/path/to/captely/backend/.env` with:

```bash
# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:postgrespw@db:5432/postgres

# OAuth Configuration - REPLACE WITH REAL VALUES!
VITE_GOOGLE_CLIENT_ID=your-real-google-client-id.apps.googleusercontent.com
VITE_APPLE_CLIENT_ID=com.yourcompany.captely

# Your existing API keys...
ICYPEAS_API=your_icypeas_api_key
DROPCONTACT_API=your_dropcontact_api_key
# ... etc
```

### 3. Get Real OAuth Credentials

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing
3. Enable Google Sign-In API
4. Create OAuth 2.0 Client ID
5. Add your domain: `https://captely.com`
6. Copy the Client ID to your .env file

**Apple Sign-In:**
1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Create a Services ID
3. Configure Sign In with Apple
4. Add your domain: `https://captely.com`

### 4. Rebuild and Deploy

After updating .env, rebuild:

```bash
# On your server:
cd /path/to/captely/backend
docker compose down
docker compose build --no-cache frontend
docker compose up -d
```

## Testing

After these changes:
1. Database migration will add missing OAuth columns
2. Google OAuth will use real credentials (once you set them)
3. Regular email signup will work again

The signup should work immediately after the database fix, even before OAuth is fully configured. 