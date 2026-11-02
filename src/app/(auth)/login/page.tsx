import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LogInForm } from "@/components/LogInForm";
import { authErrorClass } from "@/components/auth/AuthButton";
import { landingPathForRole } from "@/domain/roles";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

export const metadata = { title: "Sign in | Kasi Kapital" };

export default async function LogInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const user = await createAuthGateway().getCurrentUser();
  if (user) redirect(user.consented ? landingPathForRole(user.role) : "/consent");

  return (
    <AuthLayout>
      {error === "callback" && (
        <p role="alert" className={`${authErrorClass} mb-5`}>
          That confirmation link is invalid or has expired. Try signing in, or sign up again.
        </p>
      )}
      <LogInForm next={next ? safeRedirectPath(next, "") || undefined : undefined} />
    </AuthLayout>
  );
}
