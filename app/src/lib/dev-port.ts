/** The root checkout's port, and every checkout's when nothing allocates one */
export const DEFAULT_BASE_PORT = 3300;

/**
 * This checkout's base port: the dev server runs on it, and the e2e/demo stack on
 * the next nine (layout in CONTRIBUTING.md). ABODE_PORT comes from the worktree's
 * app/.env.local, written by scripts/workspace/ports.sh, or is set explicitly
 * (e2e/demo servers); Conductor's CONDUCTOR_PORT is the fallback. Keep the order
 * in sync with `ports.sh current`.
 */
export function getBasePort(
  env: Partial<Record<string, string>> = process.env,
): number {
  for (const name of ["ABODE_PORT", "CONDUCTOR_PORT"] as const) {
    const value = env[name];
    if (value === undefined || value === "") continue;
    const port = Number(value);
    if (!/^\d+$/.test(value) || port < 1 || port > 65535) {
      throw new Error(`${name} must be a port number, got "${value}"`);
    }
    return port;
  }
  return DEFAULT_BASE_PORT;
}
