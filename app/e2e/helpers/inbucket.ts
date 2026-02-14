/**
 * Helpers for interacting with the email testing server
 * used by the E2E Supabase instance.
 *
 * Newer Supabase CLI versions use Mailpit; older versions use Inbucket.
 * This helper auto-detects which API is available and adapts accordingly.
 *
 * Email API runs on CONDUCTOR_PORT + 3 (e.g., 3303).
 * Supabase auth emails (confirmation links) are delivered here.
 */

function getBaseUrl(): string {
	const basePort = Number.parseInt(
		process.env.CONDUCTOR_PORT || "3300",
		10,
	);
	return `http://localhost:${basePort + 3}`;
}

// Normalized message shape used by both APIs
interface EmailMessage {
	id: string;
	subject: string;
}

interface EmailBody {
	html: string;
	text: string;
}

// Auto-detect which email API is running (cached after first call)
let detectedApi: "mailpit" | "inbucket" | null = null;

async function detectApi(): Promise<"mailpit" | "inbucket"> {
	if (detectedApi) return detectedApi;

	// Mailpit has /api/v1/messages; Inbucket does not
	const res = await fetch(`${getBaseUrl()}/api/v1/messages?limit=1`);
	detectedApi = res.ok ? "mailpit" : "inbucket";
	return detectedApi;
}

/**
 * List messages for a given email address.
 */
async function listMessages(email: string): Promise<EmailMessage[]> {
	const api = await detectApi();

	if (api === "mailpit") {
		// Mailpit: search by recipient
		const query = encodeURIComponent(`to:${email}`);
		const res = await fetch(
			`${getBaseUrl()}/api/v1/search?query=${query}`,
		);
		if (!res.ok) {
			// Fall back to listing all messages and filtering
			const allRes = await fetch(`${getBaseUrl()}/api/v1/messages`);
			if (!allRes.ok) return [];
			const allData = await allRes.json();
			return (allData.messages || [])
				.filter((msg: { To: { Address: string }[] }) =>
					msg.To?.some(
						(to: { Address: string }) =>
							to.Address?.toLowerCase() === email.toLowerCase(),
					),
				)
				.map((msg: { ID: string; Subject: string }) => ({
					id: msg.ID,
					subject: msg.Subject,
				}));
		}
		const data = await res.json();
		return (data.messages || []).map(
			(msg: { ID: string; Subject: string }) => ({
				id: msg.ID,
				subject: msg.Subject,
			}),
		);
	}

	// Inbucket: mailbox-based lookup
	const mailbox = email.split("@")[0];
	const res = await fetch(`${getBaseUrl()}/api/v1/mailbox/${mailbox}`);
	if (res.status === 404) return [];
	if (!res.ok) {
		throw new Error(`Failed to list messages for ${email}: ${res.status}`);
	}
	const messages = await res.json();
	return messages.map((msg: { id: string; subject: string }) => ({
		id: msg.id,
		subject: msg.subject,
	}));
}

/**
 * Get the full body of a message.
 */
async function getMessageBody(
	email: string,
	messageId: string,
): Promise<EmailBody> {
	const api = await detectApi();

	if (api === "mailpit") {
		// Mailpit: /api/v1/message/{ID}
		const res = await fetch(`${getBaseUrl()}/api/v1/message/${messageId}`);
		if (!res.ok) {
			throw new Error(
				`Failed to get message ${messageId}: ${res.status}`,
			);
		}
		const msg = await res.json();
		return { html: msg.HTML || "", text: msg.Text || "" };
	}

	// Inbucket: /api/v1/mailbox/{localPart}/{id}
	const mailbox = email.split("@")[0];
	const res = await fetch(
		`${getBaseUrl()}/api/v1/mailbox/${mailbox}/${messageId}`,
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
 * Purge messages for an email address.
 */
export async function clearMailbox(email: string): Promise<void> {
	const api = await detectApi();

	if (api === "mailpit") {
		// Mailpit: find messages for this email and delete them by ID
		const messages = await listMessages(email);
		if (messages.length > 0) {
			await fetch(`${getBaseUrl()}/api/v1/messages`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					IDs: messages.map((m) => m.id),
				}),
			});
		}
		return;
	}

	// Inbucket: delete entire mailbox
	const mailbox = email.split("@")[0];
	await fetch(`${getBaseUrl()}/api/v1/mailbox/${mailbox}`, {
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
