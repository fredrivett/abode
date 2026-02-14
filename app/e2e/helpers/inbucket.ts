/**
 * Helpers for interacting with the Inbucket email server
 * used by the E2E Supabase instance.
 *
 * Inbucket API runs on CONDUCTOR_PORT + 3 (e.g., 3303).
 * Supabase auth emails (confirmation links) are delivered here.
 */

function getInbucketUrl(): string {
	const basePort = Number.parseInt(
		process.env.CONDUCTOR_PORT || "3300",
		10,
	);
	return `http://localhost:${basePort + 3}`;
}

interface InbucketMessage {
	id: string;
	from: string;
	to: string[];
	subject: string;
	date: string;
}

interface InbucketMessageBody {
	html: string;
	text: string;
}

/**
 * List messages in a mailbox. Mailbox name is the local part of the email (before @).
 */
async function listMessages(email: string): Promise<InbucketMessage[]> {
	const mailbox = email.split("@")[0];
	const res = await fetch(`${getInbucketUrl()}/api/v1/mailbox/${mailbox}`);
	if (res.status === 404) {
		return [];
	}
	if (!res.ok) {
		throw new Error(`Failed to list messages for ${email}: ${res.status}`);
	}
	return res.json();
}

/**
 * Get the full body of a message.
 */
async function getMessageBody(
	email: string,
	messageId: string,
): Promise<InbucketMessageBody> {
	const mailbox = email.split("@")[0];
	const res = await fetch(
		`${getInbucketUrl()}/api/v1/mailbox/${mailbox}/${messageId}`,
	);
	if (!res.ok) {
		throw new Error(
			`Failed to get message ${messageId} for ${email}: ${res.status}`,
		);
	}
	const msg = await res.json();
	return { html: msg.body?.html || "", text: msg.body?.text || "" };
}

/**
 * Purge all messages in a mailbox.
 */
export async function clearMailbox(email: string): Promise<void> {
	const mailbox = email.split("@")[0];
	await fetch(`${getInbucketUrl()}/api/v1/mailbox/${mailbox}`, {
		method: "DELETE",
	});
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
export async function getConfirmationPath(
	email: string,
): Promise<string> {
	const maxAttempts = 30;
	const delayMs = 500;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const messages = await listMessages(email);
		if (messages.length > 0) {
			// Get the latest message
			const latest = messages[messages.length - 1];
			const body = await getMessageBody(email, latest.id);

			// Extract confirmation link from HTML body
			const linkMatch = body.html.match(
				/href="([^"]*\/auth\/confirm\?[^"]*)"/,
			);
			if (linkMatch) {
				const fullUrl = linkMatch[1];
				const url = new URL(fullUrl);
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

			throw new Error(
				`Confirmation link not found in email for ${email}`,
			);
		}

		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	throw new Error(
		`No email received for ${email} after ${(maxAttempts * delayMs) / 1000}s`,
	);
}
