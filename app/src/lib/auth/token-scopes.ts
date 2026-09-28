/**
 * What a personal access token may do. Scopes are independent — `write` does
 * NOT imply `read` — so a save-only token (e.g. an iOS Shortcut) can't read the
 * library if it leaks. A token holds any non-empty subset.
 *
 * Client-safe (no server imports): the settings UI renders these as checkboxes.
 */
export const TOKEN_SCOPES = ["read", "write"] as const;

export type TokenScope = (typeof TOKEN_SCOPES)[number];

export function isTokenScope(value: unknown): value is TokenScope {
  return (
    typeof value === "string" && TOKEN_SCOPES.includes(value as TokenScope)
  );
}

/** User-facing names, shown on the create form and as badges in the token list */
export const TOKEN_SCOPE_LABELS: Record<TokenScope, string> = {
  read: "Read",
  write: "Save",
};

export const TOKEN_SCOPE_DESCRIPTIONS: Record<TokenScope, string> = {
  read: "Read your library",
  write: "Save new items",
};

/** Whether a token's stored scopes grant `required`. Unknown stored values grant nothing. */
export function hasTokenScope(
  scopes: readonly string[],
  required: TokenScope,
): boolean {
  return scopes.includes(required);
}
