-- Consolidate InviteType and InviteSource into single InviteOrigin enum
-- Rename type -> origin on invites table
-- Rename invite_source -> origin on users table

-- CreateEnum
CREATE TYPE "InviteOrigin" AS ENUM ('user', 'waitlist', 'admin');

-- Migrate invites.type -> invites.origin (preserving data)
ALTER TABLE "invites" ADD COLUMN "origin" "InviteOrigin";
UPDATE "invites" SET "origin" = "type"::text::"InviteOrigin";
ALTER TABLE "invites" ALTER COLUMN "origin" SET NOT NULL;
ALTER TABLE "invites" DROP COLUMN "type";

-- Migrate users.invite_source -> users.origin (preserving data)
ALTER TABLE "users" ADD COLUMN "origin" "InviteOrigin";
UPDATE "users" SET "origin" = "invite_source"::text::"InviteOrigin" WHERE "invite_source" IS NOT NULL;
ALTER TABLE "users" DROP COLUMN "invite_source";

-- DropEnum (after data migrated)
DROP TYPE "InviteSource";
DROP TYPE "InviteType";
