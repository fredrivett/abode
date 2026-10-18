-- Item and storage counters for request code running as abode_app.
--
-- users.item_count / storage_used_bytes aren't updatable by abode_app (a user
-- shouldn't be able to set their own quota counters), but creating or deleting
-- an item adjusts them in the same transaction. This function does exactly
-- that adjustment and nothing else. Called from a user's request (as
-- abode_app) it only ever touches the viewer's own row; called on the owner
-- connection (background jobs), any user's.

CREATE OR REPLACE FUNCTION abode.adjust_user_counters(
  target uuid,
  item_delta integer,
  bytes_delta bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- current_setting('role') still reports the caller's role inside a
  -- SECURITY DEFINER function
  IF current_setting('role') = 'abode_app'
     AND target IS DISTINCT FROM abode.viewer_id() THEN
    RAISE EXCEPTION 'abode_app can only adjust its own viewer''s counters'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.users
  SET item_count = item_count + item_delta,
      storage_used_bytes = storage_used_bytes + bytes_delta,
      updated_at = now()
  WHERE id = target;
END $$;

REVOKE ALL ON FUNCTION abode.adjust_user_counters(uuid, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION abode.adjust_user_counters(uuid, integer, bigint) TO abode_app;
