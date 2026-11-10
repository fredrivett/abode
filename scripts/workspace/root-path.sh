# Sourced by the worktree scripts. Sets root_path to the root checkout: Orca
# sets ORCA_ROOT_PATH, Conductor CONDUCTOR_ROOT_PATH; otherwise derive it from
# git (the main worktree owns the common .git dir)
root_path="${ORCA_ROOT_PATH:-${CONDUCTOR_ROOT_PATH:-}}"
if [ -z "$root_path" ]; then
  if ! _common_dir="$(git rev-parse --git-common-dir 2>/dev/null)" || [ -z "$_common_dir" ]; then
    echo "Can't find the root checkout: not in a git repo and neither ORCA_ROOT_PATH nor CONDUCTOR_ROOT_PATH is set" >&2
    exit 1
  fi
  root_path="$(cd "$_common_dir/.." && pwd)"
  unset _common_dir
fi
