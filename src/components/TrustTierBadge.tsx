import { trustTierLabels, type TrustTier } from "@/domain/documents";

const styles: Record<TrustTier, string> = {
  0: "bg-slate-100 text-slate-700",
  1: "bg-slate-100 text-slate-700",
  2: "bg-green-100 text-green-800",
  3: "bg-emerald-200 text-emerald-900",
};

export function TrustTierBadge({ tier }: { tier: TrustTier }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[tier]}`}
    >
      {tier >= 2 && <span aria-hidden="true">✓</span>}
      {trustTierLabels[tier]}
    </span>
  );
}
