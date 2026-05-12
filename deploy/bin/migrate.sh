#!/usr/bin/env bash
# Runs DB migrations and seeds the initial admin user (idempotent).
# Invoked by the s6 'migrate' oneshot service before backend/worker start.
set -euo pipefail

cd /app
exec bun src/cli/migrate.ts
