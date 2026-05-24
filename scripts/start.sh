#!/bin/sh
set -e

echo "⏳ Running database migrations..."
npx prisma migrate deploy

echo "⏳ Checking if database needs seeding..."
node scripts/seed-check.js

echo "🚀 Starting server..."
node dist/server.js