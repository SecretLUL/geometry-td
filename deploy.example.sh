#!/bin/bash

# Abort on first error (script stops if any command fails)
set -e

echo "🚀 Starting automated production deployment..."

# 1. Pull latest code from GitHub
echo "📥 Pulling current code from repository..."
git pull origin master

# 2. Rebuild and restart production containers in background
echo "🏗️ Building Docker images and restarting containers..."
docker compose up -d --build frontend-prod backend-prod db-prod

# 3. Clean up (Important on the NAS!)
# Removes old, unused Docker images (dangling images) generated during rebuild
echo "🧹 Cleaning up old Docker image remnants..."
docker image prune -f

# 4. Status check
echo "🔍 Checking status of new containers..."
docker ps --filter "name=gtd-"

echo "✅ Deployment successfully completed! Live environment is running."
