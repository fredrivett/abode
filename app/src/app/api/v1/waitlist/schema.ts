import { z } from "zod";

export const waitlistSchema = z.object({
  email: z.string().min(1),
  referralSource: z.string().optional(),
  // The browser's PostHog distinct id, so the server-side join event joins the visit
  distinctId: z.string().min(1).max(200).optional(),
  sourcePath: z.string().startsWith("/").max(500).optional(),
});
