import { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import type { MfaGateway } from "./ports";

/**
 * Starts setting up an authenticator app. Refused when the person already has one: otherwise someone who
 * had only stolen a password could enroll their own authenticator and walk straight through two-factor.
 */
export async function beginMfaEnrollment(deps: {
  mfa: MfaGateway;
}): Promise<
  Result<{ factorId: string; qrCode: string; secret: string }, "already_enrolled" | "failed">
> {
  const status = await deps.mfa.getStatus();
  if (status.verifiedFactorId !== null) return err("already_enrolled");
  const started = await deps.mfa.beginEnrollment();
  return started.ok ? ok(started.value) : err("failed");
}

const codeInput = z.object({
  factorId: z.uuid(),
  // People type "123 456" or "123456"; both are fine.
  code: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6}$/)),
});

/** Checks the 6-digit code. If an authenticator is already set up, that one is always used, whatever id was sent. */
export async function verifyMfaCode(
  deps: { mfa: MfaGateway },
  rawInput: unknown,
): Promise<Result<true, "invalid_input" | "invalid_code" | "failed">> {
  const parsed = codeInput.safeParse(rawInput);
  if (!parsed.success) return err("invalid_input");

  const status = await deps.mfa.getStatus();
  const factorId = status.verifiedFactorId ?? parsed.data.factorId;

  const verified = await deps.mfa.verify({ factorId, code: parsed.data.code });
  return verified.ok ? ok(true as const) : err(verified.error);
}
