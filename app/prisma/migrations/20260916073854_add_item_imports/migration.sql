-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'importing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('literal');

-- CreateTable
CREATE TABLE "item_imports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" "ImportSource" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "item_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_imports_user_id_status_idx" ON "item_imports"("user_id", "status");

-- AddForeignKey
ALTER TABLE "item_imports" ADD CONSTRAINT "item_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security (default-deny) on item_imports, matching every other
-- app table. Accessed only server-side via Prisma (owner role, which bypasses
-- RLS); the anon/authenticated Supabase roles get no access.
ALTER TABLE "item_imports" ENABLE ROW LEVEL SECURITY;
