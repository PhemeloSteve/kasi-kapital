"use server";

import { redirect } from "next/navigation";
import { startContribution } from "@/application/funding";
import { requireUser } from "@/app/_lib/guard";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { RATE_LIMIT_MESSAGE } from "@/app/_lib/rate-limit";
import { getPaymentGateway } from "@/infrastructure/providers";
import { createRateLimiter } from "@/infrastructure/supabase/rate-limiter";
import { createContributionStore } from "@/infrastructure/supabase/funding-store";
import { describeStartError } from "./messages";

export type ContributeState = {
  status: "idle" | "error";
  message?: string;
  needsVerification?: boolean;
};

export async function startContributionAction(
  _prev: ContributeState,
  formData: FormData,
): Promise<ContributeState> {
  // Server actions are public endpoints, so each one re-checks who is calling. The database checks again.
  await requireUser(["investor", "donor"]);
  if (!(await createRateLimiter().allow("contribute")))
    return { status: "error", message: RATE_LIMIT_MESSAGE };

  const result = await startContribution(
    { contributions: createContributionStore(), payments: getPaymentGateway() },
    { goalId: formData.get("goalId"), amount: formData.get("amount") },
  );
  if (!result.ok) {
    const { message, needsVerification } = describeStartError(result.error);
    return { status: "error", message, needsVerification };
  }

  // The demo checkout is a page on this site; a real provider would hand back an https address.
  const url = result.value.checkoutUrl;
  redirect(url.startsWith("https://") ? url : safeRedirectPath(url, "/contributions"));
}
