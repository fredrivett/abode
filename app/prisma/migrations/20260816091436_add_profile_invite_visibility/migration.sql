-- AlterTable
ALTER TABLE "users" ADD COLUMN     "show_invited" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_invited_by" BOOLEAN NOT NULL DEFAULT true;
