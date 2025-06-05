#!/bin/bash

# 🚀 Run Database Migration for Auth Provider
echo "🔧 Running database migration to add auth_provider column..."

# Run the migration SQL file
docker exec -i captely-db psql -U postgres -d postgres < add_auth_provider_migration.sql

echo "✅ Migration completed!"
echo "🔄 Now restart the auth service:"
echo "   docker-compose restart auth-service" 