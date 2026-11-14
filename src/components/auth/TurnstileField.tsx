"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile, the "are you a person?" check on the sign-in and sign-up forms. It adds a hidden
 * field called cf-turnstile-response to the form; the server passes that code to Supabase, which asks
 * Cloudflare whether it is genuine. Nothing happens here unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 *
 * A code works once. Pass something that changes after every submit (the form's result) as `resetSignal`
 * and a fresh check is started, so a second attempt never reuses a spent code.
 */
export function TurnstileField({ resetSignal }: { resetSignal?: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return <TurnstileWidget siteKey={siteKey} resetSignal={resetSignal} />;
}

function TurnstileWidget({ siteKey, resetSignal }: { siteKey: string; resetSignal?: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !container.current || !window.turnstile) return;
    const id = window.turnstile.render(container.current, { sitekey: siteKey, theme: "light" });
    widgetId.current = id;
    return () => {
      window.turnstile?.remove(id);
      widgetId.current = null;
    };
  }, [scriptReady, siteKey]);

  useEffect(() => {
    if (widgetId.current !== null) window.turnstile?.reset(widgetId.current);
  }, [resetSignal]);

  return (
    <>
      {/* Loaded by Next's own script loader, so the page's security policy trusts it. */}
      <Script src={SCRIPT_URL} strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
