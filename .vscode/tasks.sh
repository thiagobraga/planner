#!/bin/bash

sudo rm -rf app/node_modules api/node_modules

export DOCKER_BUILDKIT=1
docker compose down --timeout=0
docker compose build
docker compose up -d
