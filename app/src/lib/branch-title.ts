import { GIT_BRANCH } from "@/env";

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

/**
 * The dev tab-title prefix, e.g. "[my-branch] " (with trailing space), or "" in
 * production. `GIT_BRANCH` is a NEXT_PUBLIC env, so this returns the same value
 * on the server (root metadata template) and the client (imperative tab title),
 * keeping the two in sync so a client-set title matches the server-rendered one.
 */
export function branchTitlePrefix(): string {
  const name = shortBranchName(GIT_BRANCH);
  return name ? `[${name}] ` : "";
}
