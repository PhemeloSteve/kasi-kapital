import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

/**
 * The sign-in screens, from the Kasi Kapital login design.
 * Large screens: your logo on a deep green panel on the left, the form on a cream card on the right.
 * Phones: the logo on cream at the top and the form on a green sheet below it.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-brand-cream lg:flex-row lg:gap-6 lg:bg-brand-deep lg:p-6">
      <section className="flex flex-col items-center justify-center px-8 pb-10 pt-12 lg:flex-1 lg:py-12">
        <Logo tone="dark" priority className="w-[88%] max-w-md lg:hidden" />
        <Logo tone="light" priority className="logo-glow-in hidden w-full max-w-[34rem] lg:block" />
        <p className="mt-10 hidden max-w-sm text-center text-xl leading-snug text-brand-cream/90 lg:block">
          Community funding for South Africa&apos;s small businesses. Support your local
          entrepreneurs.
        </p>
      </section>

      <section className="auth-sheet relative flex flex-1 flex-col rounded-t-[2rem] bg-brand-deep px-6 pb-10 pt-8 text-brand-cream lg:flex-[0.95] lg:justify-center lg:rounded-3xl lg:bg-brand-paper lg:px-14 lg:py-14 lg:text-gray-900">
        <Logo tone="dark" className="absolute right-8 top-6 hidden w-40 lg:block" />
        <div className="mx-auto w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
