-- Normalise items / item_visual_vectors / item_text_vectors to the same RLS
-- posture as every other app table: RLS enabled, no policies (default-deny to
-- anon/authenticated). These three were the first tables to get RLS and were
-- given per-user auth.uid() policies, but nothing reaches them via the
-- anon/authenticated PostgREST/Realtime path (all access is raw SQL through the
-- Prisma owner connection, which bypasses RLS), so the policies were dead code.
-- Dropping them removes the auth-schema-guarded special-casing and makes the
-- tables verifiable by the rls-coverage guardrail test.
--
-- The ENABLE is unconditional (so the flag is set in every environment,
-- including the Prisma shadow/test DB where the original guarded ENABLE was
-- skipped) and idempotent in production. DROP POLICY IF EXISTS is a no-op on any
-- DB where the auth-guarded policies were never created (shadow/test).

ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own items" ON "items";

ALTER TABLE "item_visual_vectors" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own visual vectors" ON "item_visual_vectors";

ALTER TABLE "item_text_vectors" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own text vectors" ON "item_text_vectors";
