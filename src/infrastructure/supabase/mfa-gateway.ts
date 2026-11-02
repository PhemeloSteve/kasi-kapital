import type { AssuranceLevel, MfaGateway } from "@/application/ports";
import { err, ok } from "@/domain/result";
import { createClient } from "./server";

/** Supabase implementation of two-factor login (TOTP authenticator apps). */
export function createMfaGateway(): MfaGateway {
  async function level(): Promise<AssuranceLevel> {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === "aal2" ? "aal2" : "aal1";
  }

  return {
    getLevel: level,

    async getStatus() {
      const supabase = await createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((factor) => factor.status === "verified");
      return { level: await level(), verifiedFactorId: verified?.id ?? null };
    },

    async beginEnrollment() {
      const supabase = await createClient();

      // An abandoned earlier attempt would block a new one, so clear unfinished factors first.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of existing?.all ?? []) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Kasi Kapital",
        friendlyName: `Kasi Kapital admin ${Date.now()}`,
      });
      if (error || !data) {
        console.error("[mfa] enroll failed", { code: error?.code, status: error?.status });
        return err("failed");
      }
      return ok({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    },

    async verify({ factorId, code }) {
      const supabase = await createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) {
        console.error("[mfa] verify failed", { code: error.code, status: error.status });
        // 4xx = the code was wrong or expired; anything else is a service problem.
        return err((error.status ?? 500) >= 500 ? "failed" : "invalid_code");
      }
      return ok(true as const);
    },
  };
}
