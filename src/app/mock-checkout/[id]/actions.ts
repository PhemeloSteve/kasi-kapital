"use server";

import { notFound, redirect } from "next/navigation";
import { confirmDemoPayment } from "@/application/funding";
import { requireUser } from "@/app/_lib/guard";
import { getPaymentGateway, paymentsReady } from "@/infrastructure/providers";
import { createPaymentServer } from "@/infrastructure/supabase/payment-server";
import { createContributionStore } from "@/infrastructure/supabase/funding-store";

export async function payDemoCheckoutAction(formData: FormData): Promise<void> {
  await requireUser(["investor", "donor"]);
  // The demo checkout only exists while the demo payment provider is switched on.
  if (!paymentsReady()) notFound();

  const result = await confirmDemoPayment(
    {
      contributions: createContributionStore(),
      server: createPaymentServer(),
      gateway: getPaymentGateway(),
    },
    formData.get("contributionId"),
  );
  if (!result.ok) redirect("/contributions?error=failed");
  const { outcome } = result.value;
  redirect(
    outcome === "held"
      ? "/contributions?notice=thanks"
      : outcome === "expired"
        ? "/contributions?error=expired"
        : "/contributions?error=closed",
  );
}
