import "server-only";
import type { AdminNotification } from "@/domain/admin-notifications";
import { parseNotifyEnv } from "@/config/env";

export type EmailOutcome = "sent" | "not_configured" | "failed";

/**
 * Emails the administrator through Resend. It never throws: a failed alert must not break the thing that
 * raised it (a webhook, the daily clean-up). With no key set it only logs what it would have sent.
 */
export async function sendAdminEmail(notification: AdminNotification): Promise<EmailOutcome> {
  let env;
  try {
    env = parseNotifyEnv();
  } catch {
    console.error("[email] notification settings are invalid");
    return "failed";
  }

  if (!env.RESEND_API_KEY || !env.ADMIN_NOTIFY_EMAIL) {
    console.warn("[email] not configured; would have sent:", notification.subject);
    return "not_configured";
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.NOTIFY_FROM_EMAIL,
        to: [env.ADMIN_NOTIFY_EMAIL],
        subject: notification.subject,
        text: notification.text,
      }),
    });
    if (!response.ok) {
      console.error("[email] the provider refused the message", { status: response.status });
      return "failed";
    }
    return "sent";
  } catch {
    console.error("[email] could not reach the provider");
    return "failed";
  }
}
