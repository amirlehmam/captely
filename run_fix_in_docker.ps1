# PowerShell script to run lead score recalculation inside Docker containers

Write-Host "🐳 DOCKER LEAD SCORE FIX SCRIPT" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# First, let's check what containers are running
Write-Host "📊 Checking running containers..." -ForegroundColor Yellow
docker ps

Write-Host ""
Write-Host "🔍 Looking for database container..." -ForegroundColor Yellow

# Get list of running containers
$containers = docker ps --format "{{.Names}}"

# Try to find database container
$dbContainer = $containers | Where-Object { $_ -match "(postgres|db|database)" } | Select-Object -First 1

if (-not $dbContainer) {
    Write-Host "❌ Database container not found. Here are your running containers:" -ForegroundColor Red
    docker ps --format "table {{.Names}}`t{{.Image}}`t{{.Status}}"
    Write-Host ""
    Write-Host "💡 Try one of these manual commands:" -ForegroundColor Cyan
    Write-Host "   docker cp fix_scores.py <container_name>:/tmp/" -ForegroundColor White
    Write-Host "   docker exec <container_name> python3 /tmp/fix_scores.py" -ForegroundColor White
    exit 1
}

Write-Host "✅ Found database container: $dbContainer" -ForegroundColor Green

# Copy our Python script into the container
Write-Host "📁 Copying lead score fix script into container..." -ForegroundColor Yellow
docker cp fix_scores.py "$($dbContainer):/tmp/"

# Install psycopg2 in the container and run our script
Write-Host "🔧 Installing dependencies and running lead score recalculation..." -ForegroundColor Yellow

$scriptCommand = @"
apt-get update -qq && 
apt-get install -y python3-pip -qq && 
pip3 install psycopg2-binary && 
cd /tmp && 
python3 fix_scores.py
"@

docker exec $dbContainer bash -c $scriptCommand

Write-Host "✅ Lead score recalculation completed!" -ForegroundColor Green
Write-Host "💡 Check your CRM contacts page to see the results" -ForegroundColor Cyan 