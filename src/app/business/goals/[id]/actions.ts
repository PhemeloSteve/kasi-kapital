"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { submitMilestoneProof } from "@/application/milestones";
import { requireUser } from "@/app/_lib/guard";
import { RATE_LIMIT_MESSAGE } from "@/app/_lib/rate-limit";
import { readProofForm } from "@/app/business/documents/form-input";
import { proofMessages } from "@/app/business/documents/messages";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import { createDocumentStore } from "@/infrastructure/supabase/document-store";
import { createMilestoneStore } from "@/infrastructure/supabase/milestone-store";
import { createRateLimiter } from "@/infrastructure/supabase/rate-limiter";

export type ProofState = { status: "idle" | "error"; message?: string };

export async function submitProofAction(
  _prev: ProofState,
  formData: FormData,
): Promise<ProofState> {
  const user = await requireUser(["business"]);
  if (!(await createRateLimiter().allow("proof")))
    return { status: "error", message: RATE_LIMIT_MESSAGE };
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
