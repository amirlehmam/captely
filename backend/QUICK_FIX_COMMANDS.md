# 🚀 Quick Fix Commands

Run these commands **on your cloud server** in this exact order:

## 1. Fix Database Schema (Required)
```bash
docker exec -i captely-db psql -U postgres -d postgres < backend/add_auth_provider_migration.sql
```

## 2. Restart Services (Required)
```bash
docker-compose restart auth-service
docker-compose restart frontend
```

## 3. Test Email Verification
1. Go to `https://captely.com/signup`
2. Enter `contact@amirlehmam.com`
3. Click "Continue with Email"
4. Check the page - you should see:
   - **Debug info showing**: `Debug: Email in state: "contact@amirlehmam.com"`
   - **Correct email displayed**: "We sent a 6-digit code to **contact@amirlehmam.com**"

## 4. Check Browser Console
- Open Developer Tools (F12)
- Look for console logs starting with `🔧 Frontend Debug:`
- You should see the correct email being sent to backend

## 5. Check Docker Logs
```bash
docker-compose logs auth-service --tail=20
```
Look for debug logs showing:
- `📧 Email validation for contact@amirlehmam.com: True`
- `📤 Attempting to send verification email to: contact@amirlehmam.com`
- `✅ Email sent successfully`

---

**If the email is still wrong after this**, it means there's a frontend state issue that we'll need to investigate further. 