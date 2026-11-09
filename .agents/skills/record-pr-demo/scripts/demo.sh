# Helpers for recording PR demos with agent-browser. Source this file (bash), then script the flow.
#
#   demo_login                          log the demo stack's test user in (call before recording)
#   start_recording <file> "<title>" "<before>" "<after>" [seconds] ["<take heading>" "<take line>"]
#                                       title card (❌ before / ✅ after), then start recording so the card is the
#                                       first frame; optionally follow it with a take card ("❌ Before this PR")
#   take_card "<heading>" "<line>" [seconds]   full-screen card mid-video
#   caption "<text>"                    caption bar; each call replaces the text (and re-installs overlays
#                                       after a full page load)
#   caption_position top|bottom         move the caption bar off something the reviewer needs to see
#   clear_caption
#   glide <selector|@ref>               move the pointer smoothly onto an element (use instead of `hover`)
#   wheel_over <selector|@ref> <pixels> glide onto a scroll area, then scroll it with real wheel input
#   checkpoint <name>                   screenshot for a parity check; in the second take, diffs against the first
#   stop_recording                      save the video, shrink it under the upload limit, save its last frame
#
# Environment:
#   DEMO_URL        demo stack base URL (default: http://localhost:$((CONDUCTOR_PORT or 3300) + 5))
#   DEMO_DIR        where recordings and checkpoints go (default: <repo>/.demos)
#   DEMO_TAKE       name of the current take, e.g. before / after (used by checkpoint)
#   DEMO_MAX_BYTES  upload limit to fit videos under (default 9.5 MB; GitHub's free-plan video limit is 10 MB)

_demo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

# A named session per checkout (name plus a hash of its full path, as checkouts of different repos can share
# a directory name): the default agent-browser session is shared by every agent on the machine
export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-demo-$(basename "$_demo_root")-$(printf '%s' "$_demo_root" | cksum | cut -d' ' -f1)}"
DEMO_URL="${DEMO_URL:-http://localhost:$((${CONDUCTOR_PORT:-3300} + 5))}"
DEMO_DIR="${DEMO_DIR:-$_demo_root/.demos}"
DEMO_MAX_BYTES="${DEMO_MAX_BYTES:-9500000}"
DEMO_USER_EMAIL="${DEMO_USER_EMAIL:-e2e-user@test.local}"
DEMO_USER_PASSWORD="${DEMO_USER_PASSWORD:-test-password-123!}"
mkdir -p "$DEMO_DIR"

# The version pinned in app/package.json, not whatever is installed globally
ab() {
  local bin="$_demo_root/app/node_modules/.bin/agent-browser"
  [ -x "$bin" ] || { echo "ab: agent-browser isn't installed; run \`cd app && bun install\`" >&2; return 127; }
  "$bin" "$@"
}

_js_string() { python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1"; }

# Light mode by default so videos are consistent; `ab set media dark` afterwards for a dark-mode change
demo_login() {
  ab set viewport 1440 900 >/dev/null
  ab set media light >/dev/null
  ab open "$DEMO_URL/login" >/dev/null
  # /login redirects a signed-in session to the dashboard
  [[ $(ab get url) == */dashboard* ]] && return 0
  ab fill '#email' "$DEMO_USER_EMAIL" >/dev/null &&
    ab fill '#password' "$DEMO_USER_PASSWORD" >/dev/null &&
    ab find role button click --name "Sign in" >/dev/null &&
    ab wait --url '**/dashboard' >/dev/null || { echo "demo_login: didn't reach /dashboard" >&2; return 1; }
}

# Cards and captions are page elements: they ignore pointer events, so they never block the flow under test
_card() {
  local heading body
  heading=$(_js_string "$1")
  body=$(_js_string "$2")
  ab eval "(() => {
    document.getElementById('demo-card')?.remove();
    const card = document.createElement('div');
    card.id = 'demo-card';
    card.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:0 120px;' +
      'background:rgba(250,250,248,0.92);backdrop-filter:blur(6px);color:#111;' +
      'font-family:-apple-system,system-ui,sans-serif;text-align:center';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:42px;font-weight:600;line-height:1.2';
    title.textContent = $heading;
    const lines = document.createElement('div');
    lines.style.cssText = 'max-width:960px;font-size:22px;line-height:1.6;color:#333;white-space:pre-line';
    lines.textContent = $body;
    card.append(title, lines);
    document.documentElement.append(card);
  })()" >/dev/null
}

_remove_card() { ab eval "document.getElementById('demo-card')?.remove()" >/dev/null; }

# agent-browser's own --cursor ripple is small, so draw a larger ring wherever a click lands
_install_click_ring() {
  ab eval "(() => {
    if (window.__demoClickRing) return;
    window.__demoClickRing = (event) => {
      const ring = document.createElement('div');
      ring.className = 'demo-overlay';
      ring.style.cssText = 'position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;' +
        'border:3px solid rgba(37,99,235,0.9);background:rgba(37,99,235,0.18);pointer-events:none;' +
        'z-index:2147483646;left:' + event.clientX + 'px;top:' + event.clientY + 'px';
      document.documentElement.append(ring);
      ring.animate([{ transform: 'scale(0.4)' }, { transform: 'scale(1)', offset: 0.35 }, { transform: 'scale(1.5)', opacity: 0 }],
        { duration: 700, easing: 'ease-out' }).onfinish = () => ring.remove();
    };
    addEventListener('pointerdown', window.__demoClickRing, true);
  })()" >/dev/null
}

start_recording() {
  local file=$1 title=$2 before=$3 after=$4 seconds=${5:-5}
  _card "$title" "❌ Before: $before"$'\n'"✅ After: $after"
  _install_click_ring
  # Smooth input makes the pointer glide to each click instead of jumping
  if ! ab --input-mode smooth record start "$file" --cursor; then
    _remove_card
    ab --input-mode instant get url >/dev/null
    return 1
  fi
  sleep "$seconds"
  if [ -n "${6:-}" ]; then take_card "$6" "${7:-}"; else _remove_card; fi
}

take_card() {
  _card "$1" "$2"
  sleep "${3:-2.5}"
  _remove_card
}

caption() {
  local text
  text=$(_js_string "$1")
  _install_click_ring
  ab eval "(() => {
    let bar = document.getElementById('demo-caption');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demo-caption';
      bar.className = 'demo-overlay';
      bar.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:2147483646;' +
        'pointer-events:none;max-width:980px;padding:12px 22px;border-radius:12px;text-align:center;' +
        'background:rgba(17,17,17,0.9);color:#fff;font:500 20px/1.35 -apple-system,system-ui,sans-serif;' +
        'border:1px solid rgba(255,255,255,0.18);box-shadow:0 6px 24px rgba(0,0,0,0.25)';
      document.documentElement.append(bar);
    }
    bar.textContent = $text;
  })()" >/dev/null
}

caption_position() {
  local css="top:auto;bottom:64px"
  [ "$1" = top ] && css="top:96px;bottom:auto"
  ab eval "(() => { const bar = document.getElementById('demo-caption'); if (bar) bar.style.cssText += ';$css'; })()" >/dev/null
}

clear_caption() { ab eval "document.getElementById('demo-caption')?.remove()" >/dev/null; }

# Centre of the element's visible part, or failure if none of it is on screen
_visible_centre() {
  ab eval "(() => {
    const el = document.querySelector($(_js_string "$1"));
    if (!el) return '';
    const r = el.getBoundingClientRect();
    const left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth);
    const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
    return right > left && bottom > top ? Math.round((left + right) / 2) + ' ' + Math.round((top + bottom) / 2) : '';
  })()" | tr -d '"'
}

glide() {
  local target=$1 centre
  if [[ $target == @* ]]; then
    # Refs only resolve inside agent-browser, so take the element's box from it
    centre=$(ab get box "$target" | awk '/^x:/{x=$2} /^y:/{y=$2} /^width:/{w=$2} /^height:/{h=$2} END{if (w) printf "%d %d", x+w/2, y+h/2}')
  else
    centre=$(_visible_centre "$target")
  fi
  [ -n "$centre" ] || { echo "glide: $target isn't on screen; scroll to it with wheel_over first" >&2; return 1; }
  # shellcheck disable=SC2086 # two coordinates
  ab mouse move $centre >/dev/null || return 1
  _demo_pointer=$centre
}

# `mouse wheel` scrolls whatever is under the pointer; a few smaller steps read as a real scroll, not a jump
wheel_over() {
  local step
  glide "$1" || return 1
  step=$(($2 / 6))
  for _ in 1 2 3 4 5 6; do
    ab mouse wheel "$step" >/dev/null || return 1
    sleep 0.06
  done
}

_set_overlays_visible() {
  ab eval "document.querySelectorAll('#demo-caption, #demo-card, .demo-overlay').forEach((el) => { el.style.visibility = '$1'; })" >/dev/null
}

checkpoint() {
  local name=$1 take=${DEMO_TAKE:?set DEMO_TAKE (e.g. before / after) before calling checkpoint}
  local dir="$DEMO_DIR/checkpoints"
  mkdir -p "$dir/$take"
  _set_overlays_visible hidden
  ab screenshot "$dir/$take/$name.png" >/dev/null
  local baseline
  baseline=$(find "$dir" -path "$dir/$take" -prune -o -name "$name.png" -print | head -1)
  if [ -n "$baseline" ]; then
    echo "checkpoint $name: $take vs $(basename "$(dirname "$baseline")")"
    ab diff screenshot --baseline "$baseline" -o "$dir/$take/$name.diff.png"
  fi
  _set_overlays_visible visible
  sleep 0.3 # let the restored caption reach the video before the next step
}

# Re-encode (from the original) at falling quality until the file fits under DEMO_MAX_BYTES
_fit_video() {
  local file=$1 original="${1%.*}.original.mp4" step
  [ "$(wc -c <"$file")" -le "$DEMO_MAX_BYTES" ] && return 0
  mv "$file" "$original"
  for step in "28 30 1440" "32 30 1440" "32 24 1280" "36 20 1120"; do
    # shellcheck disable=SC2086 # three values
    set -- $step
    ffmpeg -v error -y -i "$original" -an -c:v libx264 -preset slow -crf "$1" -r "$2" \
      -vf "scale=$3:-2" -pix_fmt yuv420p -movflags +faststart "$file"
    if [ "$(wc -c <"$file")" -le "$DEMO_MAX_BYTES" ]; then
      rm -f "$original"
      return 0
    fi
  done
  echo "stop_recording: $file is still over $DEMO_MAX_BYTES bytes; record a shorter take" >&2
  return 1
}

stop_recording() {
  local file
  file=$(ab record stop --json | python3 -c 'import json, sys; data = json.load(sys.stdin); print((data.get("data") or data).get("path", ""))')
  [ -n "$file" ] || { echo "stop_recording: agent-browser didn't report the video path" >&2; return 1; }
  ab eval "(() => {
    document.querySelectorAll('#demo-caption, #demo-card, .demo-overlay').forEach((el) => el.remove());
    if (window.__demoClickRing) removeEventListener('pointerdown', window.__demoClickRing, true);
    delete window.__demoClickRing;
  })()" >/dev/null
  ab --input-mode instant get url >/dev/null
  _fit_video "$file" || return 1
  ffmpeg -v error -y -sseof -0.2 -i "$file" -frames:v 1 -update 1 "${file%.*}.png"
  echo "$file ($(($(wc -c <"$file") / 1024)) KB), last frame: ${file%.*}.png"
}
