---
name: record-pr-demo
description: Record a short captioned video of a change running locally with agent-browser, and attach it to the PR so it plays inline. Use for every user-facing change, and for refactors that touch a user flow, to prove behaviour didn't change. Covers the isolated demo stack, logging in, choosing after-only / before-and-after / parity, the title card and captions, keeping each video under GitHub's upload limit, and attaching with `gh pr edit --attach`.
---

# Record a PR demo

A reviewer should watch the video once, with no narration, and know what changed (or that nothing did). That takes the real flow on the PR's code, a visible cursor, and on-screen text saying what to look at.

## When

- **User-facing change** (UI, copy, a flow, an error state): always record one.
- **Refactor or internal change that runs through a user flow** (component restructure, query or data-flow change, state management): record a **parity** run (step 4) when there's a real chance behaviour moved. It's the proof that nothing did.
- **Skip** for docs, tests, CI, and backend work no user flow touches, and say so in the PR.

## Prerequisites

- **Docker** running (the demo stack runs its own Supabase).
- `cd app && bun install`. agent-browser is a pinned devDependency; `demo.sh` calls that copy, not a global one.
- **Chrome for agent-browser**, once per machine: `app/node_modules/.bin/agent-browser install` (add `--with-deps` on Linux).
- **ffmpeg** on `PATH` (recording needs it): `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Debian/Ubuntu.
- **python3** on `PATH` (`demo.sh` uses it to escape caption text and read agent-browser's JSON output).
- **gh 2.99 or newer**, for `--attach` (`gh --version`).
- For the general command reference: `app/node_modules/.bin/agent-browser skills get core`.

## 1. Start the demo stack

```bash
cd app && bun run demo:stack
```

Run it in the background with the longest timeout available, and wait for `[demo-stack] ready at http://localhost:<port>`. It starts the e2e stack: its own Supabase on ports derived from the checkout's base port, migrations applied, a seeded test user (no 2FA), and a dev server on its own port and build dir.

- It never touches the shared local DB or the dev server the user is watching, so there's nothing of theirs to stop or restore.
- **Videos are public** (this repo is public, and attachments on public repos are viewable by anyone), so only ever record this stack: never the user's dev DB, prod, or a real account.
- It's the same stack `bun run test:e2e` uses, so don't run e2e tests in this checkout while it's up.
- Background processing (Trigger.dev) doesn't run against it. Saved links stay unprocessed, so prefer fixtures that don't need enrichment (notes, rooms, settings), or say in a caption that the item would process in production.
- Each worktree has its own port block (`scripts/workspace/ports.sh`), so worktrees can run demo stacks side by side; checkouts without one (the root checkout) share `3300`'s.

When you're done, stop it: end the background task (SIGTERM stops the dev server and Supabase), then run `cd app && bun run demo:stop` in case cleanup didn't run.

## 2. Log in before recording

`record start` records the active tab as it is, so log in first and the video starts logged in:

```bash
source .agents/skills/record-pr-demo/scripts/demo.sh
demo_login                      # 1440×900, light mode, test user, lands on /dashboard
ab open "$DEMO_URL/<start page>"
```

For a dark-mode change, `ab set media dark` after logging in. `ab` is the pinned agent-browser, on a session unique to this checkout (`AGENT_BROWSER_SESSION`, derived from its path unless you set it): the default session is shared by every agent on the machine and can be taken over mid-take.

Create fixtures through the app from the page (`ab eval "fetch('/api/...', { method: 'POST', ... })"`) or the UI, so each take starts from a known state.

## 3. Dry run the flow first

Run the whole flow once without recording and check the outcome (through the API or the page). That catches wrong selectors, slow compiles (the first visit to each route compiles it) and real bugs before they cost a take. Visit every route once so the take doesn't sit on a compile.

## 4. Choose: after only, before and after, or parity

If the user said which, do that. Otherwise:

- **Before and after** when the PR changes behaviour you can see and the old behaviour takes under ~30 seconds to show. Bug fixes and UX changes usually qualify: watching the bug happen makes the fix obvious.
- **After only** for new features, where "before" is just the feature's absence, and for bugs that are hard to stage (races, limits, unusual data). The title card's ❌ line covers the before.
- **Parity** for a refactor: the same script on the base commit and on the branch, with `checkpoint <name>` at each state worth comparing.

Say which you picked and why, so the user can ask for another.

**Before and after, and parity, record two takes as two separate videos** (each stays under the upload limit, and the PR shows them side by side under headings):

1. Commit your work (a WIP commit is fine; never a bare `git stash`, the stash is shared with other checkouts).
2. Check out the PR's base commit, so the only difference between the takes is the PR: `git checkout --detach "$(git merge-base origin/main HEAD)"` (for a stacked PR, the merge-base with the PR below it).
3. Start the demo stack (step 1) on the base, log in, record the before take with `DEMO_TAKE=before`.
4. `git checkout <branch>`. If `app/package.json`, `app/bun.lock` or `app/prisma/` differ from the base, run `cd app && bun install && bun run prisma:generate` and restart the stack (it starts empty, so re-create fixtures). Otherwise the dev server picks the change up; reload the page.
5. Record the after take with `DEMO_TAKE=after`, using the same script.

Prefix each take's captions with "❌ Before · " or "✅ After · " so a reviewer who skips ahead knows which code they're watching. For parity, use "Base · " and "This PR · ".

## 5. Record with a title card and captions

```bash
source .agents/skills/record-pr-demo/scripts/demo.sh

start_recording "$DEMO_DIR/pr-<number>-after.mp4" \
  "#<number> · <what changed, in a few words>" "<what used to happen>" "<what happens now>" \
  5 "✅ After this PR" "Same steps, with this PR's changes"

caption "Open the Recipes room"
ab click @e12; sleep 1
caption "The room is empty to start with"; sleep 2.5

# ...one caption per step...

caption "✅ All 3 items are in Recipes"; sleep 4
stop_recording
```

- `start_recording` puts the title card up before recording starts, so it's the video's first frame (the one players show before you press play). It records with agent-browser's cursor and smooth pointer movement, and draws a ring where each click lands. The optional last two arguments add a take card after the title card.
- `stop_recording` saves the video, switches the session back to instant movement, re-encodes the file if it's over `DEMO_MAX_BYTES` (9.5 MB by default; GitHub's free-plan video limit is 10 MB), and saves the last frame as a PNG next to it. If it still doesn't fit, record a shorter take.
- Use `glide <selector|@ref>` rather than `ab hover`, which ignores smooth mode and jumps. `glide` fails on an off-screen element rather than scrolling to it for you.
- Scroll the way a user does, with `wheel_over <scroll area> <pixels>`: real mouse-wheel input over that area, in a few steps. `scrollintoview` and `scroll` set the position directly, which can hide a scrolling bug.
- If a toast or anything else the reviewer must see appears where the caption sits, `caption_position top` before it shows and `caption_position bottom` after.
- Overlays survive in-app navigation, but a full page load (`ab open`, `ab reload`) removes them: call `caption` again after one.
- Overlays ignore pointer events, so they never block the flow under test.

Writing the text:

- **The title card names the PR and the behaviour**, with the ❌ "Before" and ✅ "After" lines written as what the user experiences, not what the code does. For parity: "No behaviour change", with the same flow on both lines and what was refactored.
- **A caption goes up before its step happens**, and says what to notice ("The room is empty to start with"), not a command log.
- **The last caption states the result**, starting with ✅. It's the frame most likely to be screenshotted.
- **One short sentence per caption**, with 2–4 seconds to read it.

### Parity checkpoints

In both takes, call `checkpoint <name>` at the same points (`DEMO_TAKE=before`, then `DEMO_TAKE=after`). It hides the overlays, screenshots the page into `$DEMO_DIR/checkpoints/<take>/`, and in the second take diffs it against the first (`ab diff screenshot`), saving a diff image. Take the last checkpoint before the final caption, so the video doesn't end on a frame with the overlays hidden. Content that legitimately differs between takes (relative times, generated IDs) will show up in the diff: account for it, don't hide it. Report the result per checkpoint in the PR.

## 6. Check the output

- `ffprobe -v error -show_entries stream=width,height:format=duration,size -of csv=p=0 <file>`: 1440×900 (or the downscale `stop_recording` reports), under the limit.
- Pull a few frames (`ffmpeg -ss <t> -i <file> -frames:v 1 frame.png`) and look at them: cursor visible, captions readable, nothing covering what matters.
- Show the last-frame PNG in your reply.

## 7. Attach to the PR

`gh pr edit --attach` uploads files to GitHub's attachment storage, the same as drag-and-drop, so the video plays inline. A local path the body already references is rewritten to the uploaded URL; paths in `--body-file` resolve relative to that file.

```bash
gh pr view <number> --json body -q .body > "$DEMO_DIR/pr-body.md"
# add a "## Demo" section to pr-body.md, e.g.
#   ### ❌ Before
#   ![](./pr-<number>-before.mp4)
#   ### ✅ After
#   ![](./pr-<number>-after.mp4)
gh pr edit <number> --body-file "$DEMO_DIR/pr-body.md" \
  --attach "$DEMO_DIR/pr-<number>-before.mp4" --attach "$DEMO_DIR/pr-<number>-after.mp4"
```

Then `gh pr view <number> --json body` to check every local path became a `github.com/user-attachments/...` URL. For parity, add the checkpoint results under the videos.

## Gotchas

- **Hidden file inputs:** uploads usually go through a hidden `<input type="file">`. `glide` to the visible button for the cursor, then `ab upload '<input selector>' <files>`.
- **Clicks refuse to land under an overlay:** agent-browser won't click a covered element (a Next.js error overlay, an open dialog). Check `ab errors` and fix the page first.
- **Login fails:** check the demo stack's output. A stack that was killed without cleanup can leave containers running: `cd app && bun run demo:stop`, then start it again.
