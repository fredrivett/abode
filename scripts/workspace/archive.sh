#!/bin/bash
#
# Worktree archive. Runs before a worktree is deleted (Orca's orca.yaml
# `scripts.archive`, or Conductor's archive script). Stops this worktree's e2e
# Supabase containers and frees its port block; best-effort, so it never blocks
# the delete.

dir="$(dirname "$0")"
port="$("$dir/ports.sh" current 2>/dev/null || echo 3300)"

# The e2e stack is named after the port (abode-e2e-<port>). On the default port
# it may belong to the root checkout or another unallocated worktree, so leave it
if [ "$port" = "3300" ]; then
  echo "On the shared default port; leaving its e2e stack running (bun run demo:stop to stop it)"
else
  supabase stop --workdir ./supabase-e2e --no-backup 2>/dev/null || true
fi

"$dir/ports.sh" release 2>/dev/null || true
