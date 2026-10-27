import { MAX_MILESTONES } from "@/domain/funding-goal";

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export type BusinessFormValues = {
  name: string;
  category: string;
  description: string;
  suburb: string;
  lat: string;
  lng: string;
  youtubeUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
};

/** The business form holds no secrets, so the values can be sent back to refill it. */
export function readBusinessForm(formData: FormData): {
  values: BusinessFormValues;
  input: BusinessFormValues;
} {
  const values: BusinessFormValues = {
    name: text(formData, "name"),
    category: text(formData, "category"),
    description: text(formData, "description"),
    suburb: text(formData, "suburb"),
    lat: text(formData, "lat"),
    lng: text(formData, "lng"),
    youtubeUrl: text(formData, "youtubeUrl"),
    facebookUrl: text(formData, "facebookUrl"),
    linkedinUrl: text(formData, "linkedinUrl"),
  };
  return { values, input: values };
}

export type GoalFormValues = {
  title: string;
  description: string;
  target: string;
  kind: string;
  milestones: { title: string; amount: string }[];
};

/** Milestone rows are numbered 1..6; rows with neither a name nor an amount are skipped. */
export function readGoalForm(formData: FormData): {
  values: GoalFormValues;
  input: GoalFormValues;
} {
  const milestones: GoalFormValues["milestones"] = [];
  for (let i = 1; i <= MAX_MILESTONES; i += 1) {
    const title = text(formData, `milestoneTitle_${i}`).trim();
    const amount = text(formData, `milestoneAmount_${i}`).trim();
    if (title !== "" || amount !== "") milestones.push({ title, amount });
  }
  const values: GoalFormValues = {
    title: text(formData, "title"),
    description: text(formData, "description"),
    target: text(formData, "target"),
    kind: text(formData, "kind"),
    milestones,
  };
  return { values, input: values };
}
