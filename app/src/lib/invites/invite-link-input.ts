// Client-safe: no db imports, so the tokenless /join form can use it

// Invite tokens are nanoids: URL-safe alphabet only
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

// Only used to resolve scheme-less pastes ("abode.fyi/join?token=…"); never fetched
const PARSE_BASE = "https://invite.invalid";

export type InviteLinkParts = { token: string; save: string | null };

function toUrl(value: string): URL | null {
  try {
    return new URL(value, PARSE_BASE);
  } catch {
    return null;
  }
}

/**
 * Pull the invite token (and any shared item to save) out of what someone
 * pasted on /join: the full invite link, the link without its scheme, or a
 * bare token. Returns null for anything that isn't one of those.
 */
export function parseInviteLinkInput(input: string): InviteLinkParts | null {
  const value = input.trim();
  if (!value) return null;
  if (TOKEN_PATTERN.test(value)) return { token: value, save: null };

  const url = toUrl(value);
  const token = url?.searchParams.get("token")?.trim();
  if (!url || !token || !TOKEN_PATTERN.test(token)) return null;

  const save = url.searchParams.get("save")?.trim() || null;
  return { token, save };
}

export function getJoinPath({ token, save }: InviteLinkParts): string {
  const params = new URLSearchParams({ token });
  if (save) params.set("save", save);
  return `/join?${params}`;
}
