#!/bin/bash
# Script to run lead score recalculation inside Docker containers

echo "🐳 DOCKER LEAD SCORE FIX SCRIPT"
echo "================================"

# First, let's check what containers are running
echo "📊 Checking running containers..."
docker ps

echo ""
echo "🔍 Looking for database container..."

# Try to find the database container (common names)
DB_CONTAINER=$(docker ps --format "table {{.Names}}" | grep -E "(postgres|db|database|captely.*db)" | head -1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ Database container not found. Let's list all containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    echo ""
    echo "💡 Please run: docker ps"
    echo "💡 Then use Method 2 or 3 below with your actual container name"
    exit 1
fi

echo "✅ Found database container: $DB_CONTAINER"

# Copy our Python script into the container
echo "📁 Copying lead score fix script into container..."
docker cp fix_scores.py $DB_CONTAINER:/tmp/

# Install psycopg2 in the container and run our script
echo "🔧 Installing dependencies and running lead score recalculation..."
docker exec $DB_CONTAINER bash -c "
    apt-get update -qq && apt-get install -y python3-pip -qq &&
    pip3 install psycopg2-binary &&
    cd /tmp &&
    python3 fix_scores.py
"

echo "✅ Lead score recalculation completed!"
echo "💡 Check your CRM contacts page to see the results" 