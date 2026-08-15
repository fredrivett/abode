-- CreateEnum
CREATE TYPE "CaptureSource" AS ENUM ('web', 'share_target', 'extension');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "capture_source" "CaptureSource";
