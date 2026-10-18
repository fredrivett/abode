import { z } from "zod";

/**
 * Request field for `posthogVisitorId()`. Analytics-only, so a bad value is
 * dropped rather than failing the request it rides on.
 */
export const visitorIdField = z
  .string()
  .min(1)
  .max(200)
  .optional()
  .catch(undefined);
