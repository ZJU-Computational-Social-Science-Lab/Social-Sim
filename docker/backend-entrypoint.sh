#!/bin/bash
set -e

echo "Starting SocialSim4 backend..."

# Run database migrations
echo "Running database migrations..."
alembic upgrade head || echo "Migration skipped or failed"

# Start the application
echo "Starting Uvicorn server..."
exec uvicorn socialsim4.backend.main:app \
    --host ${SOCIALSIM4_BACKEND_HOST:-0.0.0.0} \
    --port ${SOCIALSIM4_BACKEND_PORT:-8000} \
    --root-path ${SOCIALSIM4_BACKEND_ROOT_PATH:-}
