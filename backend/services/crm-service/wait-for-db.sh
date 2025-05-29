#!/bin/sh
set -e

host="$1"
shift

echo "Checking database connection..."

if [ -z "$DATABASE_URL" ]; then
    echo "Skipping DB check, assuming database is available - executing command"
    exec "$@"
fi

exec "$@" 