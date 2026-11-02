import { Lock, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { authPrimaryClass, authSecondaryClass } from "@/components/auth/AuthButton";
import { landingPathForRole } from "@/domain/roles";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";

const points = [
  {
    Icon: ShieldCheck,
    title: "Every business is checked",
    text: "Identity and trading are verified by our team before anyone can fund a business.",
  },
  {
    Icon: Lock,
    title: "Money is held until proof",
    text: "A founder is paid for each milestone only after an administrator approves their invoice or quote.",
  },
  {
    Icon: MapPin,
    title: "Find businesses near you",
    text: "Back the bakery, farm or workshop down your street, or anywhere in South Africa.",
  },
] as const;

export default async function Home() {
  const user = await createAuthGateway().getCurrentUser();
  if (user) redirect(user.consented ? landingPathForRole(user.role) : "/consent");

  return (
    <AuthLayout>
      <h1 className="text-3xl font-medium leading-tight tracking-tight">
        Back the business down your street.
      </h1>
      <p className="mt-3 text-brand-cream/85 lg:text-gray-600">
        Kasi Kapital helps young founders in townships and rural areas raise money from the people
        around them, safely and in the open.
      </p>

      <ul className="mt-8 space-y-5">
        {points.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-brand-cream lg:bg-brand-light lg:text-brand">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-brand-cream/75 lg:text-gray-600">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-10 space-y-3">
        <Link href="/signup" className={authPrimaryClass}>
          Create an account
        </Link>
        <Link href="/login" className={authSecondaryClass}>
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
