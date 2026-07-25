-- CreateEnum
CREATE TYPE "ProcessingErrorReason" AS ENUM ('source_blocked', 'source_not_found', 'source_unreachable', 'unsupported_content', 'unknown');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "processing_error" "ProcessingErrorReason";
