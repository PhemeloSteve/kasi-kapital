"use server";

import { redirect } from "next/navigation";
import {
  createGoal,
  saveBusiness,
  type BusinessFieldErrors,
  type GoalFieldErrors,
} from "@/application/business";
import { requireUser } from "@/app/_lib/guard";
import { createBusinessStore } from "@/infrastructure/supabase/business-store";
import {
  readBusinessForm,
  readGoalForm,
  type BusinessFormValues,
  type GoalFormValues,
} from "./form-input";

export type BusinessFormState = {
  status: "idle" | "error";
  message?: string;
  fields?: BusinessFieldErrors;
  values?: BusinessFormValues;
};

export type GoalFormState = {
  status: "idle" | "error";
  message?: string;
  fields?: GoalFieldErrors;
  values?: GoalFormValues;
};

const FAILED = "We couldn't save that. Please try again in a moment.";

export async function saveBusinessAction(
  _prev: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  // Server actions are public endpoints, so every one re-checks who is calling.
  await requireUser(["business"]);
  const { values, input } = readBusinessForm(formData);

  const result = await saveBusiness({ store: createBusinessStore() }, input);
  if (!result.ok) {
    return result.error.code === "invalid_input"
      ? { status: "error", fields: result.error.fields, values }
      : { status: "error", message: FAILED, values };
  }
  redirect("/business");
}

export async function createGoalAction(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser(["business"]);
  const { values, input } = readGoalForm(formData);

  // The business is looked up from the signed-in user, never taken from the form.
  const result = await createGoal({ store: createBusinessStore() }, user.userId, input);
  if (!result.ok) {
    if (result.error.code === "no_business") redirect("/business/profile");
    return result.error.code === "invalid_input"
      ? { status: "error", fields: result.error.fields, values }
      : { status: "error", message: FAILED, values };
  }
  redirect("/business");
}
