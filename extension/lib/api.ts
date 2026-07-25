import { getAccessToken } from "./auth";
import { CONFIG } from "./config";

/** Thrown when there's no signed-in session — the caller should prompt login. */
export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedInError";
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new NotSignedInError();

  const res = await fetch(`${CONFIG.abodeBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) throw new NotSignedInError();
  if (!res.ok) {
    const message = await res
      .json()
      .then((data: { message?: string }) => data?.message)
      .catch(() => null);
    throw new Error(message ?? `Save failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

interface SavedItem {
  id: string;
}

/** Save a link/image/page URL — routes through abode's from-url pipeline. */
export function saveUrl(url: string): Promise<SavedItem> {
  return post<SavedItem>("/api/v1/items/from-url", { url, source: "extension" });
}

/** Save selected text as a note. */
export function saveNote(content: string, title?: string): Promise<SavedItem> {
  return post<SavedItem>("/api/v1/items/notes", { content, title });
}
