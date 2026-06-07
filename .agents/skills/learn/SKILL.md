---
name: learn
description: Turn a just-fixed bug or recurring defect into the cheapest durable guardrail (type, lint rule, test, or AGENTS.md rule) so it can't recur. Use after fixing a bug, when a mistake repeats, or when a review catches something a check should have caught.
---

# /learn — close the loop on a defect

When a bug is fixed or a mistake recurs, don't stop at the fix. Convert it into a guardrail at the cheapest layer that would have caught it, so the harness improves instead of the lesson living only in one prompt.

## Three-question test

1. Could this have been caught earlier in a cheaper layer (type → lint → test → review)?
2. Is this a pattern or an isolated incident? (Patterns earn a guardrail; one-offs may not.)
3. Did an advisory rule fail to stick — should it be upgraded to a deterministic check?

## Pick the cheapest durable layer (in order)

1. **Type** — can the type system make this bad state unrepresentable?
2. **Lint** — a Biome rule, or a grit plugin in `app/biome/` (matches the existing `no-hardcoded-ellipsis.grit` pattern) for an anti-pattern or closed escape hatch.
3. **Test** — a unit/integration test reproducing it, using real dependencies and a meaningful assertion.
4. **Doc rule** — an explicit Always / Never / Ask-first line in the relevant `AGENTS.md` section.
5. **Lesson note** — last resort, for context a check genuinely can't capture.

## Steps

1. State the root cause in one sentence.
2. Walk the layers above; choose the cheapest one that would have caught it.
3. Implement the guardrail. Verify it **fails on the old behavior** and **passes on the fix**.
4. If the guardrail is only advisory, add it to the relevant `AGENTS.md` section.
5. Append a one-line entry to the **Lessons learned** section in `AGENTS.md`.

Prefer deterministic checks over prose. A rule that prose can't reliably enforce belongs in lint or types.
