-- Follow-up to 20261114152727_search_note_bodies_and_user_tags.
--
-- 1. Index at most the first 100,000 characters of a note body. A tsvector is
--    capped at 1 MB and to_tsvector errors past it, which would fail the note
--    save itself, since the vector is built by a trigger in the same write.
--    Dense text (many short unique tokens) costs about 2 bytes of tsvector per
--    character, so this cap stays well under the limit. Quoted-phrase search
--    still scans the whole body.
-- 2. Also rebuild the vectors when a note detail row's item_id changes, for
--    both the old and the new item. The app never moves a note body between
--    items (item_id is the primary key), but the trigger shouldn't rely on that.

CREATE OR REPLACE FUNCTION public.item_search_vector(item public.items) RETURNS tsvector
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

CREATE OR REPLACE FUNCTION public.item_note_details_search_vector_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- AFTER trigger: item_search_vector already sees the written (or removed) body
  UPDATE public.items item
  SET search_vector = public.item_search_vector(item)
  WHERE item.id IN (
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.item_id END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.item_id END
  );
  RETURN NULL;
END
$$;

DROP TRIGGER item_note_details_search_vector_trigger ON public.item_note_details;
CREATE TRIGGER item_note_details_search_vector_trigger
AFTER INSERT OR UPDATE OF content, item_id OR DELETE ON public.item_note_details
FOR EACH ROW EXECUTE FUNCTION public.item_note_details_search_vector_update();
