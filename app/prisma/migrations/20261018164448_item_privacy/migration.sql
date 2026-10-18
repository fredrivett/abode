-- CreateEnum
CREATE TYPE "ItemPrivacy" AS ENUM ('standard', 'unlisted', 'sensitive');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "privacy" "ItemPrivacy" NOT NULL DEFAULT 'standard';

-- Carry the old "exclude from public rooms" switch over to its ladder level.
-- The old column stays until this deploy is live (the build migrates before
-- the new code serves traffic); a follow-up migration re-syncs and drops it.
UPDATE "items" SET "privacy" = 'unlisted' WHERE "exclude_from_public_rooms";
