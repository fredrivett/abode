#!/bin/bash
#
# Worktree setup. Runs once when a worktree is created (Orca's orca.yaml
# `scripts.setup`, or Conductor's setup script).
#
# Steps:
#   1. Symlink workspace .env.local from the root checkout's .env.local
#   2. Symlink app/.env to the workspace .env.local (Next.js reads .env)
#   3. Install app dependencies

set -euo pipefail

source "$(dirname "$0")/root-path.sh"

# 1. Link workspace .env.local <- root checkout .env.local
if [ "$root_path" != "$(pwd)" ] && [ -f "$root_path/.env.local" ]; then
  ln -sf "$root_path/.env.local" .env.local
else
  echo "No .env.local in root checkout ($root_path); skipping link"
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
