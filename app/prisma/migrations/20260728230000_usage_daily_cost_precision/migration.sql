-- Widen usage_daily.cost_usd from DECIMAL(10,4) to DECIMAL(12,8) so sub-cent AI
-- costs (e.g. a ~$0.00002 text embedding) are retained on accrual instead of
-- rounding to zero, keeping today's spend + the per-user $ backstop accurate.
ALTER TABLE "usage_daily" ALTER COLUMN "cost_usd" SET DATA TYPE DECIMAL(12,8);
