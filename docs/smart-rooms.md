# Rooms

## URL Structure

All rooms use the same URL format: `/@{username}/{slug}`

- **Private rooms**: Only accessible by the owner. Returns 404 for everyone else.
- **Public rooms**: Accessible by anyone. Owner sees edit controls, visitors see read-only view.

Examples:
- `/@fredrivett/architecture-inspiration` - Fred's architecture room
- `/@fredrivett/travel-photos` - Fred's travel photos room

The slug is auto-generated from the room name using `nameToSlug()` (see `app/src/lib/slug.ts`). Slugs are unique per user - if a slug already exists, a number suffix is appended (e.g., `my-room-2`).

## Room Types

- **Smart rooms**: Automatically populate based on filter criteria. Items matching filters are added/removed as they change.
- **Manual rooms**: User manually adds/removes items.

## Visibility

Room visibility is a setting, not a URL difference:
- `private` (default): Only owner can view
- `public`: Anyone with the link can view

Owner always sees full edit controls (rename, delete, change filters). Visitors to public rooms see read-only content.

---

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
