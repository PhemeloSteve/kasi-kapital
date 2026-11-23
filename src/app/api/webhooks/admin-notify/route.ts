import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { describeAdminNotification, type WebhookEvent } from "@/domain/admin-notifications";
import { parseNotifyEnv } from "@/config/env";
import { extractWebhookSecret, isValidWebhookSecret } from "@/app/_lib/webhook-auth";
import { sendAdminEmail } from "@/infrastructure/email/admin-email";

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

  const outcome = await sendAdminEmail(notification);
  if (outcome === "failed") return NextResponse.json({ ok: false }, { status: 502 });
  return NextResponse.json({ ok: true, sent: outcome === "sent" });
}
