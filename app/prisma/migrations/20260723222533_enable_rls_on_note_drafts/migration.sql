-- Enable Row Level Security (default-deny) on note_drafts, matching every other
-- app table (migration 20260723213144). Defense-in-depth: the app reaches this
-- table only via Prisma as the table owner (which bypasses RLS); there is no
-- anon/authenticated PostgREST path, so no policies are needed.
ALTER TABLE "note_drafts" ENABLE ROW LEVEL SECURITY;
