-- Item and storage counters for request code running as abode_app.
--
-- users.item_count / storage_used_bytes aren't updatable by abode_app (a user
-- shouldn't be able to set their own quota counters), but creating or deleting
-- an item adjusts them in the same transaction. This function does exactly
-- that adjustment and nothing else. Called from a user's request (as
-- abode_app) it only ever touches the viewer's own row, one item at a time
-- (item_delta of -1, 0 or 1, and at most 1 GiB per call); called on the owner
-- connection (background jobs), any user's, by any amount. The counters are
-- display-only and the daily reconcile rewrites them, so the bound is about
-- intent rather than a quota.

CREATE OR REPLACE FUNCTION abode.adjust_user_counters(
  target uuid,
  item_delta integer,
  bytes_delta bigint
) RETURNS void
LANGUAGE plpgsql
-- A NULL argument is a no-op, rather than GREATEST resetting a counter to 0
STRICT
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- current_setting('role') still reports the caller's role inside a
  -- SECURITY DEFINER function
  IF current_setting('role') = 'abode_app' THEN
    IF target IS DISTINCT FROM abode.viewer_id() THEN
      RAISE EXCEPTION 'abode_app can only adjust its own viewer''s counters'
        USING ERRCODE = '42501';
    END IF;
    IF item_delta NOT IN (-1, 0, 1) OR abs(bytes_delta) > 1073741824 THEN
      RAISE EXCEPTION 'abode_app adjusts counters one item at a time'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Clamped at zero: counters can drift (the daily reconcile corrects them),
  -- and a delete must never fail because a count would go negative
  -- (users_item_count_non_negative)
  UPDATE public.users
  SET item_count = GREATEST(item_count + item_delta, 0),
      storage_used_bytes = GREATEST(storage_used_bytes + bytes_delta, 0),
      updated_at = now()
  WHERE id = target;
END $$;

REVOKE ALL ON FUNCTION abode.adjust_user_counters(uuid, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION abode.adjust_user_counters(uuid, integer, bigint) TO abode_app;
