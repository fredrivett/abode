-- Remove foreign key constraint to auth.users (we use triggers instead to avoid Prisma cross-schema issues)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_fkey";
