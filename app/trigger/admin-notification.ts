import { logger, task } from "@trigger.dev/sdk";
import { sendEmail } from "../src/lib/email";
import {
  type AdminNotificationData,
  getAdminNotificationEmail,
} from "../src/lib/email/templates";

const ADMIN_EMAIL = "fred@abode.fyi";

export const adminNotificationTask = task({
  id: "admin-notification",
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: AdminNotificationData) => {
    logger.log("Sending admin notification", {
      type: payload.type,
    });

    const { subject, text, html } = getAdminNotificationEmail(payload);

    const result = await sendEmail({
      to: ADMIN_EMAIL,
      subject,
      text,
      html,
    });

    if (!result.success) {
      logger.error("Failed to send admin notification", {
        type: payload.type,
        error: result.error,
      });
      throw new Error(`Failed to send admin notification: ${result.error}`);
    }

    logger.log("Admin notification sent", {
      type: payload.type,
      emailId: result.id,
    });

    return { success: true, emailId: result.id };
  },
});
