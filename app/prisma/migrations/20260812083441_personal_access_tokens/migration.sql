-- CreateTable
CREATE TABLE "personal_access_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read']::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_access_tokens_token_hash_key" ON "personal_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "personal_access_tokens_user_id_idx" ON "personal_access_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default-deny RLS: every table must enable RLS (no policies = unreachable by
-- the anon/authenticated Supabase roles; all access is raw SQL via the Prisma
-- owner connection, which bypasses RLS). Token validation runs server-side via
-- the Prisma owner connection, so default-deny is correct here.
ALTER TABLE "personal_access_tokens" ENABLE ROW LEVEL SECURITY;
