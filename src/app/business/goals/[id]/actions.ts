"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { submitMilestoneProof } from "@/application/milestones";
import { requireUser } from "@/app/_lib/guard";
import { readProofForm } from "@/app/business/documents/form-input";
import { proofMessages } from "@/app/business/documents/messages";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import { createDocumentStore } from "@/infrastructure/supabase/document-store";
import { createMilestoneStore } from "@/infrastructure/supabase/milestone-store";

export type ProofState = { status: "idle" | "error"; message?: string };

export async function submitProofAction(
  _prev: ProofState,
  formData: FormData,
): Promise<ProofState> {
  const user = await requireUser(["business"]);
  const { milestoneId, goalId, bytes } = await readProofForm(formData);

  const result = await submitMilestoneProof(
    {
      business: createBusinessStore(),
      documents: createDocumentStore(),
      milestones: createMilestoneStore(),
      newId: () => crypto.randomUUID(),
    },
    user.userId,
    { milestoneId, bytes },
  );
  if (!result.ok) return { status: "error", message: proofMessages[result.error] };

  const goal = z.uuid().safeParse(goalId);
  redirect(goal.success ? `/business/goals/${goal.data}?notice=proof_sent` : "/business");
}
