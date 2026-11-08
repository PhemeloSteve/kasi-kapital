import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { describeAdminNotification, type WebhookEvent } from "@/domain/admin-notifications";
import { parseNotifyEnv } from "@/config/env";
import { extractWebhookSecret, isValidWebhookSecret } from "@/app/_lib/webhook-auth";

/**
 * Receives a Supabase Database Webhook and emails the administrator when a business is submitted for
 * verification or milestone proof arrives. Set it up as described in docs/admin-improvements.
 */
export async function POST(request: NextRequest) {
  let env;
  try {
    env = parseNotifyEnv();
  } catch {
    console.error("[webhook] notification settings are invalid");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Fails closed: with no WEBHOOK_SECRET configured, every call is refused.
  if (!isValidWebhookSecret(extractWebhookSecret(request.headers), env.WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const notification = describeAdminNotification(body as WebhookEvent);
  if (!notification) return NextResponse.json({ ok: true, sent: false });

  if (!env.RESEND_API_KEY || !env.ADMIN_NOTIFY_EMAIL) {
    // Not wired to an email provider yet: say what would have been sent.
    console.warn("[webhook] email not configured; would have sent:", notification.subject);
    return NextResponse.json({ ok: true, sent: false });
  }

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
    console.error("[webhook] email provider refused the message", { status: response.status });
    return NextResponse.json({ ok: false }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent: true });
}
