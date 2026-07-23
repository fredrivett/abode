-- Enable Row Level Security (default-deny) on the remaining app tables.
-- Defense-in-depth: the app reaches these only via Prisma as the table owner
-- (which bypasses RLS); there is no anon/authenticated PostgREST path, so no
-- policies are needed. items / item_visual_vectors / item_text_vectors already
-- have RLS (migrations 20251208211300, 20251210003700).
ALTER TABLE "users"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_locations"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_article_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_image_details"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_twitter_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_video_details"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_product_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_book_details"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_note_details"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_items"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_embed_referrers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "article_highlights"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_logs"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_milestones"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invites"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist_entries"     ENABLE ROW LEVEL SECURITY;

-- Silence the SECURITY DEFINER advisor false-positive: these are trigger
-- functions (they cannot be called directly, and trigger firing does not check
-- EXECUTE), so this is least-privilege hygiene with no functional change.
-- Guarded on the auth schema so it is a no-op on the Prisma shadow database,
-- which has no Supabase auth schema (so these functions aren't created there) —
-- mirroring migration 20251205155900.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user()     FROM anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.handle_user_deleted() FROM anon, authenticated;
  END IF;
END $$;
