-- CreateEnum (if not exists)
DO $$ BEGIN
    CREATE TYPE "AvatarSource" AS ENUM ('upload', 'oauth', 'gravatar');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable (add column if not exists)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_source" "AvatarSource";
