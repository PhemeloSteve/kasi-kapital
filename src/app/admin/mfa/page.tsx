import { redirect } from "next/navigation";
import { logOutAction } from "@/app/(auth)/actions";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { authLinkClass } from "@/components/auth/AuthButton";
import { MfaForm } from "@/components/MfaForm";
import { requireUser } from "@/app/_lib/guard";
import { createMfaGateway } from "@/infrastructure/supabase/mfa-gateway";

export const metadata = { title: "Two-factor login | Kasi Kapital" };

export default async function AdminMfaPage() {
  await requireUser(["admin"], { skipMfa: true });
  const status = await createMfaGateway().getStatus();
  if (status.level === "aal2") redirect("/admin");

  return (
    <AuthLayout>
      <h1 className="text-3xl font-medium tracking-tight">
        {status.verifiedFactorId ? "Two-factor login" : "Set up two-factor login"}
      </h1>
      <p className="mb-6 mt-2 text-sm text-brand-cream/85 lg:text-gray-600">
        Administrator access needs a second step after your password.
      </p>
      <MfaForm existingFactorId={status.verifiedFactorId} />
      <form action={logOutAction} className="mt-6 text-center text-sm">
        <button type="submit" className={authLinkClass}>
          Log out
        </button>
      </form>
    </AuthLayout>
  );
}
