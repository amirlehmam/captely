# 🔧 Restart Services After Email Verification Fix

## Problem Fixed
- ❌ **Before**: `/auth/send-verification` → `auth_service/auth/send-verification` (double auth)
- ✅ **After**: `/auth/send-verification` → `auth_service/auth/send-verification` (correct)

## Quick Fix Steps

### 1. Restart Nginx (Priority)
```bash
docker-compose restart nginx
```

### 2. Restart Auth Service (if needed)
```bash
docker-compose restart auth-service
```

### 3. Check Service Logs
```bash
# Check nginx logs
docker-compose logs nginx

# Check auth service logs  
docker-compose logs auth-service
```

### 4. Test the Fix
1. Go to signup page: `https://captely.com/signup`
2. Enter a professional email (not Gmail/Yahoo)
3. Click "Continue with Email"
4. Should now work without the double `/auth/auth/` error

## Environment Check

Make sure your `.env` file has:
```env
RESEND_API_KEY=re_GTEP8qWk_KQ5G4nR4FZKpR8PiL5U7d5Zt
```

## Expected Working Flow
1. ✅ Professional email validation
2. ✅ Send verification code via Resend
3. ✅ User receives 6-digit code
4. ✅ Code verification
5. ✅ Proceed to step 2 of signup

## Test Commands

### Quick Health Check
```bash
# Test auth service directly
curl -X POST "https://captely.com/auth/send-verification" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@company.com"}'
```

### Database Check
```bash
# Check if email verification table exists
docker exec captely-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM email_verifications;"
```

The nginx proxy configuration was causing the double `/auth/` path. This is now fixed! 🎉 