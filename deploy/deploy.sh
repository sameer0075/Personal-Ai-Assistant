#!/usr/bin/env bash
# Build and push both images to your Northflank registry.
#
# Usage (from repo root):
#   ./deploy/deploy.sh "<backend-public-url>"
#
# Backend must be deployed FIRST so you know its public URL; that URL is then
# baked into the frontend image at build time. Your team slug (sameer0075s) and
# registry host are already correct below.
set -euo pipefail

BACKEND_URL="${1:?usage: deploy/deploy.sh <backend-public-url>}"

REGISTRY="registry.northflank.com/sameer0075s"

echo "==> 1. building backend image"
docker build -f deploy/backend.Dockerfile -t "${REGISTRY}/ai-assistant-backend:latest" .
echo "==>     pushing backend image"
docker push "${REGISTRY}/ai-assistant-backend:latest"

echo "==> 2. building frontend image (NEXT_PUBLIC_API_BASE_URL=${BACKEND_URL}/api)"
docker build --build-arg "NEXT_PUBLIC_API_BASE_URL=${BACKEND_URL}/api" \
  -f deploy/frontend.Dockerfile -t "${REGISTRY}/ai-assistant-frontend:latest" .
echo "==>     pushing frontend image"
docker push "${REGISTRY}/ai-assistant-frontend:latest"

echo ""
echo "Done. Pushed:"
echo "  ${REGISTRY}/ai-assistant-backend:latest"
echo "  ${REGISTRY}/ai-assistant-frontend:latest"
echo ""
echo "OAuth redirect URIs for the provider consoles:"
echo "  ${BACKEND_URL}/api/google/callback"
echo "  ${BACKEND_URL}/api/linkedin/callback"