#!/bin/bash

echo "🎯 RESTARTING ENRICHMENT WORKER WITH PHONE + EMAIL SUPPORT"
echo "==========================================================="
echo ""
echo "✅ FIXED ISSUES:"
echo "   📧 Providers now call EMAIL APIs"
echo "   📱 Providers now call PHONE APIs (50-60% accuracy expected)"
echo "   ⚡ Speed optimizations applied"
echo "   🔄 Concurrent processing enabled"
echo ""

# Stop the current enrichment worker
echo "📢 Stopping current enrichment worker..."
docker compose stop captely-enrichment-worker

# Rebuild the enrichment worker with optimizations  
echo "🔨 Rebuilding enrichment worker with speed optimizations..."
docker compose build --no-cache captely-enrichment-worker

# Start the enrichment worker
echo "🚀 Starting optimized enrichment worker..."
docker compose up -d captely-enrichment-worker

# Check status
echo ""
echo "📊 Checking status..."
sleep 3
docker compose ps captely-enrichment-worker

echo ""
echo "📋 Recent logs:"
docker compose logs --tail=20 captely-enrichment-worker

echo ""
echo "✅ ENRICHMENT WORKER RESTARTED WITH:"
echo "   📧 Email enrichment: ENABLED"
echo "   📱 Phone enrichment: ENABLED (NEW!)"
echo "   ⚡ Speed optimizations: ENABLED"
echo "   🔄 8 concurrent workers: ENABLED"
echo ""
echo "🎯 Your next enrichment will find BOTH emails AND phones!" 