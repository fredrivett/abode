# Contributing to abode

Thanks for your interest in abode. This covers the local development details beyond the quickstart in the [README](README.md).

> Self-hosting and contributions are welcome but **best-effort** — there's no SLA, and reviews/replies may be slow. See the README for the full picture.

## Environment

`bin/dev` sources `.env` and `.env.local` from the repo root. On first run the scripts symlink `app/.env` → `../.env.local` so Next.js picks up your root env values.

See `.env.example` for every variable. Only the **Required**-tier services in the README's [External services](README.md#external-services) table are needed to boot; everything else is optional and degrades gracefully when its key is absent (see [AGENTS.md](AGENTS.md#optional-services--graceful-degradation)).

## Port allocation

All ports are derived from `CONDUCTOR_PORT` (defaults to `3300` outside Conductor). Each Conductor workspace gets 10 ports (`+0` to `+9`).

| Offset | Service                 | Runtime Status                  |
| ------ | ----------------------- | ------------------------------- |
| +0     | Next.js dev server      | Active (Conductor `run` script) |
| +1     | Supabase API (kong)     | Active (E2E tests only)         |
| +2     | Supabase DB (postgres)  | Active (E2E tests only)         |
| +3     | Mailpit web UI          | Active (E2E tests only)         |
| +4     | Mailpit SMTP            | Active (E2E tests only)         |
| +5     | E2E test Next.js server | Active during `test:e2e` only   |
| +6     | Studio                  | Excluded (`-x studio`)          |
| +7     | Analytics               | Excluded (`-x logflare,vector`) |
| +8     | Pooler                  | Disabled                        |
| +9     | Edge Runtime            | Excluded (`-x edge-runtime`)    |

- **+0** is always in use by the Conductor dev server
- **+1 to +4** are used by the isolated Supabase instance started during E2E tests (`supabase-e2e/`)
- **+5** is the shadow DB port in Supabase config (never bound at runtime), reused for the E2E test Next.js server
- **+6 to +9** are assigned in `config.toml` but services are excluded via `-x` flags and never bind

## Starting Supabase manually

If you need to start Supabase manually (outside of `bin/dev`):

```bash
./scripts/start-supabase.sh
```

**Note:** This script includes a workaround for a [known Supabase bug](https://github.com/orgs/supabase/discussions/20753) where custom email templates fail to load due to a race condition. The script restarts the auth container after startup to ensure templates are loaded. This workaround can be removed once Supabase fixes the underlying issue.

## Quality gate

Run from the `app/` directory:

```bash
bun run check:fix   # Biome autofix + tsc --noEmit (run before every commit)
bun run test        # unit tests
```

See [AGENTS.md](AGENTS.md) for the full command table, conventions, and the graceful-degradation principle for optional services.
