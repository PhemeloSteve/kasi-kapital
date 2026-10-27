export const categoryIds = [
  "tuck_shop",
  "bakery",
  "chicken_farm",
  "vegetable_farm",
  "welding",
  "hair_beauty",
  "catering",
  "other",
] as const;

export type BusinessCategory = (typeof categoryIds)[number];

export const categoryLabels: Record<BusinessCategory, string> = {
  tuck_shop: "Tuck shop / spaza",
  bakery: "Bakery",
  chicken_farm: "Chicken farm",
  vegetable_farm: "Vegetable farm",
  welding: "Welding / metalwork",
  hair_beauty: "Hair and beauty",
  catering: "Catering",
  other: "Other",
};

export function isBusinessCategory(value: unknown): value is BusinessCategory {
  return typeof value === "string" && (categoryIds as readonly string[]).includes(value);
}
