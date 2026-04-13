#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/packages/shared && npx drizzle-kit migrate
echo "Migrations complete."

echo "Starting API server..."
cd /app && exec node_modules/.bin/tsx apps/api/src/index.ts
