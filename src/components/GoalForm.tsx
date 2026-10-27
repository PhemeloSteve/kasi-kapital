"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createGoalAction, type GoalFormState } from "@/app/business/actions";
import { MAX_MILESTONES, parseRandToCents } from "@/domain/funding-goal";
import { formatRand } from "@/domain/money";
import { FormField, SelectField, TextAreaField } from "./FormField";

const kindOptions = [
  { value: "donation", label: "Donation: supporters give and expect nothing back" },
  { value: "presale", label: "Pre-sale: supporters get goods or vouchers later" },
];

function totals(form: HTMLFormElement) {
  const data = new FormData(form);
  const target = parseRandToCents(String(data.get("target") ?? ""));
  let sum = 0;
  for (let i = 1; i <= MAX_MILESTONES; i += 1) {
    const cents = parseRandToCents(String(data.get(`milestoneAmount_${i}`) ?? ""));
    if (cents !== null) sum += cents;
  }
  return { target, sum };
}

export function GoalForm() {
  const [state, action, pending] = useActionState<GoalFormState, FormData>(createGoalAction, {
    status: "idle",
  });
  const v = state.values;
  const f = state.fields ?? {};

  const initialRows = Math.min(MAX_MILESTONES, Math.max(2, v?.milestones.length ?? 0));
  const [rows, setRows] = useState(initialRows);
  const [sums, setSums] = useState<{ target: number | null; sum: number }>({
    target: null,
    sum: 0,
  });

  const matches = sums.target !== null && sums.sum === sums.target;
  const gap = sums.target !== null ? sums.target - sums.sum : null;

  return (
    <form
      action={action}
      onInput={(e) => setSums(totals(e.currentTarget))}
      className="space-y-5"
      noValidate
    >
      {state.message && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      )}

      <FormField
        id="title"
        label="What do you need money for?"
        defaultValue={v?.title}
        error={f.title}
        maxLength={100}
        placeholder="Buy 50 chicks and feed"
      />
      <TextAreaField
        id="description"
        label="Tell supporters more"
        required={false}
        defaultValue={v?.description}
        error={f.description}
        maxLength={500}
      />
      <FormField
        id="target"
        label="Total amount needed (rand)"
        inputMode="decimal"
        defaultValue={v?.target}
        error={f.target}
        placeholder="5000"
        hint="Between R100 and R1 000 000."
      />
      <SelectField
        id="kind"
        label="What do supporters get?"
        options={kindOptions}
        defaultValue={v?.kind ?? "donation"}
        error={f.kind}
      />

      <fieldset className="space-y-3 rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-800">Milestones</legend>
        <p className="text-xs text-slate-600">
          Break the goal into steps. Money is released one step at a time, after you show proof (for
          example a receipt). The amounts must add up to the total.
        </p>
        {Array.from({ length: rows }, (_, index) => {
          const n = index + 1;
          return (
            <div key={n} className="grid grid-cols-[1fr_8rem] gap-3">
              <FormField
                id={`milestoneTitle_${n}`}
                label={`Step ${n}`}
                required={n <= 1}
                defaultValue={v?.milestones[index]?.title}
                maxLength={100}
                placeholder={n === 1 ? "Buy the chicks" : ""}
              />
              <FormField
                id={`milestoneAmount_${n}`}
                label="Rand"
                required={n <= 1}
                inputMode="decimal"
                defaultValue={v?.milestones[index]?.amount}
              />
            </div>
          );
        })}
        {rows < MAX_MILESTONES && (
          <button
            type="button"
            onClick={() => setRows(rows + 1)}
            className="text-sm text-brand underline"
          >
            Add another step
          </button>
        )}
        <p role="status" className={`text-sm ${matches ? "text-green-700" : "text-slate-700"}`}>
          {sums.target === null
            ? "Enter the total amount to see how your steps add up."
            : matches
              ? `Your steps add up to ${formatRand(sums.sum)}. Ready to save.`
              : `Steps add up to ${formatRand(sums.sum)} of ${formatRand(sums.target)}. ${
                  gap !== null && gap > 0
                    ? `${formatRand(gap)} still to place.`
                    : `${formatRand(-(gap ?? 0))} over.`
                }`}
        </p>
        {f.milestones && (
          <p role="alert" className="text-sm text-red-700">
            {f.milestones}
          </p>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create goal"}
        </button>
        <Link href="/business" className="text-sm text-slate-600 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
