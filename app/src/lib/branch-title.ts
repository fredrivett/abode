/**
 * Turn a git branch name into the last path segment, used to prefix the tab
 * title in local dev. e.g. "fredrivett/local-branch-page-title" -> "local-branch-page-title".
 * Returns undefined when there's no usable name.
 */
export function shortBranchName(
  branch: string | undefined,
): string | undefined {
  if (!branch) return undefined;
  const last = branch.split("/").pop()?.trim();
  return last || undefined;
}
