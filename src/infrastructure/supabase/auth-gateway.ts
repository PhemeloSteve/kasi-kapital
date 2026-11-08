import { err, ok } from "@/domain/result";
import { effectiveAdminLevel, isUserRole } from "@/domain/roles";
import type { AuthGateway, CurrentUser } from "@/application/ports";
import { parsePublicEnv } from "@/config/env";
import { classifySignUpError } from "./auth-errors";
import { cookies } from "next/headers";
import { KEEP_COOKIE } from "./cookie-policy";
import { createClient } from "./server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function loadCurrentUser(
  supabase: ServerClient,
  userId: string,
): Promise<CurrentUser | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, popia_consent_at, admin_level")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || !isUserRole(profile.role)) return null;
  return {
    userId,
    role: profile.role,
    fullName: profile.full_name,
    consented: profile.popia_consent_at !== null,
    adminLevel: effectiveAdminLevel(profile.role, profile.admin_level),
  };
}

/** Supabase implementation of the AuthGateway port. */
export function createAuthGateway(): AuthGateway {
  return {
    async signUp({ email, password, fullName, role }) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // The database trigger validates the role (admin is never accepted) and
          // timestamps consent itself, so the client cannot forge either.
          data: { role, full_name: fullName, popia_consent: true },
          emailRedirectTo: `${parsePublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });
      if (error) {
        // Log the real cause for the developer. Never log the email or password.
        console.error("[auth] signUp failed", {
          name: error.name,
          status: error.status,
          code: error.code,
        });
        return err(classifySignUpError(error));
      }
      return ok({ hasSession: data.session !== null });
    },

    async signIn({ email, password, keepSignedIn }) {
      const supabase = await createClient({ persist: keepSignedIn });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        if (error)
          console.error("[auth] signIn failed", {
            name: error.name,
            status: error.status,
            code: error.code,
          });
        // 4xx = wrong credentials or unconfirmed email; anything else = service trouble.
        return err(error && (error.status ?? 500) >= 500 ? "unavailable" : "invalid_credentials");
      }
      const user = await loadCurrentUser(supabase, data.user.id);
      if (!user) return err("unavailable");

      // Remember the choice for later requests, so refreshed sign-in cookies follow the same rule.
      (await cookies()).set(KEEP_COOKIE, keepSignedIn ? "1" : "0", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: keepSignedIn ? 60 * 60 * 24 * 400 : undefined,
      });
      return ok(user);
    },

    async signOut() {
      const supabase = await createClient();
      await supabase.auth.signOut();
      (await cookies()).delete(KEEP_COOKIE);
    },

    async getCurrentUser() {
      const supabase = await createClient();
      // getUser() re-validates the token with Supabase; getSession() alone must not be trusted.
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      return loadCurrentUser(supabase, data.user.id);
    },

    async acceptConsent(userId) {
      const supabase = await createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ popia_consent_at: new Date().toISOString() })
        .eq("id", userId);
      return error ? err("failed") : ok(true as const);
    },
  };
}
