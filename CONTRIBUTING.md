# Contributing to abode

Thanks for your interest in abode. This covers the local development details beyond the quickstart in the [README](README.md).

> Self-hosting and contributions are welcome but **best-effort** — there's no SLA, and reviews/replies may be slow. See the README for the full picture.

## Environment

`bin/dev` sources `.env` and `.env.local` from the repo root. On first run the scripts symlink `app/.env` → `../.env.local` so Next.js picks up your root env values.

See `.env.example` for every variable. Only the **Required**-tier services in the README's [External services](README.md#external-services) table are needed to boot; everything else is optional and degrades gracefully when its key is absent (see [AGENTS.md](AGENTS.md#optional-services--graceful-degradation)).

The document scanner's edge-detection code and model ([scanic](https://github.com/marquaye/scanic)) are served from our own origin: `bun install`'s `postinstall` step copies them from `node_modules` into `app/public/vendor/` (gitignored). If you install with lifecycle scripts disabled, run `bun scripts/copy-scanner-assets.ts` from `app/` or the scanner can't detect pages.

## Port allocation

Each checkout gets a block of 10 ports (`+0` to `+9`) from one base port:

- **Root checkout:** `3300`.
- **Worktrees (Orca, Claude Code, plain `git worktree`):** a block in `20000`–`21990`, claimed by `scripts/workspace/ports.sh` when setup or the run script runs, and written to `app/.env.local` / `extension/.env.local` as `ABODE_PORT`. Claims live in a register in the repo's shared `.git` dir, so worktrees never share a block. Archiving a worktree frees its block straight away; a worktree deleted any other way is freed the next time any worktree claims a block. `scripts/workspace/ports.sh list` shows every claim.
- **Conductor workspaces:** Conductor's own `CONDUCTOR_PORT`.

Code reads the base port through `getBasePort()` (`app/src/lib/dev-port.ts`); in a shell, `scripts/workspace/ports.sh current` prints it.

| Offset | Service                 | Runtime Status                  |
| ------ | ----------------------- | ------------------------------- |
| +0     | Next.js dev server      | Active (`bun run dev`)          |
| +1     | Supabase API (kong)     | Active (E2E tests only)         |
| +2     | Supabase DB (postgres)  | Active (E2E tests only)         |
| +3     | Mailpit web UI          | Active (E2E tests only)         |
| +4     | Mailpit SMTP            | Active (E2E tests only)         |
| +5     | E2E / demo Next.js server | Active during `test:e2e` or `demo:stack` |
| +6     | Studio                  | Excluded (`-x studio`)          |
| +7     | Analytics               | Excluded (`-x logflare,vector`) |
| +8     | Pooler                  | Disabled                        |
| +9     | Edge Runtime            | Excluded (`-x edge-runtime`)    |

- **+0** is the checkout's dev server
- **+1 to +4** are used by the isolated Supabase instance started during E2E tests and `demo:stack` (`supabase-e2e/`), so the two can't run at once in one checkout
- **+5** is the shadow DB port in Supabase config (never bound at runtime), reused for the E2E / demo Next.js server
- **+6 to +9** are assigned in `config.toml` but services are excluded via `-x` flags and never bind

## Amp orbs

`.agents/setup` prepares an [Amp orb](https://ampcode.com/docs/orbs): it starts Docker, installs Bun and the Supabase CLI at CI's pinned versions, installs dependencies from the lockfile, generates the Prisma client, enables the git hooks and installs the test browsers. It writes no `.env.local`: unit tests need none, and integration tests need the same placeholder env vars as the CI `integration` job (their Postgres is a Testcontainers one, and Supabase is stubbed):

```bash
cd app
DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key-for-ci \
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key-for-ci \
RLS_ENFORCED=true \
bun run test:integration
```

## Starting Supabase manually

If you need to start Supabase manually (outside of `bin/dev`):

```bash
./scripts/start-supabase.sh
```

**Note:** This script includes a workaround for a [known Supabase bug](https://github.com/orgs/supabase/discussions/20753) where custom email templates fail to load due to a race condition. The script restarts the auth container after startup to ensure templates are loaded. This workaround can be removed once Supabase fixes the underlying issue.

## Recording PR demos

PRs with user-facing changes include a short demo video (see the `record-pr-demo` skill in `.agents/skills/`). Recording needs Docker, `ffmpeg` and `python3` on `PATH` (e.g. `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Debian/Ubuntu), GitHub CLI 2.99+ (for `gh pr edit --attach`) and agent-browser's Chrome, installed once with `app/node_modules/.bin/agent-browser install` (agent-browser itself is a devDependency). `bun run demo:stack` from `app/` starts an isolated stack with a seeded test user to record against, so videos never show your own data.

## Quality gate

Run from the `app/` directory:

```bash
bun run check:fix   # Biome autofix + prisma format + tsc --noEmit (run before every commit)
bun run test        # unit tests
```

Enable the repo's git hooks once per clone (`git config core.hooksPath .githooks`). The pre-commit hook runs Biome on the staged content, so a file edited after your last `check:fix` is caught before it reaches CI (for a partly staged file, only formatting and auto-fixable lint; CI catches the rest), and a gitleaks secret scan. Each check runs only when its tool is available (Biome needs `bun install` in `app/`; gitleaks is a separate install). Otherwise the hook warns and skips that check, and CI still runs both.

See [AGENTS.md](AGENTS.md) for the full command table, conventions, and the graceful-degradation principle for optional services.
