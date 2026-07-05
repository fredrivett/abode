#!/bin/bash
#
# Conductor workspace run command. Starts the app dev server.
#
# Before booting, verify the local database has every migration applied. The
# local Supabase DB is shared across all workspaces, so we deliberately do NOT
# auto-apply migrations here — a feature branch could mutate the schema that
# other workspaces read from. Instead we fail fast and let the user apply them.

set -euo pipefail

cd app

# `prisma migrate status` exits non-zero when migrations are pending or the
# schema has drifted. `if !` keeps set -e from tripping on that expected failure.
if ! bunx prisma migrate status; then
  bold=$'\033[1m'
  red=$'\033[31m'
  yellow=$'\033[33m'
  cyan=$'\033[36m'
  reset=$'\033[0m'
  rule="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  echo ""
  echo "${red}${bold}${rule}${reset}"
  echo "${red}${bold}❌  Local database is out of date — pending migrations${reset}"
  echo "${red}${bold}${rule}${reset}"
  echo ""
  echo "  Apply the pending migration, then start dev again:"
  echo ""
  echo "      ${bold}${cyan}cd app && bunx prisma migrate deploy${reset}"
  echo ""
  echo "  ${yellow}${bold}⚠  Use 'migrate deploy', NOT 'migrate dev'.${reset}"
  echo "     ${yellow}The local Supabase DB is shared across workspaces, and${reset}"
  echo "     ${yellow}'migrate dev' can prompt to reset (wipe) it on drift.${reset}"
  echo "     ${yellow}'migrate deploy' only applies committed migrations.${reset}"
  echo ""
  exit 1
fi

bun run dev
