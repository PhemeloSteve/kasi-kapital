import { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import { landingPathForRole, signupRoles } from "@/domain/roles";
import { toFieldErrors } from "./form-errors";
import type { AuthGateway } from "./ports";

const email = z.string().trim().toLowerCase().pipe(z.email());

export const signUpInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  email,
  // 72 is bcrypt's limit; 10 matches the Supabase minimum.
  password: z.string().min(10).max(72),
  role: z.enum(signupRoles),
  consent: z.literal(true),
});

export const logInInput = z.object({
  email,
  password: z.string().min(1).max(72),
  keep: z.boolean().default(false),
});

export type FieldErrors = Partial<
  Record<"fullName" | "email" | "password" | "role" | "consent", string>
>;

const fieldMessages: Record<keyof FieldErrors, string> = {
  fullName: "Enter your full name.",
  email: "Enter a valid email address.",
  password: "Use between 10 and 72 characters.",
  role: "Choose how you will use Kasi Kapital.",
  consent: "You must accept the privacy notice to create an account.",
};

export type SignUpError =
  | { code: "invalid_input"; fields: FieldErrors }
  | { code: "signup_failed" }
  | { code: "rate_limited" };

export type SignUpOutcome =
  { status: "signed_in"; landingPath: string } | { status: "confirm_email" };

export async function signUp(
  deps: { auth: AuthGateway },
  rawInput: unknown,
): Promise<Result<SignUpOutcome, SignUpError>> {
  const parsed = signUpInput.safeParse(rawInput);
  if (!parsed.success)
    return err({
      code: "invalid_input",
      fields: toFieldErrors(parsed.error.issues, fieldMessages),
    });
  const { fullName, email, password, role } = parsed.data;

  const created = await deps.auth.signUp({ email, password, fullName, role });
  if (!created.ok) {
    if (created.error === "weak_password") {
      return err({
        code: "invalid_input",
        fields: { password: "That password is too easy to guess. Try a longer phrase." },
      });
    }
    if (created.error === "invalid_email") {
      return err({
        code: "invalid_input",
        fields: { email: "That email address can't be used. Try a different one." },
      });
    }
    return err({ code: created.error === "rate_limited" ? "rate_limited" : "signup_failed" });
  }
  if (!created.value.hasSession) return ok({ status: "confirm_email" });
  return ok({ status: "signed_in", landingPath: landingPathForRole(role) });
}

export type LogInError = "invalid_input" | "invalid_credentials" | "unavailable";

export async function logIn(
  deps: { auth: AuthGateway },
  rawInput: unknown,
): Promise<Result<{ landingPath: string }, LogInError>> {
  const parsed = logInInput.safeParse(rawInput);
  if (!parsed.success) return err("invalid_input");

  const { email, password, keep } = parsed.data;
  const signedIn = await deps.auth.signIn({ email, password, keepSignedIn: keep });
  if (!signedIn.ok) return err(signedIn.error);

  const user = signedIn.value;
  // Users without recorded consent are sent to give it before anything else.
  return ok({ landingPath: user.consented ? landingPathForRole(user.role) : "/consent" });
}
