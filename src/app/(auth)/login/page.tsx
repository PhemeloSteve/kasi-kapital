import { redirect } from "next/navigation";
import { LogInForm } from "@/components/LogInForm";
import { landingPathForRole } from "@/domain/roles";
import { safeRedirectPath } from "@/domain/safe-redirect";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

export const metadata = { title: "Log in | Kasi Kapital" };

export default async function LogInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const user = await createAuthGateway().getCurrentUser();
  if (user) redirect(user.consented ? landingPathForRole(user.role) : "/consent");

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold text-brand">Log in</h1>
      {error === "callback" && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          That confirmation link is invalid or has expired. Try logging in, or sign up again.
        </p>
      )}
      <div className="mt-6">
        <LogInForm next={next ? safeRedirectPath(next, "") || undefined : undefined} />
      </div>
    </main>
  );
}
