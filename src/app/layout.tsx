import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/dancing-script";
import "./globals.css";

// Pages are built for each request, never ahead of time: the Content Security Policy carries a
// per-request nonce, and a pre-built page could not have one.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Kasi Kapital", template: "%s" },
  description:
    "Community funding for South Africa's small businesses. Support your local entrepreneurs.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = { themeColor: "#0B3B24" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
