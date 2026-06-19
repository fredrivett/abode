-- AlterTable
ALTER TABLE "items" ADD COLUMN     "shared_at" TIMESTAMP(3),
ADD COLUMN     "shared_highlights" BOOLEAN NOT NULL DEFAULT false;

