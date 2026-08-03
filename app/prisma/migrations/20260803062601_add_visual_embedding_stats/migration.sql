-- CreateTable
CREATE TABLE "visual_embedding_stats" (
    "model" TEXT NOT NULL,
    "mean_embedding" vector(768),
    "n" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_embedding_stats_pkey" PRIMARY KEY ("model")
);

-- Default-deny RLS: every table must enable RLS (no policies = unreachable by
-- the anon/authenticated Supabase roles; all access is raw SQL via the Prisma
-- owner connection, which bypasses RLS). Matches item_visual_vectors' posture
-- and satisfies the rls-coverage guardrail test.
ALTER TABLE "visual_embedding_stats" ENABLE ROW LEVEL SECURITY;
