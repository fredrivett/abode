# Smart Rooms Implementation Notes

## Room Evaluation Trigger

**IMPORTANT:** Whenever an item is created or updated, we must trigger the `evaluate-smart-rooms` background task to ensure the item is correctly added/removed from smart rooms.

### Current trigger points:
- End of `analyze-image` task (after processing completes)
- End of `classify-url` task (after processing completes)
- API PATCH `/api/v1/items/[id]` when `kind` or `sourceType` changes

### Future trigger points (add when implemented):
- Manual tag editing
- Manual location editing
- Any other filter-relevant field updates
- Soft delete (setting `deletedAt`)

### Filter-relevant fields:
- `kind` (type filter)
- `tags` (tag filter)
- `sourceType` (source filter)
- `deletedAt` (soft delete - should exclude from all rooms)
- `createdAt` (date filter)
- `ItemImageDetails.objects` (object filter)
- `ItemImageDetails.colors` (color filter)
- `ItemLocation.*` (location filter)

When adding new item update functionality, check if any of these fields are modified and trigger room evaluation accordingly.
