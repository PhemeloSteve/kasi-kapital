import "server-only";
import { cookies } from "next/headers";
import { err, ok } from "@/domain/result";
import type { AccountEraser } from "@/application/ports";
import { KEEP_COOKIE } from "./cookie-policy";
import { createClient } from "./server";
import { createServiceClient } from "./service";

/** Supabase implementation of the AccountEraser port. */
export function createAccountEraser(): AccountEraser {
  return {
    async moneyInPlay() {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("my_money_in_play");
      if (error) {
        console.error("[account] money check failed", { code: error.code });
        return true; // when in doubt, do not offer the deletion
      }
      return data === true;
    },

    async erase(userId) {
      const service = createServiceClient();
      const { error } = await service.rpc("erase_account", { p_user: userId });
      if (error) {
        console.error("[account] erase failed", { code: error.code });
        if (error.code === "55006") return err("money_held");
        if (error.code === "42501") return err("not_allowed");
        return err("failed");
      }

      // From here the account is already erased and the app refuses it (see getCurrentUser), so a
      // problem below is logged rather than shown: the person must not be told "failed" for a
      // deletion that happened.
      try {
        const supabase = await createClient();
        await supabase.auth.signOut({ scope: "global" });
        (await cookies()).delete(KEEP_COOKIE);

        const { error: authError } = await service.auth.admin.updateUserById(userId, {
          email: `deleted-${userId}@deleted.invalid`,
          email_confirm: true,
          user_metadata: {},
          ban_duration: "876000h",
        });
        if (authError) {
          console.error("[account] could not clear the sign-in details", {
            status: authError.status,
          });
        }
      } catch {
        console.error("[account] clean-up after erasing failed");
      }
      return ok(true as const);
    },
  };
}
