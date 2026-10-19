#!/bin/bash

docker compose up -d --build site

echo "[planner] Waiting for site to be healthy..."
until [ "$(docker compose ps site --format json | jq -s -r 'map(.Health) | unique | join(",")')" = "healthy" ]; do sleep 1; done

SITE_URL="https://${SITE_SUBDOMAIN:-site.planner}.local"

echo "[planner] Opening site preview at $SITE_URL"
sleep 1

# Detached so the task keeps streaming logs
__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __VK_LAYER_NV_optimus=NVIDIA_only google-chrome --profile-directory=Default --app="$SITE_URL" &>/dev/null &

docker compose logs -f site
