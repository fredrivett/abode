/**
 * Returns the base URL for the app based on the current environment.
 * - Local dev: http://localhost:3300
 * - Vercel preview: https://{VERCEL_URL}
 * - Production: https://www.abode.fyi
 */
export function getAppBaseUrl(): string {
	if (process.env.NODE_ENV !== "production") return "http://localhost:3300";

	const isPreview =
		process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL;

	if (isPreview) return `https://${process.env.VERCEL_URL}`;

	return "https://www.abode.fyi";
}
