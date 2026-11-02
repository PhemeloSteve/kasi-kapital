"use client";

import Link from "next/link";
import { useActionState } from "react";
import { startContributionAction, type ContributeState } from "@/app/businesses/[id]/actions";
import { formatRand } from "@/domain/money";

export function ContributeForm({
  goalId,
  goalTitle,
  remainingCents,
}: {
  goalId: string;
  goalTitle: string;
  remainingCents: number;
}) {
  const [state, action, pending] = useActionState<ContributeState, FormData>(
    startContributionAction,
    { status: "idle" },
  );
  const inputId = `amount-${goalId}`;

  if (remainingCents <= 0) {
    return (
      <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-900">
        This goal is fully funded. Thank you to everyone who gave.
      </p>
    );
  }

  return (
    <form action={action} className="mt-4 rounded-xl border border-gray-200 p-3" noValidate>
      <input type="hidden" name="goalId" value={goalId} />
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-800">
        Support &ldquo;{goalTitle}&rdquo;
      </label>
      <div className="mt-1 flex flex-wrap items-start gap-2">
        <div>
          <div className="flex items-center rounded-md border border-gray-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
            <span className="pl-3 text-gray-500" aria-hidden="true">
              R
            </span>
            <input
              id={inputId}
              name="amount"
              inputMode="decimal"
              placeholder="250"
              required
              aria-describedby={`${inputId}-hint`}
              className="w-32 rounded-md bg-transparent px-2 py-2 outline-none"
            />
          </div>
          <p id={`${inputId}-hint`} className="mt-1 text-xs text-gray-500">
            From R10 to {formatRand(remainingCents)}
          </p>
        </div>
        <button type="submit" disabled={pending} className="btn-primary px-5">
          {pending ? "Starting…" : "Continue to checkout"}
        </button>
      </div>
      {state.message && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.message}{" "}
          {state.needsVerification && (
            <Link href="/verify-identity" className="font-medium underline">
              Verify your identity
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
