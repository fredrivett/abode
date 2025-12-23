-- AlterTable
ALTER TABLE "items" ADD COLUMN     "notes" TEXT;

-- Update the search vector function to include notes (weight D for lowest priority)
CREATE OR REPLACE FUNCTION items_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to include notes column
DROP TRIGGER IF EXISTS items_search_vector_trigger ON "items";
CREATE TRIGGER items_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, tags, description, notes ON "items"
FOR EACH ROW EXECUTE FUNCTION items_search_vector_update();

-- Populate existing rows (in case any have notes somehow, or to ensure consistency)
UPDATE "items" SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(notes, '')), 'D');
