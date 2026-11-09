#!/bin/bash
#
# Worktree archive. Runs before a worktree is deleted (Orca's orca.yaml
# `scripts.archive`, or Conductor's archive script). Stops this checkout's e2e
# Supabase containers; best-effort, so it never blocks the delete.

# The e2e stack is named after the checkout's port. Without a per-checkout port
# (Orca, plain checkouts) every checkout shares abode-e2e-3300, so stopping it
# could kill another worktree's running e2e/demo stack — leave it alone
if [ -z "${CONDUCTOR_PORT:-}" ]; then
  echo "No per-checkout port; leaving the shared e2e stack running (bun run demo:stop to stop it)"
  exit 0
fi

supabase stop --workdir ./supabase-e2e --no-backup 2>/dev/null || true
