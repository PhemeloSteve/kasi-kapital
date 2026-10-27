"use server";

import { redirect } from "next/navigation";
import { reviewDocument } from "@/application/documents";
import { processPayouts } from "@/application/funding";
import { reviewMilestone } from "@/application/milestones";
import { requireUser } from "@/app/_lib/guard";
import { getPaymentGateway } from "@/infrastructure/providers";
import { createDocumentStore } from "@/infrastructure/supabase/document-store";
import { createMilestoneStore } from "@/infrastructure/supabase/milestone-store";
import { createPaymentServer } from "@/infrastructure/supabase/payment-server";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function reviewDocumentAction(formData: FormData): Promise<void> {
  // The database checks this too; this stops non-admins before anything else runs.
  await requireUser(["admin"]);

  const result = await reviewDocument(
    { documents: createDocumentStore() },
    {
      documentId: text(formData, "documentId"),
      decision: text(formData, "decision"),
      note: text(formData, "note"),
    },
  );
  redirect(
    result.ok
      ? `/admin?notice=${result.value.approved ? "approved" : "rejected"}`
      : `/admin?error=${result.error}`,
  );
}

export async function reviewMilestoneAction(formData: FormData): Promise<void> {
  await requireUser(["admin"]);

  const result = await reviewMilestone(
    { milestones: createMilestoneStore() },
    {
      milestoneId: text(formData, "milestoneId"),
      decision: text(formData, "decision"),
      note: text(formData, "note"),
    },
  );
  if (!result.ok) redirect(`/admin?error=${result.error}`);
  if (!result.value.approved) redirect("/admin?notice=proof_rejected");

  // Approval may have released money: pay it out straight away.
  if (!result.value.payoutCreated) redirect("/admin?notice=proof_approved_waiting");
  const paid = await processPayouts({
    gateway: getPaymentGateway(),
    server: createPaymentServer(),
  });
  redirect(
    paid.failed > 0
      ? "/admin?notice=proof_approved_payout_failed"
      : "/admin?notice=proof_approved_paid",
  );
}

export async function processPayoutsAction(): Promise<void> {
  await requireUser(["admin"]);
  const result = await processPayouts({
    gateway: getPaymentGateway(),
    server: createPaymentServer(),
  });
  redirect(`/admin?notice=payouts_done&paid=${result.paid}&failed=${result.failed}`);
}
