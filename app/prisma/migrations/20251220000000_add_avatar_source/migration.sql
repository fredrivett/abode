-- CreateEnum
CREATE TYPE "AvatarSource" AS ENUM ('upload', 'oauth', 'gravatar');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_source" "AvatarSource";
