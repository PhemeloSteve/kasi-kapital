import type { RateLimiter } from "@/application/ports";
import { createClient } from "./server";

/**
 * Counts an attempt in the database, where the limits are kept. If the check itself cannot be made, the
 * answer is "no": a security control that stops working should not quietly let everything through.
 */
export function createRateLimiter(): RateLimiter {
  return {
    async allow(action) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("rate_limit", { p_action: action });
      if (error) {
        console.error("[rate-limit] check failed", { code: error.code });
        return false;
      }
      return data === true;
    },
  };
}
