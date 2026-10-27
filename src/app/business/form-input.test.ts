import { describe, expect, it } from "vitest";
import { businessInput, goalInput } from "@/application/business";
import { readBusinessForm, readGoalForm } from "./form-input";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("readBusinessForm", () => {
  it("reads every field and produces input the use case accepts", () => {
    const { input } = readBusinessForm(
      form({
        name: "Mama T Bakery",
        category: "bakery",
        description: "",
        suburb: "Soweto",
        lat: "-26.27",
        lng: "27.86",
      }),
    );
    expect(input).toMatchObject({
      name: "Mama T Bakery",
      category: "bakery",
      suburb: "Soweto",
      lat: "-26.27",
      lng: "27.86",
    });
    expect(businessInput.safeParse(input).success).toBe(true);
  });

  it("copes with a completely empty form", () => {
    const { input } = readBusinessForm(new FormData());
    expect(input.name).toBe("");
    expect(businessInput.safeParse(input).success).toBe(false);
  });
});

describe("readGoalForm", () => {
  const base = { title: "Buy 50 chicks", description: "", target: "5000", kind: "donation" };

  it("collects filled milestone rows in order and skips empty ones", () => {
    const { input } = readGoalForm(
      form({
        ...base,
        milestoneTitle_1: "Chicks",
        milestoneAmount_1: "3000",
        milestoneTitle_2: "",
        milestoneAmount_2: "",
        milestoneTitle_3: "Feed",
        milestoneAmount_3: "2000",
      }),
    );
    expect(input.milestones).toEqual([
      { title: "Chicks", amount: "3000" },
      { title: "Feed", amount: "2000" },
    ]);
    expect(goalInput.safeParse(input).success).toBe(true);
  });

  it("keeps a half-filled row so the use case can complain about it", () => {
    const { input } = readGoalForm(
      form({ ...base, milestoneTitle_1: "Chicks", milestoneAmount_1: "" }),
    );
    expect(input.milestones).toEqual([{ title: "Chicks", amount: "" }]);
    expect(goalInput.safeParse(input).success).toBe(false);
  });

  it("ignores milestone rows beyond the maximum", () => {
    const { input } = readGoalForm(
      form({ ...base, milestoneTitle_7: "Too many", milestoneAmount_7: "100" }),
    );
    expect(input.milestones).toEqual([]);
  });
});
