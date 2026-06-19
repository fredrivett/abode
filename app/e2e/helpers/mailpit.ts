/**
 * Helpers for interacting with the Mailpit email testing server
 * used by the E2E Supabase instance.
 *
 * Mailpit API runs on CONDUCTOR_PORT + 3 (e.g., 3303).
 * Supabase auth emails (confirmation links) are delivered here.
 */

function getBaseUrl(): string {
  const basePort = Number.parseInt(process.env.CONDUCTOR_PORT || "3300", 10);
  return `http://localhost:${basePort + 3}`;
}

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

/**
 * List messages for a given email address via Mailpit search API.
 */
async function listMessages(email: string): Promise<MailpitMessage[]> {
  const query = encodeURIComponent(`to:${email}`);
  const res = await fetch(`${getBaseUrl()}/api/v1/search?query=${query}`);
  if (!res.ok) {
    // Fall back to listing all messages and filtering client-side
    const allRes = await fetch(`${getBaseUrl()}/api/v1/messages`);
    if (!allRes.ok) return [];
    const allData = await allRes.json();
    return (allData.messages || []).filter((msg: MailpitMessage) =>
      msg.To?.some((to) => to.Address?.toLowerCase() === email.toLowerCase()),
    );
  }
  const data = await res.json();
  return data.messages || [];
}

/**
 * Get the full body of a message.
 */
async function getMessageBody(
  messageId: string,
): Promise<{ html: string; text: string }> {
  const res = await fetch(`${getBaseUrl()}/api/v1/message/${messageId}`);
  if (!res.ok) {
    throw new Error(`Failed to get message ${messageId}: ${res.status}`);
  }
  const msg = await res.json();
  return { html: msg.HTML || "", text: msg.Text || "" };
}

/**
 * Purge messages for an email address.
 */
export async function clearMailbox(email: string): Promise<void> {
  const messages = await listMessages(email);
  if (messages.length > 0) {
    await fetch(`${getBaseUrl()}/api/v1/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDs: messages.map((m) => m.ID) }),
    });
  }
}

/**
 * Wait for and extract the confirmation link from Supabase's auth email.
 *
 * The confirmation email template includes a link like:
 *   http://127.0.0.1:{port}/auth/confirm?token_hash=...&type=signup
 *
 * Since the Supabase site_url port may differ from the Playwright dev server port,
 * this returns just the path + query string (e.g., "/auth/confirm?token_hash=...&type=signup")
 * so callers can use page.goto(path) which applies Playwright's baseURL.
 *
 * Polls every 500ms for up to 15 seconds.
 */
export async function getConfirmationPath(email: string): Promise<string> {
  const maxAttempts = 30;
  const delayMs = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Mailpit returns newest-first. Scan every message rather than a single
    // one so an unrelated email (or the wrong index) can't shadow the
    // confirmation, and keep polling if none has a link yet rather than
    // throwing on the first message that lacks one.
    const messages = await listMessages(email);
    for (const message of messages) {
      const body = await getMessageBody(message.ID);

      // Extract confirmation link from HTML body
      const linkMatch = body.html.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/);
      if (linkMatch) {
        const url = new URL(linkMatch[1]);
        return `${url.pathname}${url.search}`;
      }

      // Try text body as fallback
      const textMatch = body.text.match(
        /(https?:\/\/[^\s]*\/auth\/confirm\?[^\s]*)/,
      );
      if (textMatch) {
        const url = new URL(textMatch[1]);
        return `${url.pathname}${url.search}`;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `No confirmation email received for ${email} after ${
      (maxAttempts * delayMs) / 1000
    }s`,
  );
}
