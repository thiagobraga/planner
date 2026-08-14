#!/bin/sh
set -e

npm ci --include=optional
# Ensure the coverage report dir exists as the app user - if docker creates it
# (coverage service bind mount) before the first `npm ci`, it is root-owned
# and report generation later fails with EACCES.
mkdir -p /app/coverage-reports
exec "$@"
