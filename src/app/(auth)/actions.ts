"use server";

import { redirect } from "next/navigation";
import { logIn, signUp, type FieldErrors } from "@/application/auth";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";
import { readLogInForm, readSignUpForm } from "./form-input";

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
    const message =
      result.error.code === "rate_limited"
        ? "Too many attempts. Please wait a few minutes and try again."
        : "We couldn't create your account. If you already have one, try logging in.";
    return { status: "error", message, values };
  }
  if (result.value.status === "confirm_email") return { status: "confirm_email", values };
  redirect(result.value.landingPath);
}

export async function logInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const credentials = readLogInForm(formData);
  const result = await logIn({ auth: createAuthGateway() }, credentials);

  if (!result.ok) {
    const message =
      result.error === "unavailable"
        ? "The service is temporarily unavailable. Please try again shortly."
        : "Incorrect email or password.";
    return { status: "error", message, values: { email: credentials.email } };
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
