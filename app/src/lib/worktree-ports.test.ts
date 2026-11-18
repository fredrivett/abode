// @vitest-environment node
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

// scripts/workspace/ports.sh, run against a throwaway repo with real worktrees.
// A test-only range keeps it clear of the blocks real worktrees use.
const SCRIPT = path.resolve(__dirname, "../../../scripts/workspace/ports.sh");
const FIRST = 46000;
const LAST = 46030;

const execFileAsync = promisify(execFile);

let root: string;
let repo: string;

function scriptEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ABODE_PORT_FIRST: String(FIRST),
    ABODE_PORT_LAST: String(LAST),
    ...extra,
  };
  if (!("ABODE_PORT" in extra)) delete env.ABODE_PORT;
  if (!("CONDUCTOR_PORT" in extra)) delete env.CONDUCTOR_PORT;
  return env;
}

function ports(
  cwd: string,
  command: string,
  extra: Record<string, string> = {},
): string {
  return execFileSync(SCRIPT, [command], {
    cwd,
    env: scriptEnv(extra),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function addWorktree(name: string): string {
  const dir = path.join(root, name);
  git(repo, "worktree", "add", "-q", "-b", name, dir);
  return fs.realpathSync(dir);
}

function envFilePort(worktree: string, dir = "app"): string | undefined {
  const file = path.join(worktree, dir, ".env.local");
  if (!fs.existsSync(file)) return undefined;
  return fs.readFileSync(file, "utf8").match(/^ABODE_PORT=(\d+)$/m)?.[1];
}

beforeEach(() => {
  root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "worktree-ports-")),
  );
  repo = path.join(root, "main");
  fs.mkdirSync(path.join(repo, "app"), { recursive: true });
  fs.mkdirSync(path.join(repo, "extension"), { recursive: true });
  fs.writeFileSync(path.join(repo, "app", ".gitkeep"), "");
  fs.writeFileSync(path.join(repo, "extension", ".gitkeep"), "");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "add", ".");
  git(
    repo,
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-q",
    "-m",
    "init",
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("ports.sh", () => {
  test("the root checkout keeps the default port", () => {
    expect(ports(repo, "ensure")).toBe("3300");
    expect(envFilePort(repo)).toBeUndefined();
  });

  test("gives each worktree its own block and writes it to both env files", () => {
    const a = addWorktree("a");
    const b = addWorktree("b");

    expect(ports(a, "ensure")).toBe(String(FIRST));
    expect(ports(b, "ensure")).toBe(String(FIRST + 10));
    expect(envFilePort(a)).toBe(String(FIRST));
    expect(envFilePort(a, "extension")).toBe(String(FIRST));
    expect(envFilePort(b)).toBe(String(FIRST + 10));
  });

  test("ensure is idempotent and keeps other env lines", () => {
    const a = addWorktree("a");
    fs.writeFileSync(path.join(a, "app", ".env.local"), "OTHER=1\n");

    expect(ports(a, "ensure")).toBe(String(FIRST));
    expect(ports(a, "ensure")).toBe(String(FIRST));

    const contents = fs.readFileSync(path.join(a, "app", ".env.local"), "utf8");
    expect(contents).toContain("OTHER=1");
    expect(contents.match(/^ABODE_PORT=/gm)).toHaveLength(1);
  });

  test("a copied .env.local can't take another worktree's port", () => {
    const a = addWorktree("a");
    ports(a, "ensure");
    const c = addWorktree("c");
    fs.copyFileSync(
      path.join(a, "app", ".env.local"),
      path.join(c, "app", ".env.local"),
    );

    expect(ports(c, "ensure")).toBe(String(FIRST + 10));
    expect(envFilePort(c)).toBe(String(FIRST + 10));
  });

  test("frees the block of a worktree deleted without archive", () => {
    const a = addWorktree("a");
    ports(a, "ensure");
    git(repo, "worktree", "remove", "--force", a);

    expect(ports(addWorktree("d"), "ensure")).toBe(String(FIRST));
  });

  test("release frees the block straight away", () => {
    const a = addWorktree("a");
    ports(a, "ensure");
    ports(a, "release");

    expect(ports(addWorktree("b"), "ensure")).toBe(String(FIRST));
  });

  test("skips a block with something listening on it", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) =>
      server.listen(FIRST + 3, "127.0.0.1", resolve),
    );
    try {
      expect(ports(addWorktree("a"), "ensure")).toBe(String(FIRST + 10));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test("defers to Conductor's port without claiming a block", () => {
    const a = addWorktree("a");
    expect(ports(a, "ensure", { CONDUCTOR_PORT: "55120" })).toBe("55120");
    expect(envFilePort(a)).toBeUndefined();

    expect(ports(addWorktree("b"), "ensure")).toBe(String(FIRST));
  });

  test("under Conductor, clears an ABODE_PORT that would outrank its port", () => {
    const a = addWorktree("a");
    ports(a, "ensure");
    expect(envFilePort(a)).toBe(String(FIRST));

    expect(ports(a, "ensure", { CONDUCTOR_PORT: "55120" })).toBe("55120");
    expect(envFilePort(a)).toBeUndefined();
    expect(envFilePort(a, "extension")).toBeUndefined();
  });

  test("under Conductor, keeps a hand-set ABODE_PORT", () => {
    const a = addWorktree("a");
    for (const dir of ["app", "extension"]) {
      fs.writeFileSync(path.join(a, dir, ".env.local"), "ABODE_PORT=20555\n");
    }

    ports(a, "ensure", { CONDUCTOR_PORT: "55120" });

    expect(envFilePort(a)).toBe("20555");
    expect(envFilePort(a, "extension")).toBe("20555");
  });

  test("rejects an explicit ABODE_PORT getBasePort would reject", () => {
    const a = addWorktree("a");
    for (const value of ["abc", "0", "65527"]) {
      expect(() => ports(a, "ensure", { ABODE_PORT: value })).toThrow(
        /ABODE_PORT must be a port number up to 65526/,
      );
    }
  });

  test("an explicit ABODE_PORT is used as is, without claiming a block", () => {
    const a = addWorktree("a");
    expect(ports(a, "ensure", { ABODE_PORT: "20555" })).toBe("20555");
    expect(envFilePort(a)).toBeUndefined();

    expect(ports(addWorktree("b"), "ensure")).toBe(String(FIRST));
  });

  test("fails loudly when every block is taken", () => {
    for (const name of ["a", "b", "c", "d"]) ports(addWorktree(name), "ensure");

    expect(() => ports(addWorktree("e"), "ensure")).toThrow(
      /every block in 46000-46030 is claimed or busy/,
    );
  });

  test("concurrent setups never share a block", async () => {
    const worktrees = ["a", "b", "c", "d"].map(addWorktree);
    const results = await Promise.all(
      worktrees.map((cwd) =>
        execFileAsync(SCRIPT, ["ensure"], { cwd, env: scriptEnv() }),
      ),
    );
    const claimed = results.map((r) => r.stdout.trim());

    expect(new Set(claimed).size).toBe(4);
  });

  test("fails rather than write through a symlinked .env.local", () => {
    const a = addWorktree("a");
    const shared = path.join(root, "shared.env");
    fs.writeFileSync(shared, "SHARED=1\n");
    fs.symlinkSync(shared, path.join(a, "app", ".env.local"));

    expect(() => ports(a, "ensure")).toThrow(/is a symlink/);
    expect(fs.readFileSync(shared, "utf8")).toBe("SHARED=1\n");
  });

  test("detects a busy port without lsof", async () => {
    // A PATH with everything ports.sh uses except lsof
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin);
    const tools = ["git", "awk", "sed", "grep", "cat", "mkdir", "rm", "mv"];
    for (const tool of [...tools, "sort", "dirname", "sleep", "tail"]) {
      const target = execFileSync("/bin/sh", ["-c", `command -v ${tool}`], {
        encoding: "utf8",
      }).trim();
      fs.symlinkSync(target, path.join(bin, tool));
    }
    const server = net.createServer();
    await new Promise<void>((resolve) =>
      server.listen(FIRST + 3, "127.0.0.1", resolve),
    );
    try {
      const port = execFileSync("/bin/bash", [SCRIPT, "ensure"], {
        cwd: addWorktree("a"),
        env: scriptEnv({ PATH: bin }),
        encoding: "utf8",
      }).trim();
      expect(port).toBe(String(FIRST + 10));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test("recovers a lock left without a pid", () => {
    const commonDir = path.join(repo, ".git");
    fs.mkdirSync(path.join(commonDir, "abode-ports.lock"));

    expect(ports(addWorktree("a"), "ensure")).toBe(String(FIRST));
  }, 20_000);

  test("current follows getBasePort's order", () => {
    const a = addWorktree("a");
    expect(ports(a, "current")).toBe("3300");
    expect(ports(a, "current", { CONDUCTOR_PORT: "55120" })).toBe("55120");

    ports(a, "ensure");
    expect(ports(a, "current", { CONDUCTOR_PORT: "55120" })).toBe(
      String(FIRST),
    );
    expect(ports(a, "current", { ABODE_PORT: "20555" })).toBe("20555");
  });
});
