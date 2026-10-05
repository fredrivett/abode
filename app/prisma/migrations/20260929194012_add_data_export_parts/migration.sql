-- CreateTable
CREATE TABLE "data_export_parts" (
    "id" UUID NOT NULL,
    "export_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "file_key" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_export_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_export_parts_export_id_position_key" ON "data_export_parts"("export_id", "position");

-- AddForeignKey
ALTER TABLE "data_export_parts" ADD CONSTRAINT "data_export_parts_export_id_fkey" FOREIGN KEY ("export_id") REFERENCES "data_exports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry any existing single-archive exports over as part 1 before dropping
-- data_exports.file_key, so their archives stay downloadable and expirable
INSERT INTO "data_export_parts" ("id", "export_id", "position", "file_key", "size_bytes")
SELECT gen_random_uuid(), "id", 1, "file_key", COALESCE("size_bytes", 0)
FROM "data_exports"
WHERE "file_key" IS NOT NULL;

-- AlterTable
ALTER TABLE "data_exports" DROP COLUMN "file_key",
ADD COLUMN     "file_count" INTEGER;

-- Default-deny: only the app (Prisma, as table owner) reads or writes parts
ALTER TABLE "data_export_parts" ENABLE ROW LEVEL SECURITY;
