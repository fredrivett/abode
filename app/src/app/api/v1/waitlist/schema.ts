import { z } from "zod";
import { visitorIdField } from "@/lib/analytics/visitor-id-schema";

export const waitlistSchema = z.object({
  email: z.string().min(1),
  referralSource: z.string().optional(),
  // Analytics-only: dropped when malformed instead of failing the join
  distinctId: visitorIdField,
  sourcePath: z.string().startsWith("/").max(500).optional().catch(undefined),
});
