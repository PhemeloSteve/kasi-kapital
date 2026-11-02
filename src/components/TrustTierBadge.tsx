import { Award, Shield, ShieldCheck, UserCheck, type LucideIcon } from "lucide-react";
import { trustTierLabels, type TrustTier } from "@/domain/documents";

// Tier 1 grey, Tier 2 green, Tier 3 gold: the badges from the dashboard designs.
const tiers: Record<TrustTier, { text: string; Icon: LucideIcon; className: string }> = {
  0: { text: "Not verified", Icon: Shield, className: "border-gray-200 bg-gray-50 text-gray-600" },
  1: { text: "Tier 1", Icon: UserCheck, className: "border-gray-200 bg-gray-100 text-gray-700" },
  2: {
    text: "Tier 2",
    Icon: ShieldCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  3: { text: "Tier 3", Icon: Award, className: "border-amber-200 bg-amber-50 text-amber-700" },
};

export function TrustTierBadge({ tier }: { tier: TrustTier }) {
  const { text, Icon, className } = tiers[tier];
  return (
    <span
      title={trustTierLabels[tier]}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {text}
      <span className="sr-only">: {trustTierLabels[tier]}</span>
    </span>
  );
}
