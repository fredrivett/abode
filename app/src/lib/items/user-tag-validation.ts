// Shared user-tag validation rules, imported by both the server schema
// (`items/[id]/schema.ts`) and the client tag input (`item-card.tsx`) so the
// two can't drift — a mismatch means the client optimistically adds a tag the
// server then 400s, reverting it with a confusing "save failed".

export const MAX_USER_TAGS = 100;
export const MAX_USER_TAG_LENGTH = 50;

// Letters, numbers, spaces, hyphens, underscores. A literal space (not \s) so
// tabs/newlines/other control whitespace are rejected; callers should also
// reject whitespace-only input (the client trims first; the schema refines).
export const USER_TAG_REGEX = /^[a-zA-Z0-9 _-]+$/;
