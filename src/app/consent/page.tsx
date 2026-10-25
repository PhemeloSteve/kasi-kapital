import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptConsentAction, logOutAction } from "@/app/(auth)/actions";
import { landingPathForRole } from "@/domain/roles";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

export const metadata = { title: "Privacy consent | Kasi Kapital" };

export default async function ConsentPage() {
  const user = await createAuthGateway().getCurrentUser();
  if (!user) redirect("/login");
  if (user.consented) redirect(landingPathForRole(user.role));

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold text-brand">One more step</h1>
      <p className="mt-2 text-sm text-slate-700">
        Before you continue, please read our{" "}
        <Link href="/privacy" target="_blank" className="text-brand underline">
          privacy notice
        </Link>
        . Kasi Kapital handles personal information, including identity and business documents,
        under POPIA.
      </p>
      <form action={acceptConsentAction} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          I have read it and I agree
        </button>
      </form>
      <form action={logOutAction} className="mt-3">
        <button
          type="submit"
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Log out instead
        </button>
      </form>
    </main>
  );
}
