"use server";

import { redirect } from "next/navigation";
import { beginMfaEnrollment, verifyMfaCode } from "@/application/mfa";
import { requireUser } from "@/app/_lib/guard";
import { createMfaGateway } from "@/infrastructure/supabase/mfa-gateway";

export type EnrollState = {
  status: "idle" | "error" | "ready";
  message?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
};
export type VerifyState = { status: "idle" | "error"; message?: string };

// These two are the only admin actions reachable before two-factor is complete, hence skipMfa.
export async function beginEnrollmentAction(): Promise<EnrollState> {
  await requireUser(["admin"], { skipMfa: true });
  const result = await beginMfaEnrollment({ mfa: createMfaGateway() });
  if (!result.ok) {
    return {
      status: "error",
      message:
        result.error === "already_enrolled"
          ? "An authenticator is already set up for this account. Enter the code from it instead."
          : "We couldn't start the setup. Please try again.",
    };
  }
  return { status: "ready", ...result.value };
}

export async function verifyMfaAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  await requireUser(["admin"], { skipMfa: true });
  const result = await verifyMfaCode(
    { mfa: createMfaGateway() },
    { factorId: formData.get("factorId"), code: formData.get("code") },
  );
  if (!result.ok) {
    return {
      status: "error",
      message:
        result.error === "failed"
          ? "We couldn't check that code. Please try again."
          : "That code didn't work. Check the 6 digits in your authenticator app and try again; codes change every 30 seconds.",
    };
  }
  redirect("/admin");
}
