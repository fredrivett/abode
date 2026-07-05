#!/bin/bash
#
# Conductor workspace run command. Starts the app dev server.
#
# Before booting we run two independent checks. The local Supabase DB is shared
# across all workspaces, so we deliberately do NOT auto-apply or generate
# migrations here — a feature branch could mutate the schema other workspaces
# read from. Instead we fail fast and let the user act.
#
#   1. migrate status — are all committed migrations applied to the local DB?
#   2. schema drift  — has schema.prisma changed without a migration generated?
#
# Check 2 must run after check 1: it diffs the live DB against schema.prisma, so
# a pending-but-unapplied migration would also look like drift. Once check 1
# passes, every migration is applied, so any remaining diff is genuine drift.

set -euo pipefail

cd app

bold=$'\033[1m'
red=$'\033[31m'
green=$'\033[32m'
yellow=$'\033[33m'
cyan=$'\033[36m'
reset=$'\033[0m'
rule="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check 1: pending (generated but unapplied) migrations.
# `prisma migrate status` exits non-zero when migrations are pending or the
# schema has drifted. `if !` keeps set -e from tripping on that expected failure.
if ! bunx prisma migrate status; then
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

# Check 2: schema.prisma edited without a migration generated.
# migrate status/deploy only compare migration files to the DB, so a schema edit
# with no migration slips through both. Diff the live DB (via the datasource, so
# Prisma loads .env itself) against the schema datamodel to catch it. --exit-code
# returns 2 when they differ, 0 when in sync.
if ! bunx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code; then
  echo ""
  echo "${red}${bold}${rule}${reset}"
  echo "${red}${bold}❌  schema.prisma has changes with no migration generated${reset}"
  echo "${red}${bold}${rule}${reset}"
  echo ""
  echo "  The diff above shows what's in schema.prisma but not the DB."
  echo "  Generate (and locally apply) a migration, then start dev again:"
  echo ""
  echo "      ${bold}${cyan}cd app && bun run prisma:migrate --name <name>${reset}"
  echo ""
  echo "  ${yellow}${bold}⚠  This runs 'migrate dev' against the shared local DB.${reset}"
  echo "     ${yellow}Additive changes apply cleanly; if it warns about a reset,${reset}"
  echo "     ${yellow}stop and check the drift before continuing.${reset}"
  echo ""
  exit 1
fi

echo ""
echo "${green}${bold}✅  Local database is up to date — migrations applied and schema in sync${reset}"
echo ""

bun run dev
