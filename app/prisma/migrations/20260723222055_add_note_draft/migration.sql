-- CreateTable
CREATE TABLE "note_drafts" (
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_drafts_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "note_drafts" ADD CONSTRAINT "note_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
