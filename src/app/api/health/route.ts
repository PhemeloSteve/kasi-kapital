import { NextResponse } from "next/server";
import { createServiceClient } from "@/infrastructure/supabase/service";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * For an uptime monitor: answers 200 when the site is up and can reach its database, 503 when not.
 * It says nothing else, so it is safe to leave public.
 */
export async function GET() {
  try {
    const { error } = await createServiceClient().from("platform_settings").select("key").limit(1);
    if (error) throw new Error("database");
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    console.error("[health] check failed");
    return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
}
