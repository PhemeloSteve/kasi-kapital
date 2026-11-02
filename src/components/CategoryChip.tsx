import {
  Briefcase,
  ChefHat,
  Croissant,
  Egg,
  Flame,
  Scissors,
  Sprout,
  Store,
  type LucideIcon,
} from "lucide-react";
import { categoryLabels, type BusinessCategory } from "@/domain/business-categories";

const styles: Record<BusinessCategory, { Icon: LucideIcon; className: string }> = {
  tuck_shop: { Icon: Store, className: "bg-blue-50 text-blue-700" },
  bakery: { Icon: Croissant, className: "bg-orange-50 text-orange-700" },
  chicken_farm: { Icon: Egg, className: "bg-yellow-50 text-yellow-700" },
  vegetable_farm: { Icon: Sprout, className: "bg-emerald-50 text-emerald-700" },
  welding: { Icon: Flame, className: "bg-zinc-100 text-zinc-700" },
  hair_beauty: { Icon: Scissors, className: "bg-pink-50 text-pink-700" },
  catering: { Icon: ChefHat, className: "bg-amber-50 text-amber-700" },
  other: { Icon: Briefcase, className: "bg-gray-100 text-gray-700" },
};

export function CategoryChip({ category }: { category: BusinessCategory }) {
  const { Icon, className } = styles[category];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {categoryLabels[category]}
    </span>
  );
}
