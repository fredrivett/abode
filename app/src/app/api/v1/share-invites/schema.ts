import { z } from "zod";

export const shareInviteSchema = z.object({
  itemId: z.string().uuid(),
  email: z.string().min(1),
});
