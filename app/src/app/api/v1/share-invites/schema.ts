import { z } from "zod";
import { visitorIdField } from "@/lib/analytics/visitor-id-schema";

export const shareInviteSchema = z.object({
  itemId: z.string().uuid(),
  email: z.string().min(1),
  distinctId: visitorIdField,
});
