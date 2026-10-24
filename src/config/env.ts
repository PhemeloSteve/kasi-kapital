import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  KYC_PROVIDER: z.enum(["mock", "sandbox", "live"]).default("mock"),
  OPEN_BANKING_PROVIDER: z.enum(["mock", "sandbox", "live"]).default("mock"),
  PAYMENT_PROVIDER: z.enum(["mock", "sandbox", "live"]).default("mock"),
  UNVERIFIED_CONTRIBUTION_LIMIT_CENTS: z.coerce.number().int().positive().default(100_000),
});

/** Fails fast with a clear message if configuration is wrong. */
export function parsePublicEnv(source: Record<string, string | undefined> = process.env) {
  return publicSchema.parse(source);
}

/** Server-only secrets. Never call from client components. */
export function parseServerEnv(source: Record<string, string | undefined> = process.env) {
  return serverSchema.parse(source);
}
