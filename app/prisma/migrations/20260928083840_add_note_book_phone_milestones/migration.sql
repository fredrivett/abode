-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MilestoneType" ADD VALUE 'write_first_note';
ALTER TYPE "MilestoneType" ADD VALUE 'add_first_book';
ALTER TYPE "MilestoneType" ADD VALUE 'save_from_phone';
