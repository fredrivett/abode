-- Restore usage_daily.cost_usd whole-dollar range. DECIMAL(12,8) capped a single
-- (user, bucket, day) row at ~$9,999; DECIMAL(14,8) keeps the original 6-integer-
-- digit range (from the prior DECIMAL(10,4)) while retaining the 8 decimal places
-- needed for sub-cent AI costs.
ALTER TABLE "usage_daily" ALTER COLUMN "cost_usd" SET DATA TYPE DECIMAL(14,8);
