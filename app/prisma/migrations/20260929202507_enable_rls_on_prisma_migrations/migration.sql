-- Enable Row Level Security (default-deny) on Prisma's migration ledger and
-- revoke the PostgREST roles' grants, so the anon key can't read or tamper with
-- it (a tampered ledger breaks `prisma migrate deploy`). Prisma runs as the
-- table owner, which bypasses RLS. Guarded so it's a no-op where the table
-- (Prisma shadow database) or the Supabase roles (plain Postgres) don't exist.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
      AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON public._prisma_migrations FROM anon, authenticated;
    END IF;
  END IF;
END $$;
