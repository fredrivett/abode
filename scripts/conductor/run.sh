#!/bin/bash
#
# Conductor workspace run command. Starts the app dev server.
#
# First we make sure the shared local Supabase stack is up (step 0), then we run
# two independent checks against it. The local Supabase DB is shared across all
# workspaces (fixed project_id "abode" → fixed containers/ports), so we
# deliberately do NOT auto-apply or generate migrations here — a feature branch
# could mutate the schema other workspaces read from. Instead we fail fast and
# let the user act.
#
#   0. supabase up  — boot the shared stack if it isn't already running
#   1. migrate status — are all committed migrations applied to the local DB?
#   2. schema drift  — has schema.prisma changed without a migration generated?
#
# Step 0 only *starts* the stack (idempotent, safe from any workspace); it never
# applies a feature branch's migrations, and a cold boot is run from the root
# checkout so it seeds from the canonical (main) migrations, not this branch's.
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

# Step 0: boot the shared stack if it's down, so the checks below have a DB.
# Start from the root checkout (canonical branch) so a cold boot never seeds the
# shared DB with this branch's unmerged migrations. Best-effort: on any failure
# we continue and let the migrate check surface the P1001 banner.
supabase_root="${CONDUCTOR_ROOT_PATH:-$(cd .. && pwd)}"
if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^supabase_auth_abode$'; then
    echo "${green}✓ Supabase already running${reset}"
  elif [ -x "$supabase_root/scripts/start-supabase.sh" ]; then
    echo "${cyan}Local Supabase isn't running — starting it from ${supabase_root}...${reset}"
    # A plain start can't recover a half-dead stack (a container exited but the
    # CLI still thinks it's up); a stop (keeps a backup) + start clears that.
    if ! (cd "$supabase_root" && ./scripts/start-supabase.sh); then
      echo "${yellow}⚠  Start failed — resetting the stack (stop + start)...${reset}"
      (cd "$supabase_root" && supabase stop >/dev/null 2>&1) || true
      (cd "$supabase_root" && ./scripts/start-supabase.sh) \
        || echo "${yellow}⚠  Supabase still won't start; continuing (DB check below will report it).${reset}"
    fi
  fi
fi

# Check 1: pending (generated but unapplied) migrations.
# `prisma migrate status` exits non-zero when migrations are pending, the schema
# has drifted, or the DB is unreachable. Capture its output so we can echo it and
# also parse the pending migration names into our banner. `|| status_ok=0` keeps
# set -e from tripping on that expected failure.
status_ok=1
status_output=$(bunx prisma migrate status 2>&1) || status_ok=0
echo "$status_output"

if [ "$status_ok" -eq 0 ]; then
  # An unreachable DB is a different failure from pending migrations — Prisma
  # emits a "P1001:" error token for it. Match the token (not any occurrence of
  # the string) so a migration name containing "P1001" isn't mistaken for it.
  if printf '%s' "$status_output" | grep -qE '(^|[[:space:]])P1001:'; then
    echo ""
    echo "${red}${bold}${rule}${reset}"
    echo "${red}${bold}❌  Can't reach the local database${reset}"
    echo "${red}${bold}${rule}${reset}"
    echo ""
    echo "  Start the local Supabase stack, then start dev again:"
    echo ""
    echo "      ${bold}${cyan}cd app && bun run supabase:start${reset}"
    echo ""
    exit 1
  fi

  # Prisma lists the not-yet-applied migration names on their own lines after a
  # "have not yet been applied" header, ending at the next blank line.
  pending=$(printf '%s\n' "$status_output" \
    | awk '/have not yet been applied/{grab=1;next} grab&&NF==0{grab=0} grab{print}')

  echo ""
  echo "${red}${bold}${rule}${reset}"
  echo "${red}${bold}❌  Local database is out of date — pending migrations${reset}"
  echo "${red}${bold}${rule}${reset}"
  echo ""
  if [ -n "$pending" ]; then
    echo "  Pending migration(s):"
    echo ""
    printf '%s\n' "$pending" | while IFS= read -r m; do
      [ -n "$m" ] && echo "      ${bold}${cyan}${m}${reset}"
    done
    echo ""
  fi
  echo "  Apply the pending migration(s), then start dev again:"
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

# Regenerate the Prisma client so it matches schema.prisma. The migrate checks
# above cover the DB, but the generated client lives in node_modules and is only
# (re)built on an actual install — a rebase/branch-switch that changes the schema
# leaves it stale. This is cheap and idempotent, so run it on every boot.
bun run prisma:generate

bun run dev
