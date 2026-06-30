#!/bin/bash

export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain
docker compose down --timeout=0
docker compose build
docker compose up -d
