#!/bin/bash

sudo rm -rf node_modules app/node_modules api/node_modules

docker compose down --timeout=0
docker compose build
docker compose up -d

echo "[planner] Waiting for app and api to be healthy..."
until [ "$(docker compose ps app api --format json | jq -s -r 'map(.Health) | unique | join(",")')" = "healthy" ]; do sleep 1; done

echo "[planner] App and API are healthy. Opening app in Google Chrome..."
sleep 1

# Open the app in Google Chrome with the specified profile and app ID
# Detached so the task exits and the agent tabs (see tasks.json "Dev") can start
__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __VK_LAYER_NV_optimus=NVIDIA_only google-chrome --profile-directory=Default --app-id=oadcfhophbkhdadhdnomdbnbhhnnbnke &>/dev/null