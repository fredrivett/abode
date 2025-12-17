-- Add tsvector column for full-text search (maintained via trigger)
-- Weights: A (title), B (tags), C (description)

-- Add the search_vector column
ALTER TABLE "items" ADD COLUMN "search_vector" tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION items_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create trigger to update search vector on insert/update
CREATE TRIGGER items_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, tags, description ON "items"
FOR EACH ROW EXECUTE FUNCTION items_search_vector_update();

-- Populate existing rows
UPDATE "items" SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C');

-- Create GIN index for full-text search on items.search_vector
CREATE INDEX "items_search_vector_idx" ON "items" USING GIN ("search_vector");

-- Create GIN index for array containment queries on item_image_details.objects
CREATE INDEX "item_image_details_objects_idx" ON "item_image_details" USING GIN ("objects");

-- Create functional indexes on item_locations for case-insensitive location search
CREATE INDEX "item_locations_neighborhood_lower_idx" ON "item_locations" (lower("neighborhood"));
CREATE INDEX "item_locations_city_lower_idx" ON "item_locations" (lower("city"));
CREATE INDEX "item_locations_region_lower_idx" ON "item_locations" (lower("region"));
CREATE INDEX "item_locations_country_lower_idx" ON "item_locations" (lower("country"));
