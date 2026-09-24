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
google-chrome --profile-directory=Default --app-id=oadcfhophbkhdadhdnomdbnbhhnnbnke

# Also open a mobile version of the app in Google Chrome with a specific window size and user agent
google-chrome --profile-directory=Default \
  --app=https://planner.local/daily \
  --window-size=375,667 \
  --use-mobile-user-agent \
  --user-data-dir=/tmp/planner-mobile