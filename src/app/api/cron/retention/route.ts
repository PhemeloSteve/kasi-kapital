import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { purgeExpiredDocuments } from "@/application/retention";
import { extractWebhookSecret, isValidWebhookSecret } from "@/app/_lib/webhook-auth";
import { describeRetentionAlert } from "@/domain/admin-notifications";
import { sendAdminEmail } from "@/infrastructure/email/admin-email";
import { createRetentionStore } from "@/infrastructure/supabase/retention-store";

export const dynamic = "force-dynamic";

/**
 * Run once a day by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>", and
 * this refuses everyone else, including when no secret has been set up: it fails closed.
 */
export async function GET(request: NextRequest) {
  const configured = process.env.CRON_SECRET;
  const secret = configured && configured.length >= 16 ? configured : undefined;
  if (!isValidWebhookSecret(extractWebhookSecret(request.headers), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const summary = await purgeExpiredDocuments({ retention: createRetentionStore() });
    console.warn("[retention] purge finished", summary);
    const alert = describeRetentionAlert({ ok: true, ...summary });
    if (alert) await sendAdminEmail(alert);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    // The message names only the step and an error code, never a document.
    console.error("[retention] purge failed", { message: (error as Error).message });
    const alert = describeRetentionAlert({ ok: false });
    if (alert) await sendAdminEmail(alert);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
