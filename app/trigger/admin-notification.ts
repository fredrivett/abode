import { logger, task } from "@trigger.dev/sdk";
import { getAllAdminEmails } from "../src/lib/admin/auth";
import { sendEmail } from "../src/lib/email";
import {
  type AdminNotificationData,
  getAdminNotificationEmail,
} from "../src/lib/email/templates";

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

    const adminEmails = await getAllAdminEmails();

    if (adminEmails.length === 0) {
      logger.warn("No admin emails found, skipping notification");
      return { success: true, emailsSent: 0 };
    }

    const { subject, text, html } = getAdminNotificationEmail(payload);

    const results = await Promise.allSettled(
      adminEmails.map((email) =>
        sendEmail({
          to: email,
          subject,
          text,
          html,
        }),
      ),
    );

    const successfulEmails = results.filter(
      (result) => result.status === "fulfilled" && result.value.success,
    ).length;

    const failedEmails = results.filter(
      (result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value.success),
    );

    if (failedEmails.length > 0) {
      logger.error("Some admin notifications failed to send", {
        type: payload.type,
        totalAdmins: adminEmails.length,
        successful: successfulEmails,
        failed: failedEmails.length,
      });
    }

    logger.log("Admin notifications sent", {
      type: payload.type,
      totalAdmins: adminEmails.length,
      successful: successfulEmails,
      failed: failedEmails.length,
    });

    return {
      success: successfulEmails > 0,
      emailsSent: successfulEmails,
      totalAdmins: adminEmails.length,
    };
  },
});
