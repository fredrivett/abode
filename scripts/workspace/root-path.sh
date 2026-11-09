# Sourced by the worktree scripts. Sets root_path to the root checkout: Orca
# sets ORCA_ROOT_PATH, Conductor CONDUCTOR_ROOT_PATH; otherwise derive it from
# git (the main worktree owns the common .git dir)
root_path="${ORCA_ROOT_PATH:-${CONDUCTOR_ROOT_PATH:-$(cd "$(git rev-parse --git-common-dir)/.." && pwd)}}"
