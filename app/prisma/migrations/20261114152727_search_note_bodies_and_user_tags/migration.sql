-- Full-text search also covers a note's body (item_note_details.content) and the
-- user's manual tags (items.user_tags). Before this, a word that appeared only
-- in either was unsearchable.
--
-- The vector is built in one place, item_search_vector, which reads the note
-- body itself. Two triggers keep it current:
--   - items: on insert and on any change to a column it reads (now including
--     user_tags), as before;
--   - item_note_details: when a note body is written, moved or removed, it
--     rewrites the affected items' vectors. That UPDATE sets only
--     search_vector, so it doesn't re-fire the items trigger.
--
-- Only the first 100,000 characters of a note body are indexed. A tsvector is
-- capped at 1 MB and to_tsvector errors past it, which would fail the note save
-- (the trigger runs in the same write) and the backfill below. Dense text (many
-- short unique tokens) costs about 2 bytes of tsvector per character, so the
-- cap stays well under the limit. Quoted-phrase search still scans the whole
-- body.
--
-- Both functions stay SECURITY INVOKER with an empty search_path (see
-- 20260725235016_harden_function_search_path), so under the restricted
-- abode_app role they read and write only the viewer's own rows, which are the
-- rows they're called for.

CREATE FUNCTION public.item_search_vector(item public.items) RETURNS tsvector
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT
    setweight(to_tsvector('english', COALESCE(item.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(item.tags || item.user_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(item.description, '')), 'C') ||
    setweight(to_tsvector('english', left(COALESCE(
      (SELECT note.content FROM public.item_note_details note WHERE note.item_id = item.id),
      ''
    ), 100000)), 'C') ||
    setweight(to_tsvector('english', COALESCE(item.notes, '')), 'D')
$$;

CREATE OR REPLACE FUNCTION public.items_search_vector_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.search_vector := public.item_search_vector(NEW);
  RETURN NEW;
END
$$;

DROP TRIGGER items_search_vector_trigger ON public.items;
CREATE TRIGGER items_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, tags, user_tags, description, notes ON public.items
FOR EACH ROW EXECUTE FUNCTION public.items_search_vector_update();

CREATE FUNCTION public.item_note_details_search_vector_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- AFTER trigger: item_search_vector already sees the written (or removed)
  -- body. The app never moves a body between items (item_id is the primary
  -- key), but if one moves, both the old and the new item are refreshed.
  UPDATE public.items item
  SET search_vector = public.item_search_vector(item)
  WHERE item.id IN (
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.item_id END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.item_id END
  );
  RETURN NULL;
END
$$;

CREATE TRIGGER item_note_details_search_vector_trigger
AFTER INSERT OR UPDATE OF content, item_id OR DELETE ON public.item_note_details
FOR EACH ROW EXECUTE FUNCTION public.item_note_details_search_vector_update();

-- Existing rows: only items whose vector gains something (manual tags or a
-- note body) change, so leave the rest alone rather than rewrite every row.
UPDATE public.items item
SET search_vector = public.item_search_vector(item)
WHERE item.user_tags <> '{}'
  OR EXISTS (
    SELECT 1 FROM public.item_note_details note
    WHERE note.item_id = item.id AND note.content <> ''
  );
