import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { parsePublicEnv, parseServiceEnv } from "@/config/env";

/**
 * A client with the project's service role, which bypasses row level security. It exists only so the
 * server can do what a payment provider's webhook would do (confirm a payment, record a payout).
 * The `server-only` import makes the build fail if this file is ever pulled into browser code.
 */
export function createServiceClient() {
  const publicEnv = parsePublicEnv();
  const serviceEnv = parseServiceEnv();
  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
