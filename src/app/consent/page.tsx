import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptConsentAction, logOutAction } from "@/app/(auth)/actions";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { authLinkClass, authPrimaryClass, authSecondaryClass } from "@/components/auth/AuthButton";
import { landingPathForRole } from "@/domain/roles";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

export const metadata = { title: "Privacy consent | Kasi Kapital" };

export default async function ConsentPage() {
  const user = await createAuthGateway().getCurrentUser();
  if (!user) redirect("/login");
  if (user.consented) redirect(landingPathForRole(user.role));

  return (
    <AuthLayout>
      <h1 className="text-3xl font-medium tracking-tight">One more step</h1>
      <p className="mt-3 text-sm text-brand-cream/90 lg:text-gray-700">
        Before you continue, please read our{" "}
        <Link href="/privacy" target="_blank" className={authLinkClass}>
          privacy notice
        </Link>
        . Kasi Kapital handles personal information, including identity and business documents,
        under POPIA.
      </p>
      <form action={acceptConsentAction} className="mt-8">
        <button type="submit" className={authPrimaryClass}>
          I have read it and I agree
        </button>
      </form>
      <form action={logOutAction} className="mt-3">
        <button type="submit" className={authSecondaryClass}>
          Log out instead
        </button>
      </form>
    </AuthLayout>
  );
}
