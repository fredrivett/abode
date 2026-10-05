-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('pending', 'exporting', 'completed', 'failed', 'expired');

-- CreateTable
CREATE TABLE "data_exports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'pending',
    "file_key" TEXT,
    "size_bytes" BIGINT,
    "item_count" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_exports_user_id_created_at_idx" ON "data_exports"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "data_exports_status_expires_at_idx" ON "data_exports"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default-deny: only the app (Prisma, as table owner) reads or writes exports
ALTER TABLE "data_exports" ENABLE ROW LEVEL SECURITY;
