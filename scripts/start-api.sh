#!/bin/sh
set -e

echo "Running database migrations..."
cd /app && yarn db:migrate
echo "Migrations complete."

echo "Starting API server..."
cd /app && exec node_modules/.bin/tsx apps/api/src/index.ts
