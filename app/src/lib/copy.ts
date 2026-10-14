export type CopyFailureReason =
  /** Nothing to copy */
  | "empty"
  /** The site's clipboard permission is set to block */
  | "permission-denied"
  /** The page wasn't focused when the write ran (e.g. focus moved away) */
  | "not-focused"
  /** Plain-http page, where browsers hide the Clipboard API */
  | "insecure-context"
  /** Neither the Clipboard API nor the copy command is available */
  | "unsupported"
  /** The browser refused without saying why (e.g. no recent click) */
  | "blocked"
  | "unknown";

export type CopyResult =
  | { ok: true }
  | { ok: false; reason: CopyFailureReason };

const FAILURE_DESCRIPTIONS: Record<CopyFailureReason, string | null> = {
  empty: null,
  "permission-denied":
    "Clipboard access is blocked for this site. Allow it in your browser's site settings, then try again.",
  "not-focused":
    "The page lost focus while copying. Click the page and try again.",
  "insecure-context": "Browsers only allow copying from secure (https) pages.",
  unsupported: "This browser doesn't support copying from web pages.",
  blocked: "Your browser blocked clipboard access. Try again.",
  unknown: null,
};

/** A user-facing explanation for a failed copy, if there's one worth showing */
export function describeCopyFailure(reason: CopyFailureReason): string | null {
  return FAILURE_DESCRIPTIONS[reason];
}

/**
 * Copies text to the clipboard, using the Clipboard API when available
 * and falling back to `document.execCommand("copy")` when it's missing or
 * rejects (e.g. clipboard permission denied).
 *
 * When both fail, the result says why as best the browser lets us tell.
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, reason: "empty" };
  }

  let writeError: unknown = null;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch (error) {
    writeError = error;
  }

  if (copyWithCommand(text)) return { ok: true };
  return { ok: false, reason: await diagnoseFailure(writeError) };
}

function copyWithCommand(text: string): boolean {
  if (typeof document === "undefined") return false;
  if (typeof document.execCommand !== "function") return false;

  // Writes the text from the copy event itself rather than selecting a hidden
  // textarea: inside a dialog the focus trap pulls focus straight back, so the
  // selection is empty and execCommand "succeeds" having copied nothing
  let written = false;
  const handleCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    written = true;
  };

  document.addEventListener("copy", handleCopy, { capture: true });
  try {
    return document.execCommand("copy") && written;
  } catch {
    return false;
  } finally {
    document.removeEventListener("copy", handleCopy, { capture: true });
  }
}

async function diagnoseFailure(
  writeError: unknown,
): Promise<CopyFailureReason> {
  if (typeof window === "undefined") return "unsupported";
  if (!writeError) {
    // No Clipboard API to try: http pages hide it, otherwise it's just absent
    return window.isSecureContext ? "unsupported" : "insecure-context";
  }
  if (!(writeError instanceof DOMException)) return "unknown";
  if (writeError.name !== "NotAllowedError") {
    return writeError.name === "SecurityError" ? "blocked" : "unknown";
  }

  // NotAllowedError covers a denied permission, an unfocused page and a
  // missing click alike, so ask what we can
  if (await isClipboardWriteDenied()) return "permission-denied";
  if (typeof document !== "undefined" && !document.hasFocus()) {
    return "not-focused";
  }
  return "blocked";
}

async function isClipboardWriteDenied(): Promise<boolean> {
  try {
    // Chromium only; Firefox and Safari reject the name, which lands in catch.
    // The DOM lib's PermissionName leaves the clipboard names out
    const status = await navigator.permissions.query({
      name: "clipboard-write" as PermissionName,
    });
    return status.state === "denied";
  } catch {
    return false;
  }
}
