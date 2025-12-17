-- Copy existing image data from items to item_image_details
-- Only for items where kind = 'image' and they have some data to migrate
INSERT INTO item_image_details (item_id, objects, colors, ocr_text, vision_data, created_at, updated_at)
SELECT id, objects, colors, ocr_text, vision_data, created_at, updated_at
FROM items
WHERE kind = 'image'
  AND (
    objects != ARRAY[]::TEXT[]
    OR colors IS NOT NULL
    OR ocr_text IS NOT NULL
    OR vision_data IS NOT NULL
  )
ON CONFLICT (item_id) DO NOTHING;
