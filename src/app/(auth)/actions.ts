"use server";

import { redirect } from "next/navigation";
import { logIn, signUp, type FieldErrors } from "@/application/auth";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";
import { readLogInForm, readSignUpForm } from "./form-input";
import { logInErrorMessage, signUpErrorMessage } from "./messages";

export type FormState = {
  status: "idle" | "error" | "confirm_email";
  message?: string;
  fields?: FieldErrors;
  /** Non-sensitive values to re-fill the form with. Passwords are never returned. */
  values?: { fullName?: string; email?: string; role?: string; consent?: boolean };
};

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { values, input } = readSignUpForm(formData);
  const result = await signUp({ auth: createAuthGateway() }, input);

  if (!result.ok) {
    if (result.error.code === "invalid_input") {
      return { status: "error", fields: result.error.fields, values };
    }
    return { status: "error", message: signUpErrorMessage(result.error.code), values };
  }
  if (result.value.status === "confirm_email") return { status: "confirm_email", values };
  redirect(result.value.landingPath);
}

export async function logInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const credentials = readLogInForm(formData);
  const result = await logIn({ auth: createAuthGateway() }, credentials);

  if (!result.ok) {
    return {
      status: "error",
      message: logInErrorMessage(result.error),
      values: { email: credentials.email },
    };
  }
  const next = safeRedirectPath(formData.get("next"), result.value.landingPath);
  redirect(result.value.landingPath === "/consent" ? "/consent" : next);
}

export async function logOutAction(): Promise<void> {
  await createAuthGateway().signOut();
  redirect("/login");
}

export async function acceptConsentAction(): Promise<void> {
  const gateway = createAuthGateway();
  const user = await gateway.getCurrentUser();
  if (!user) redirect("/login");
  await gateway.acceptConsent(user.userId);
  redirect("/");
}
