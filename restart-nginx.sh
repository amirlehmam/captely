#!/bin/bash

echo "🔄 Restarting Nginx to apply export routing fix..."

# Go to backend directory
cd backend

# Restart nginx container
docker-compose restart nginx

echo "✅ Nginx restarted successfully!"
echo "🚀 Export routing should now work correctly"
echo ""
echo "🎯 Changes applied:"
echo "  ✅ Fixed nginx export routing (removed double rewrite)"
echo "  ✅ Fixed export modal sizing (no more scrolling)"
echo "  ✅ Fixed dark mode background coverage"
echo ""
echo "🧪 Test the export functionality now!" 