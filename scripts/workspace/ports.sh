#!/bin/bash
#
# Per-worktree port blocks. Each worktree gets 10 ports (base +0 to +9, layout in
# CONTRIBUTING.md) so its dev server and e2e/demo stack never clash with another
# worktree's. Orca doesn't allocate ports; Conductor does (CONDUCTOR_PORT), and
# when it's set it wins.
#
#   ports.sh ensure    print this worktree's base port, claiming a block if needed
#   ports.sh current   print this worktree's base port without claiming anything
#   ports.sh release   drop this worktree's claim (archive)
#   ports.sh list      show every claim
#
# Claims live in one register in the repo's shared .git dir, so every worktree
# (Orca, Conductor, Claude Code, plain) sees them all. The register is the
# source of truth; ensure writes the port into app/.env.local and
# extension/.env.local as ABODE_PORT, where bun and Next.js pick it up. A copied
# .env.local can't steal a port, because only the register entry for this
# worktree's path counts. Claims of deleted worktrees are dropped on every
# ensure, and archive releases its own straight away.
#
# Blocks come from 20000-21990: below every OS's ephemeral range (Linux 32768+,
# macOS/Windows 49152+) and clear of Kubernetes NodePorts (30000+), Supabase's
# defaults (543xx) and Conductor (55000+). The root checkout keeps 3300.

set -euo pipefail

FIRST="${ABODE_PORT_FIRST:-20000}"
LAST="${ABODE_PORT_LAST:-21990}"
BLOCK=10
DEFAULT_PORT=3300

common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
register="$common_dir/abode-ports"
lock="$common_dir/abode-ports.lock"
worktree="$(cd "$(git rev-parse --show-toplevel)" && pwd -P)"
primary="$(cd "$common_dir/.." && pwd -P)"

tab=$'\t'

lock_acquire() {
  local tries=0 pid
  while ! mkdir "$lock" 2>/dev/null; do
    pid="$(cat "$lock/pid" 2>/dev/null || true)"
    # A holder that died without releasing leaves its pid behind
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      rm -rf "$lock"
      continue
    fi
    tries=$((tries + 1))
    if [ "$tries" -ge 300 ]; then
      echo "ports.sh: timed out waiting for $lock" >&2
      exit 1
    fi
    sleep 0.1
  done
  echo $$ >"$lock/pid"
  trap lock_release EXIT
}

lock_release() {
  rm -rf "$lock"
}

live_worktrees() {
  git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r path; do
    [ -d "$path" ] && (cd "$path" && pwd -P)
  done
}

# Drop claims whose worktree no longer exists (deleted without archive)
prune() {
  [ -f "$register" ] || return 0
  # The first input is the live paths, one per line; then keep their claims
  awk -F'\t' 'NR == FNR { keep[$0] = 1; next } keep[$2]' \
    <(live_worktrees) "$register" >"$register.tmp"
  mv "$register.tmp" "$register"
}

claimed_port() {
  [ -f "$register" ] || return 0
  awk -F'\t' -v path="$worktree" '$2 == path { print $1; exit }' "$register"
}

block_busy() {
  command -v lsof >/dev/null 2>&1 || return 1
  lsof -nP -iTCP:"$1-$(($1 + BLOCK - 1))" -sTCP:LISTEN -t >/dev/null 2>&1
}

allocate() {
  local port
  for ((port = FIRST; port <= LAST; port += BLOCK)); do
    if [ -f "$register" ] && grep -q "^$port$tab" "$register"; then
      continue
    fi
    block_busy "$port" && continue
    printf '%s\t%s\n' "$port" "$worktree" >>"$register"
    echo "$port"
    return 0
  done
  echo "ports.sh: every block in $FIRST-$LAST is claimed or busy. Claims:" >&2
  cat "$register" >&2
  echo "Delete worktrees you no longer need, then retry." >&2
  exit 1
}

# Set ABODE_PORT in an env file, keeping its other lines
write_port() {
  local file="$1" port="$2"
  [ -d "$(dirname "$file")" ] || return 0
  # Never write through a symlink: it would change the root checkout's file
  if [ -L "$file" ]; then
    echo "ports.sh: $file is a symlink; not writing ABODE_PORT into it" >&2
    return 0
  fi
  {
    [ -f "$file" ] && grep -v -e '^ABODE_PORT=' -e '^# ABODE_PORT:' "$file" || true
    echo "# ABODE_PORT: this worktree's port block, managed by scripts/workspace/ports.sh"
    echo "ABODE_PORT=$port"
  } >"$file.tmp"
  mv "$file.tmp" "$file"
}

ensure() {
  if [ -n "${CONDUCTOR_PORT:-}" ]; then
    echo "$CONDUCTOR_PORT"
    return 0
  fi
  if [ "$worktree" = "$primary" ]; then
    echo "$DEFAULT_PORT"
    return 0
  fi
  lock_acquire
  prune
  local port
  port="$(claimed_port)"
  [ -n "$port" ] || port="$(allocate)"
  lock_release
  trap - EXIT
  write_port "$worktree/app/.env.local" "$port"
  write_port "$worktree/extension/.env.local" "$port"
  echo "$port"
}

# Same precedence as getBasePort() in app/src/lib/dev-port.ts: an explicit
# ABODE_PORT, then the worktree's file (which is what bun and Next.js load), then
# Conductor's port, then the default
current() {
  local port="${ABODE_PORT:-}"
  if [ -z "$port" ] && [ -f "$worktree/app/.env.local" ]; then
    port="$(sed -n 's/^ABODE_PORT=//p' "$worktree/app/.env.local" | tail -n 1)"
  fi
  echo "${port:-${CONDUCTOR_PORT:-$DEFAULT_PORT}}"
}

release() {
  [ -f "$register" ] || return 0
  lock_acquire
  awk -F'\t' -v path="$worktree" '$2 != path' "$register" >"$register.tmp"
  mv "$register.tmp" "$register"
}

list() {
  [ -f "$register" ] || { echo "No claims"; return 0; }
  local live port path state
  live="$(live_worktrees)"
  sort -n "$register" | while IFS="$tab" read -r port path; do
    if ! grep -qxF "$path" <<<"$live"; then
      state="stale"
    elif block_busy "$port"; then
      state="running"
    else
      state="idle"
    fi
    printf '%s\t%-8s%s\n' "$port" "$state" "$path"
  done
}

case "${1:-}" in
  ensure) ensure ;;
  current) current ;;
  release) release ;;
  list) list ;;
  *)
    echo "usage: $0 ensure|current|release|list" >&2
    exit 2
    ;;
esac
