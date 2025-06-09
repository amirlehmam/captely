#!/bin/bash

echo "🔄 Restarting all Captely services..."

# Stop all services
echo "⏹️ Stopping all services..."
pkill -f "python.*main.py" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "celery" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true

# Wait a moment for processes to stop
sleep 3

echo "🚀 Starting services..."

# Start backend services
echo "📦 Starting Auth Service..."
cd backend/services/auth-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload &

echo "💳 Starting Credit Service..."
cd ../../.. && cd backend/services/credit-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload &

echo "📈 Starting Analytics Service..."
cd ../../.. && cd backend/services/analytics-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload &

echo "📤 Starting Export Service..."
cd ../../.. && cd backend/services/export-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload &

echo "📥 Starting Import Service..."
cd ../../.. && cd backend/services/import-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload &

echo "💰 Starting Billing Service..."
cd ../../.. && cd backend/services/billing-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload &

echo "🔔 Starting Notification Service..."
cd ../../.. && cd backend/services/notification-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8007 --reload &

echo "🔍 Starting CRM Service..."
cd ../../.. && cd backend/services/crm-service && python -m uvicorn app.main:app --host 0.0.0.0 --port 8008 --reload &

echo "⚙️ Starting Enrichment Worker..."
cd ../../.. && cd backend/services/enrichment-worker && celery -A app.tasks worker --loglevel=info &

echo "🌐 Starting Frontend..."
cd ../../.. && cd backend/frontend/nextjs-app && npm start &

echo "✅ All services started!"
echo ""
echo "🔗 Service URLs:"
echo "Frontend: http://localhost:3000"
echo "Auth Service: http://localhost:8001"
echo "Credit Service: http://localhost:8002"
echo "Analytics Service: http://localhost:8003"
echo "Export Service: http://localhost:8004"
echo "Import Service: http://localhost:8005"
echo "Billing Service: http://localhost:8006"
echo "Notification Service: http://localhost:8007"
echo "CRM Service: http://localhost:8008"
echo ""
echo "🎉 Credit display fix has been applied!"
echo "   - Fixed race condition between login and credit fetching"
echo "   - Improved error handling to prevent 'Error' display"
echo "   - Added retry mechanism for failed credit API calls"
echo "   - Updated backend to return proper credit data structure"
echo ""
echo "📝 To test the fix:"
echo "   1. Log in to the application"
echo "   2. Check that credit balance shows correctly (not 'Error')"
echo "   3. Verify header, sidebar, and dashboard all show proper credits"
echo ""
echo "📊 Monitor logs for any issues. Press Ctrl+C to stop all services."

# Wait for user to stop
trap 'echo "🛑 Stopping all services..." && pkill -f "python.*main.py" && pkill -f "uvicorn" && pkill -f "celery" && pkill -f "npm.*start" && echo "✅ All services stopped."' INT

wait 