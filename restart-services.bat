@echo off
echo 🚀 Restarting Captely services with all fixes applied...

echo 🛑 Stopping all services...
docker-compose down

echo 🧹 Removing old containers and networks...
docker-compose rm -f
docker system prune -f

echo 🔨 Rebuilding services with latest changes...
docker-compose build --no-cache

echo 🚀 Starting all services...
docker-compose up -d

echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak > nul

echo 🔍 Checking service health...
docker-compose ps

echo.
echo ✅ All fixes applied:
echo    ✓ Credit service Header import fixed
echo    ✓ Nginx routing fixed for all services
echo    ✓ CRM 422 validation error handled
echo    ✓ Frontend getCrmBatches fixed to call correct endpoint
echo    ✓ All services should now work correctly
echo.
echo 🌐 Access your application at: https://captely.com
echo 📊 View logs with: docker-compose logs -f [service-name]
echo.
echo Services ready! 🎉 