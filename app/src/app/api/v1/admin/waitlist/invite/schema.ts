import { z } from "zod";

export const inviteSchema = z.object({
  waitlistEntryId: z.string().min(1),
});
