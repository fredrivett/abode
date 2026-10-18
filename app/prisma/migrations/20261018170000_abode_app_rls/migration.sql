-- Database-enforced tenant isolation for a restricted application role.
--
-- The app connects as the table owner, which bypasses RLS, so today user
-- isolation lives only in application code. This adds `abode_app`: a role that
-- can't bypass RLS and only ever sees its viewer's own rows. Requests that run
-- as it (via forViewer / viewerTransaction in src/lib/db-viewer.ts) set the
-- viewer per transaction with set_config('abode.viewer_id', …, true).
--
-- Nothing switches to the role yet, so this migration changes no runtime
-- behaviour. Every policy is `TO abode_app`, so the anon/authenticated
-- PostgREST roles stay default-deny, and the role is never granted to
-- `authenticator`, so PostgREST can't switch to it.
--
-- Self-hosters: the migration user needs CREATEROLE (Supabase's `postgres` has it).

-- Role. Roles are cluster-global, so shadow/test databases may already have
-- it: reuse it only if it's still exactly this restricted role, and fail the
-- migration otherwise. A role that could log in, bypass RLS or inherit another
-- role's privileges (a table owner's, say) would defeat every policy below.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abode_app') THEN
    CREATE ROLE abode_app NOLOGIN NOBYPASSRLS;
  ELSIF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'abode_app' AND (rolsuper OR rolbypassrls OR rolcanlogin)
  ) OR EXISTS (
    SELECT 1 FROM pg_auth_members am
    JOIN pg_roles r ON r.oid = am.member
    WHERE r.rolname = 'abode_app'
  ) THEN
    RAISE EXCEPTION 'abode_app exists but is not a restricted, memberless NOLOGIN NOBYPASSRLS role';
  END IF;

  -- The app's login role switches to it per transaction (set_config('role', …)).
  -- Granted by name: Supabase's supautils crashes the backend on
  -- `GRANT … TO CURRENT_USER`.
  EXECUTE format('GRANT abode_app TO %I', current_user);
END $$;

-- Helpers live outside `public`, which PostgREST exposes
CREATE SCHEMA IF NOT EXISTS abode;
GRANT USAGE ON SCHEMA abode TO abode_app;
GRANT USAGE ON SCHEMA public TO abode_app;

-- The viewer of the current transaction; null for an anonymous one
CREATE OR REPLACE FUNCTION abode.viewer_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('abode.viewer_id', true), '')::uuid $$;

-- Parent ownership, for tables that hang off an item / room / export
CREATE OR REPLACE FUNCTION abode.owns_item(target uuid) RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.items WHERE id = target AND user_id = abode.viewer_id()) $$;

CREATE OR REPLACE FUNCTION abode.owns_room(target uuid) RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = target AND user_id = abode.viewer_id()) $$;

CREATE OR REPLACE FUNCTION abode.owns_export(target uuid) RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.data_exports WHERE id = target AND user_id = abode.viewer_id()) $$;

-- Table privileges: RLS below decides which rows. New tables inherit these
-- grants but stay invisible until they get policies (rls-coverage enforces it).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO abode_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO abode_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO abode_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO abode_app;
-- Guarded: Prisma's shadow database has no ledger table
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON public."_prisma_migrations" FROM abode_app;
  END IF;
END $$;

-- Users: your own row only, and only the columns you may change yourself.
-- Admin flag, email, counters, invite allocation, origin, referral and member
-- number are written by system code, never by a user's own request.
REVOKE INSERT, UPDATE, DELETE ON public.users FROM abode_app;
GRANT UPDATE (
  username, previous_usernames, first_name, last_name, website, bio,
  avatar_url, avatar_source, onboarding_completed_at, show_invited_by,
  show_invited, allow_search_indexing, allow_share_invites,
  dismissed_auto_rooms, updated_at
) ON public.users TO abode_app;

CREATE POLICY abode_own_row_select ON public.users FOR SELECT TO abode_app
  USING (id = (SELECT abode.viewer_id()));
CREATE POLICY abode_own_row_update ON public.users FOR UPDATE TO abode_app
  USING (id = (SELECT abode.viewer_id()))
  WITH CHECK (id = (SELECT abode.viewer_id()));

-- Tables owned directly by a user
CREATE POLICY abode_owner ON public.items FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()));
CREATE POLICY abode_owner ON public.rooms FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()));
CREATE POLICY abode_owner ON public.note_drafts FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()));
-- Append-only: users can log their own activity but not edit or erase it
CREATE POLICY abode_owner_read ON public.activity_logs FOR SELECT TO abode_app
  USING (user_id = (SELECT abode.viewer_id()));
CREATE POLICY abode_owner_insert ON public.activity_logs FOR INSERT TO abode_app
  WITH CHECK (user_id = (SELECT abode.viewer_id()));
CREATE POLICY abode_owner ON public.user_milestones FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()));
-- Read-only: these are the spend caps' counters, written by system code, so a
-- user can never reset their own limits
CREATE POLICY abode_owner_read ON public.usage_daily FOR SELECT TO abode_app
  USING (user_id = (SELECT abode.viewer_id()));
CREATE POLICY abode_owner ON public.personal_access_tokens FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()));
-- Imports and exports: the user starts one and reads its progress; the
-- background job that runs it owns every later update and the cleanup
CREATE POLICY abode_owner_read ON public.item_imports FOR SELECT TO abode_app
  USING (user_id = (SELECT abode.viewer_id()));
CREATE POLICY abode_owner_insert ON public.item_imports FOR INSERT TO abode_app
  WITH CHECK (user_id = (SELECT abode.viewer_id()));
CREATE POLICY abode_owner_read ON public.data_exports FOR SELECT TO abode_app
  USING (user_id = (SELECT abode.viewer_id()));
CREATE POLICY abode_owner_insert ON public.data_exports FOR INSERT TO abode_app
  WITH CHECK (user_id = (SELECT abode.viewer_id()));

-- Owned by a user AND attached to an item: both must be the viewer's, so a row
-- can't be hung off someone else's item
CREATE POLICY abode_owner ON public.item_locations FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()) AND abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_visual_vectors FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()) AND abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_text_vectors FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()) AND abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_media_analysis FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()) AND abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.article_highlights FOR ALL TO abode_app
  USING (user_id = (SELECT abode.viewer_id()))
  WITH CHECK (user_id = (SELECT abode.viewer_id()) AND abode.owns_item(item_id));

-- Per-item detail rows: through the parent item
CREATE POLICY abode_owner ON public.item_article_details FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_document_pages FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_image_details FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_twitter_details FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_instagram_details FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_video_details FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_product_details FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_book_details FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));
CREATE POLICY abode_owner ON public.item_note_details FOR ALL TO abode_app
  USING (abode.owns_item(item_id)) WITH CHECK (abode.owns_item(item_id));

-- Room membership: your room, and only your own items can go in it
CREATE POLICY abode_owner ON public.room_items FOR ALL TO abode_app
  USING (abode.owns_room(room_id))
  WITH CHECK (abode.owns_room(room_id) AND abode.owns_item(item_id));

-- Read-only to the owner; written by system code (embed tracking, export builds)
CREATE POLICY abode_owner_read ON public.room_embed_referrers FOR SELECT TO abode_app
  USING (abode.owns_room(room_id));
CREATE POLICY abode_owner_read ON public.data_export_parts FOR SELECT TO abode_app
  USING (abode.owns_export(export_id));

-- Invites you sent
CREATE POLICY abode_inviter ON public.invites FOR ALL TO abode_app
  USING (inviter_id = (SELECT abode.viewer_id()))
  WITH CHECK (inviter_id = (SELECT abode.viewer_id()));

-- Corpus-wide CLIP statistics: no user data, read by similar-image search
CREATE POLICY abode_read_all ON public.visual_embedding_stats FOR SELECT TO abode_app
  USING (true);

-- waitlist_entries: no policy — pre-signup emails are system-only
