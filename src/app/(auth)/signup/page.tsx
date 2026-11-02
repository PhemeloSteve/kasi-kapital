import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignUpForm } from "@/components/SignUpForm";
import { landingPathForRole } from "@/domain/roles";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

export const metadata = { title: "Create account | Kasi Kapital" };

export default async function SignUpPage() {
  const user = await createAuthGateway().getCurrentUser();
  if (user) redirect(user.consented ? landingPathForRole(user.role) : "/consent");
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}
