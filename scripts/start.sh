#!/bin/sh
set -e

echo "StockFlow starting..."

# Wait for database to be reachable
# Railway DB sometimes takes a few seconds to accept connections
echo "Waiting for database..."
MAX_RETRIES=10
RETRY_COUNT=0

until npx prisma migrate deploy 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Database not reachable after $MAX_RETRIES attempts"
    echo "Starting server anyway — it will retry connections"
    break
  fi
  echo "Database not ready yet, retry $RETRY_COUNT/$MAX_RETRIES..."
  sleep 3
done

echo "Running database migrations..."
npx prisma migrate deploy && echo "Migrations applied" || echo "Migration warning — continuing"

echo "Checking database state..."
node scripts/seed-check.js || echo "Seed check warning — continuing"

echo "Starting server..."
node dist/server.js