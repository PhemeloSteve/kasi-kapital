"use client";

import { useActionState } from "react";
import { submitProofAction, type ProofState } from "@/app/business/goals/[id]/actions";

export function MilestoneProofForm({
  milestoneId,
  goalId,
  label,
}: {
  milestoneId: string;
  goalId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState<ProofState, FormData>(submitProofAction, {
    status: "idle",
  });
  const fileId = `proof-${milestoneId}`;

  return (
    <form action={action} className="mt-2 space-y-2" noValidate>
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <input type="hidden" name="goalId" value={goalId} />
      <label htmlFor={fileId} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={fileId}
          name="file"
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-brand-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-dark"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send proof"}
        </button>
      </div>
      {state.message && (
        <p role="alert" className="text-xs text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
