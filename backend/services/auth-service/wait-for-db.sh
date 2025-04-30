# services/auth-service/wait-for-db.sh
#!/usr/bin/env sh
set -e

host="db"
port=5432

echo "⏳ Waiting for Postgres at $host:$port…"
until nc -z "$host" "$port"; do
  sleep 1
done

echo "✅ Postgres is up – launching app"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
