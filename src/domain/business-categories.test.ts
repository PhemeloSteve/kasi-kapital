import { describe, expect, it } from "vitest";
import { categoryIds, categoryLabels, isBusinessCategory } from "./business-categories";

describe("business categories", () => {
  it("has a label for every category", () => {
    for (const id of categoryIds) expect(categoryLabels[id]).toBeTruthy();
  });
  it("recognises only real categories", () => {
    expect(isBusinessCategory("bakery")).toBe(true);
    expect(isBusinessCategory("drug_dealer")).toBe(false);
    expect(isBusinessCategory(undefined)).toBe(false);
  });
});
