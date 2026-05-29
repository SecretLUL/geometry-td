#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "======================================================================="
echo "              GEOMETRY TD - PRODUCTION DEPLOYMENT"
echo "======================================================================="
echo ""
echo "Rebuilding and deploying production containers (frontend-prod, backend-prod)..."
echo ""
docker compose up -d --build frontend-prod backend-prod
echo ""
echo "======================================================================="
echo "              DEPLOYMENT DONE! Production is updated."
echo "======================================================================="
echo ""