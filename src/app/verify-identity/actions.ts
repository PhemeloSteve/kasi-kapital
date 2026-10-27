"use server";

import { redirect } from "next/navigation";
import { verifyIdentityDemo } from "@/application/funding";
import { requireUser } from "@/app/_lib/guard";
import { isDemoKycEnabled } from "@/config/env";
import { createPaymentServer } from "@/infrastructure/supabase/payment-server";

export async function verifyIdentityAction(): Promise<void> {
  const user = await requireUser(["investor", "donor"]);
  const result = await verifyIdentityDemo(
    { server: createPaymentServer(), demoEnabled: isDemoKycEnabled() },
    user.userId,
  );
  redirect(
    result.ok ? "/verify-identity?notice=verified" : `/verify-identity?error=${result.error}`,
  );
}
