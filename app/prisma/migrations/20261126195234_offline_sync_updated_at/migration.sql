-- CreateIndex
CREATE INDEX "items_user_id_updated_at_id_idx" ON "items"("user_id", "updated_at", "id");

-- items.updated_at says when anything the app shows for an item last changed,
-- so the offline library can sync only what changed since its last round
-- (GET /api/v1/items/changes). Before this it was Prisma's @updatedAt, set only
-- when the items row itself was written through Prisma, so these were missed:
--   - writes to the detail tables (image, article, book, ...), locations and
--     room membership, e.g. a manual location or an enrichment backfill;
--   - raw SQL updates of items;
--   - a room's name, emoji, slug or type, and its owner's username, which every
--     member item shows (item.rooms).
--
-- Now the database sets it, from its own clock:
--   - items: on every insert and update, overriding the value Prisma sends;
--   - each child table above: an AFTER trigger touches the affected item (old
--     and new item_id), which then fires the items trigger;
--   - rooms and users: when a field the items show changes, every member item.
-- now() is the transaction's start, not its commit; the changes route rereads a
-- window behind its cursor to cover transactions that commit late.
--
-- The touches set only updated_at, so the search vector trigger (UPDATE OF
-- title, tags, ...) doesn't re-fire. Functions are SECURITY INVOKER with an
-- empty search_path (see 20260725235016_harden_function_search_path): under the
-- restricted abode_app role they touch only the viewer's own items, which are
-- the items they're called for.

CREATE FUNCTION public.items_set_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER items_set_updated_at_trigger
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.items_set_updated_at();

CREATE FUNCTION public.touch_item_from_child() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- On an item's own delete the cascade finds no row left to touch
  UPDATE public.items item
  SET updated_at = now()
  WHERE item.id IN (
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.item_id END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.item_id END
  );
  RETURN NULL;
END
$$;

CREATE TRIGGER item_locations_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_locations
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER item_image_details_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_image_details
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER item_article_details_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_article_details
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER item_twitter_details_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_twitter_details
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER item_instagram_details_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_instagram_details
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER item_video_details_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_video_details
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER item_product_details_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_product_details
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER item_book_details_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_book_details
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER item_note_details_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.item_note_details
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE TRIGGER room_items_touch_item
AFTER INSERT OR UPDATE OR DELETE ON public.room_items
FOR EACH ROW EXECUTE FUNCTION public.touch_item_from_child();

CREATE FUNCTION public.rooms_touch_member_items() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.items item
  SET updated_at = now()
  FROM public.room_items room_item
  WHERE room_item.room_id = NEW.id AND room_item.item_id = item.id;
  RETURN NULL;
END
$$;

CREATE TRIGGER rooms_touch_member_items_trigger
AFTER UPDATE OF name, emoji, slug, type ON public.rooms
FOR EACH ROW
WHEN (
  OLD.name IS DISTINCT FROM NEW.name
  OR OLD.emoji IS DISTINCT FROM NEW.emoji
  OR OLD.slug IS DISTINCT FROM NEW.slug
  OR OLD.type IS DISTINCT FROM NEW.type
)
EXECUTE FUNCTION public.rooms_touch_member_items();

CREATE FUNCTION public.users_touch_room_items() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.items item
  SET updated_at = now()
  FROM public.room_items room_item
  JOIN public.rooms room ON room.id = room_item.room_id
  WHERE room.user_id = NEW.id AND room_item.item_id = item.id;
  RETURN NULL;
END
$$;

CREATE TRIGGER users_touch_room_items_trigger
AFTER UPDATE OF username ON public.users
FOR EACH ROW
WHEN (OLD.username IS DISTINCT FROM NEW.username)
EXECUTE FUNCTION public.users_touch_room_items();
