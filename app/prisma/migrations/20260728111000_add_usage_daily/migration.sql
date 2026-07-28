-- CreateTable
CREATE TABLE "usage_daily" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "bucket" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("user_id","day","bucket")
);

-- CreateIndex
CREATE INDEX "usage_daily_day_idx" ON "usage_daily"("day");

-- AddForeignKey
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable row level security (default-deny — no policies). Only privileged
-- server-side code (Prisma as table owner) touches this table; the anon /
-- authenticated Supabase roles get nothing. Enforced by the rls-coverage test.
ALTER TABLE "usage_daily" ENABLE ROW LEVEL SECURITY;
