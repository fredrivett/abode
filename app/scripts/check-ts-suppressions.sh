#!/usr/bin/env bash
# Bans TypeScript escape-hatch comments that hide type errors.
#  - @ts-ignore / @ts-nocheck: always banned.
#  - @ts-expect-error: allowed ONLY with a description (e.g. `@ts-expect-error: reason`).
# Biome's GritQL can't match comment trivia, so this is enforced here and in CI.
set -euo pipefail

cd "$(dirname "$0")/.."

# @ts-ignore / @ts-nocheck anywhere, or a bare @ts-expect-error (nothing after it on the line).
pattern='@ts-(ignore|nocheck)|@ts-expect-error[[:space:]]*$'

violations=$(grep -rnE "$pattern" src trigger \
  --include='*.ts' --include='*.tsx' 2>/dev/null || true)

if [ -n "$violations" ]; then
  echo "✖ Banned TypeScript suppression comments found:"
  echo "$violations"
  echo
  echo "Use '@ts-expect-error: <reason>' with a description, or fix the type."
  exit 1
fi

echo "✓ No banned TypeScript suppression comments."
