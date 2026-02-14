-- Fix drift: Re-add missing GIN index on item_image_details.colors
CREATE INDEX IF NOT EXISTS item_image_details_colors_gin_idx
ON item_image_details USING GIN (colors);
