import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/SignUpForm";
import { landingPathForRole } from "@/domain/roles";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

export const metadata = { title: "Create account | Kasi Kapital" };

export default async function SignUpPage() {
  const user = await createAuthGateway().getCurrentUser();
  if (user) redirect(user.consented ? landingPathForRole(user.role) : "/consent");
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold text-brand">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Join the community backing South Africa&apos;s small businesses.
      </p>
      <SignUpForm />
    </main>
  );
}
