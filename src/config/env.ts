import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

// Server-only settings are read in small pieces, so a page that needs one never fails because
// an unrelated one is missing.
const serviceSchema = z.object({ SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) });
const paymentSchema = z.object({
  PAYMENT_PROVIDER: z.enum(["mock", "sandbox", "live"]).default("mock"),
});
const demoSchema = z.object({
  // Lets a signed-in supporter mark themselves "identity verified" for demos. Never enable in production.
  ALLOW_DEMO_KYC: z.enum(["true", "false"]).default("false"),
});

type Source = Record<string, string | undefined>;

/** Fails fast with a clear message if configuration is wrong. */
export function parsePublicEnv(source: Source = process.env) {
  return publicSchema.parse(source);
}

/** The service-role key. Server only; never call from client components. */
export function parseServiceEnv(source: Source = process.env) {
  return serviceSchema.parse(source);
}

export function parsePaymentEnv(source: Source = process.env) {
  return paymentSchema.parse(source);
}

export function isDemoKycEnabled(source: Source = process.env): boolean {
  return demoSchema.parse(source).ALLOW_DEMO_KYC === "true";
}

/** True when the server can talk to the database as the service role (needed to confirm payments). */
export function isServiceKeyConfigured(source: Source = process.env): boolean {
  return serviceSchema.safeParse(source).success;
}
