# Fix GitHub OAuth Push Protection Issue

## 🚨 Problem
GitHub detected OAuth credentials in `backend/credentials.json` and blocked your push for security reasons.

## 🔧 Quick Fix Commands

Run these commands in your local repository:

### 1. Remove credentials.json from Git history
```bash
# Remove the file from the current commit
git rm --cached backend/credentials.json

# If the file doesn't exist locally, force remove it from git
git rm --cached backend/credentials.json --ignore-unmatch

# Remove from git history completely (CAREFUL - this rewrites history)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch backend/credentials.json' \
  --prune-empty --tag-name-filter cat -- --all
```

### 2. Update .gitignore to prevent future issues
```bash
# Add to .gitignore
echo "backend/credentials.json" >> .gitignore
echo "*.json" >> backend/.gitignore  
echo ".env*" >> .gitignore
echo "**/.env*" >> .gitignore
```

### 3. Create .env file instead (SECURE)
```bash
# Create .env file in backend/ directory (this stays LOCAL)
cd backend
cat > .env << EOL
# Google OAuth Configuration  
VITE_GOOGLE_CLIENT_ID=622304968200-bu1m53eqbgit3q0kmk35jd4c2260p3hn.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# Apple OAuth
VITE_APPLE_CLIENT_ID=com.captely.signin

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgrespw@db:5432/postgres
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
EOL
```

### 4. Commit the fix
```bash
git add .gitignore
git commit -m "fix: remove OAuth credentials from repo, use env vars instead"
git push origin main --force-with-lease
```

## ✅ Alternative: Use GitHub's "Allow Secret" Option

If you want to keep the credentials in the repo (NOT RECOMMENDED):

1. Click the GitHub link from the error message
2. Choose "Allow secret" 
3. Try pushing again

**⚠️ WARNING: This is not secure for production!**

## 🛡️ Best Practices Going Forward

1. ✅ **Use .env files** for secrets (never commit them)
2. ✅ **Use environment variables** in production
3. ✅ **Add .env* to .gitignore**
4. ❌ **Never commit API keys, passwords, or secrets**

## 🚀 Deploy to Production

After fixing the credentials issue, deploy your OAuth updates:

```bash
# SSH to your server
ssh your-server

# Navigate to project
cd /path/to/captely/backend

# Pull latest changes
git pull origin main

# Run the OAuth deployment script
chmod +x DEPLOY_OAUTH.sh
./DEPLOY_OAUTH.sh
```

This will:
- ✅ Fix the database schema for OAuth
- ✅ Rebuild services with OAuth support
- ✅ Restart affected containers
- ✅ Enable Google/Apple sign-in on both signup AND login pages 