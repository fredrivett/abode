#!/bin/bash
#
# Conductor workspace setup. Runs once when a workspace is created.
#
# Steps:
#   1. Symlink workspace .env.local from the root checkout's .env.local
#   2. Symlink app/.env to the workspace .env.local (Next.js reads .env)
#   3. Install app dependencies

set -euo pipefail

# 1. Link workspace .env.local <- root checkout .env.local
if [ -n "${CONDUCTOR_ROOT_PATH:-}" ] && [ -f "$CONDUCTOR_ROOT_PATH/.env.local" ]; then
  ln -sf "$CONDUCTOR_ROOT_PATH/.env.local" .env.local
else
  echo "Missing CONDUCTOR_ROOT_PATH/.env.local; skipping link"
fi

# 2. Link app/.env <- workspace .env.local
if [ -f .env.local ]; then
  if [ -L app/.env.local ]; then
    rm -f app/.env.local
  fi
  ln -sf ../.env.local app/.env
else
  echo "No .env.local in workspace; skipping app/.env link"
fi

# 3. Install dependencies
cd app && bun install
