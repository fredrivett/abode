-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('complete_profile', 'upload_first_image', 'save_first_url', 'see_ai_analysis', 'search_items', 'add_first_tag', 'highlight_article', 'create_first_room', 'create_dynamic_room', 'share_room', 'invite_friend');

-- CreateTable
CREATE TABLE "user_milestones" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_milestones_user_id_idx" ON "user_milestones"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_milestones_user_id_type_key" ON "user_milestones"("user_id", "type");

-- AddForeignKey
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
