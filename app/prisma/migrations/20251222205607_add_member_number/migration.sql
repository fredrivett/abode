/*
  Warnings:

  - A unique constraint covering the columns `[member_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "article_highlights" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "member_number" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_member_number_key" ON "users"("member_number");
