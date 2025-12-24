-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'admin_delete_user';
ALTER TYPE "ActivityType" ADD VALUE 'admin_invite_waitlist';
ALTER TYPE "ActivityType" ADD VALUE 'admin_grant_admin';
ALTER TYPE "ActivityType" ADD VALUE 'admin_revoke_admin';
