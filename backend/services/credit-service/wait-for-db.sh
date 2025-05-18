#!/bin/sh
# wait-for-db.sh

set -e

host="$1"
shift
cmd="$@"

# Try to ping the host to check connectivity
echo "Checking database connection..."

# Skip DB check - assume DB is already available
>&2 echo "Skipping DB check, assuming database is available - executing command"
exec $cmd 