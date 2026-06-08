#!/usr/bin/env bash
# Bans TypeScript escape-hatch comments that hide type errors.
#  - @ts-ignore / @ts-nocheck: always banned.
#  - @ts-expect-error: allowed ONLY in the form `@ts-expect-error: <reason>`
#    (colon + a non-empty description). Bare or description-without-colon is rejected.
# Biome's GritQL can't match comment trivia, so this is enforced here and in CI.
set -euo pipefail

cd "$(dirname "$0")/.."

violations=""

# @ts-ignore / @ts-nocheck: always banned.
banned=$(grep -rnE '@ts-(ignore|nocheck)' src trigger \
  --include='*.ts' --include='*.tsx' 2>/dev/null || true)
if [ -n "$banned" ]; then
  violations+="${banned}"$'\n'
fi

# @ts-expect-error must be immediately followed by ": <reason>".
# Collect every occurrence, then drop the ones in the valid format.
expect=$(grep -rnE '@ts-expect-error' src trigger \
  --include='*.ts' --include='*.tsx' 2>/dev/null || true)
if [ -n "$expect" ]; then
  bad=$(printf '%s\n' "$expect" \
    | grep -vE '@ts-expect-error:[[:space:]]*[^[:space:]]' || true)
  if [ -n "$bad" ]; then
    violations+="${bad}"$'\n'
  fi
fi

violations=$(printf '%s' "$violations" | sed '/^$/d')
if [ -n "$violations" ]; then
  echo "✖ Banned TypeScript suppression comments found:"
  echo "$violations"
  echo
  echo "Use '@ts-expect-error: <reason>' (colon + description); @ts-ignore / @ts-nocheck are not allowed."
  exit 1
fi

echo "✓ No banned TypeScript suppression comments."
