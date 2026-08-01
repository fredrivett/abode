import { z } from "zod";

export const waitlistSchema = z.object({
  email: z.string().min(1),
  referralSource: z.string().optional(),
});
