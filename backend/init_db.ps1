# Initialize the database tables using the setup_db.sql file

Write-Host "Initializing database tables..."

# Copy the SQL file content into the container
$sqlContent = Get-Content -Path ..\setup_db.sql -Raw
$sqlContent | docker exec -i captely-db psql -U postgres -d postgres

Write-Host "Database initialization complete." 