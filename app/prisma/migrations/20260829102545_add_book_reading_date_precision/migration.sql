-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('day', 'month', 'year');

-- AlterTable
ALTER TABLE "item_book_details" ADD COLUMN     "finished_at_precision" "DatePrecision",
ADD COLUMN     "started_at_precision" "DatePrecision";
