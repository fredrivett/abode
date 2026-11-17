import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCompletedSignupUser } = vi.hoisted(() => ({
  mockGetCompletedSignupUser: vi.fn(),
}));

vi.mock("@/lib/auth/completed-signup-user", () => ({
  getCompletedSignupUser: mockGetCompletedSignupUser,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

import { currentViewerFrame } from "@/lib/viewer-context";
import { authedAction } from "./authed-action";

describe("authedAction", () => {
  beforeEach(() => {
    mockGetCompletedSignupUser.mockReset();
  });

  it("returns `unauthorized` without running the action when there's no user", async () => {
    mockGetCompletedSignupUser.mockResolvedValue(null);
    const action = vi.fn(
      async (): Promise<{ error?: string; success?: boolean }> => ({
        success: true,
      }),
    );
    const wrapped = authedAction(
      { unauthorized: { error: "Unauthorized" } },
      action,
    );

    expect(await wrapped()).toEqual({ error: "Unauthorized" });
    expect(action).not.toHaveBeenCalled();
  });

  it("passes the principal and the action's own arguments, inside a viewer frame", async () => {
    mockGetCompletedSignupUser.mockResolvedValue({ id: "u1" });
    const wrapped = authedAction(
      { unauthorized: null },
      async (principal, first: string, second: number) => ({
        userId: principal.user.id,
        method: principal.method,
        args: [first, second],
        framed: currentViewerFrame() !== undefined,
      }),
    );

    expect(await wrapped("a", 2)).toEqual({
      userId: "u1",
      method: "cookie",
      args: ["a", 2],
      framed: true,
    });
    expect(currentViewerFrame()).toBeUndefined();
  });
});

/**
 * Every server action under `(app)` is exported through `authedAction`. Server
 * actions are reachable by a direct POST that never meets the `(app)` layout,
 * so an action that forgets its own check would run for anyone.
 *
 * Re-exports allowed below are reviewed: `signOut` must work for any session.
 */
const ALLOWED_REEXPORTS = ['export { signOut } from "@/lib/actions/auth";'];

const APP_DIR = join(process.cwd(), "src/app/(app)");

function actionFiles() {
  return readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => path.split(sep).at(-1) === "actions.ts")
    .map((path) => ({
      file: relative(APP_DIR, join(APP_DIR, path)).split(sep).join("/"),
      source: readFileSync(join(APP_DIR, path), "utf8"),
    }));
}

/** Value exports that don't go through authedAction; empty when gated */
function ungatedExports(source: string): string[] {
  const problems: string[] = [];
  for (const [statement] of source.matchAll(
    /export\s+(?:async\s+)?function\s+\w+|export\s+(?:const|let|var)\s+\w+\s*=\s*(?!\s|authedAction\()[^;\n]*|export\s+default\b[^;\n]*|export\s*(?!type\b)\{[^}]*\}[^;\n]*;?|export\s*\*[^;\n]*;?/g,
  )) {
    if (!ALLOWED_REEXPORTS.includes(statement.trim())) problems.push(statement);
  }
  return problems;
}

describe("(app) server actions", () => {
  const files = actionFiles();

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThan(1);
  });

  it.each(files.map((f) => [f.file, f] as const))(
    "%s exports every action through authedAction",
    (_, { source }) => {
      expect(ungatedExports(source)).toEqual([]);
    },
  );

  it.each([
    ["a plain async function", "export async function doThing() {}"],
    ["a const that isn't wrapped", "export const doThing = async () => {};"],
    ["an unreviewed re-export", 'export { other } from "@/lib/x";'],
    ["a local export list", "const a = 1;\nexport { a };"],
  ])("flags %s", (_, source) => {
    expect(ungatedExports(source)).not.toEqual([]);
  });

  it("accepts wrapped actions and type exports", () => {
    const source = `export type Result = { error?: string };
export const doThing = authedAction({ unauthorized: {} }, async () => ({}));
export { signOut } from "@/lib/actions/auth";`;
    expect(ungatedExports(source)).toEqual([]);
  });
});
