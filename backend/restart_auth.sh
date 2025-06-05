#!/bin/bash

# 🔧 Quick Fix Script for Email Verification Issue

echo "🚀 Starting email verification fix..."

# 1. Run database migration
echo "📊 Running database migration..."
docker exec -i captely-db psql -U postgres -d postgres < backend/add_auth_provider_migration.sql

# 2. Restart auth service to apply code changes
echo "🔄 Restarting auth service..."
docker-compose restart auth-service

# 3. Wait for service to be ready
echo "⏳ Waiting for auth service to start..."
sleep 10

# 4. Check if auth service is running
echo "✅ Checking auth service status..."
docker-compose ps auth-service

echo "🎉 Fix completed! Test email verification now."
echo ""
echo "Expected debug logs:"
echo "📧 Email validation for contact@amirlehmam.com: True"
echo "📤 Attempting to send verification email to: contact@amirlehmam.com"
echo "🔑 Generated code: 123456"
echo "📨 Sending email FROM: Captely <noreply@captely.com> TO: ['contact@amirlehmam.com']"
echo "✅ Email sent successfully: ..." 