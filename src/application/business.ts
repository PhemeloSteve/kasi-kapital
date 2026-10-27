import { z } from "zod";
import { categoryIds } from "@/domain/business-categories";
import { checkMilestones, MAX_MILESTONES, parseRandToCents } from "@/domain/funding-goal";
import { coarsenLocation } from "@/domain/location-privacy";
import { formatRand } from "@/domain/money";
import { err, ok, type Result } from "@/domain/result";
import { normalizeSocialUrl, type SocialPlatform } from "@/domain/social-links";
import { toFieldErrors } from "./form-errors";
import type { BusinessStore } from "./ports";

// ---------- shared field helpers ----------
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const coordinate = (min: number, max: number) =>
  z.preprocess(
    (v) =>
      typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : null,
    z.number().min(min).max(max).nullable(),
  );

const socialLink = (platform: SocialPlatform) =>
  z
    .string()
    .trim()
    .max(300)
    .transform((value, ctx) => {
      if (value === "") return null;
      const result = normalizeSocialUrl(platform, value);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: "invalid_url" });
        return z.NEVER;
      }
      return result.value;
    });

const rand = z.string().transform((value, ctx) => {
  const cents = parseRandToCents(value);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "invalid_amount" });
    return z.NEVER;
  }
  return cents;
});

// ---------- business profile ----------
export const businessInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    category: z.enum(categoryIds),
    description: optionalText(600),
    suburb: z.string().trim().min(2).max(80),
    lat: coordinate(-90, 90),
    lng: coordinate(-180, 180),
    youtubeUrl: socialLink("youtube"),
    facebookUrl: socialLink("facebook"),
    linkedinUrl: socialLink("linkedin"),
  })
  .refine((v) => (v.lat === null) === (v.lng === null), {
    path: ["lat"],
    message: "incomplete_location",
  });

export type BusinessFieldErrors = Partial<
  Record<
    | "name"
    | "category"
    | "description"
    | "suburb"
    | "lat"
    | "lng"
    | "youtubeUrl"
    | "facebookUrl"
    | "linkedinUrl",
    string
  >
>;

const businessMessages: Record<keyof BusinessFieldErrors, string> = {
  name: "Enter your business name (2 to 120 characters).",
  category: "Choose the kind of business you run.",
  description: "Keep the description under 600 characters.",
  suburb: "Enter your suburb or town (2 to 80 characters).",
  lat: "We couldn't read your location. Try again or leave it out.",
  lng: "We couldn't read your location. Try again or leave it out.",
  youtubeUrl: "Enter a link to a YouTube page, or leave it empty.",
  facebookUrl: "Enter a link to a Facebook page, or leave it empty.",
  linkedinUrl: "Enter a link to a LinkedIn page, or leave it empty.",
};

export type SaveBusinessError =
  { code: "invalid_input"; fields: BusinessFieldErrors } | { code: "save_failed" };

export async function saveBusiness(
  deps: { store: BusinessStore },
  rawInput: unknown,
): Promise<Result<{ id: string }, SaveBusinessError>> {
  const parsed = businessInput.safeParse(rawInput);
  if (!parsed.success) {
    return err({
      code: "invalid_input",
      fields: toFieldErrors(parsed.error.issues, businessMessages),
    });
  }
  const { lat, lng, ...rest } = parsed.data;

  // Privacy by design: only an approximate (~1 km) location ever leaves this function.
  const location = lat !== null && lng !== null ? coarsenLocation({ lat, lng }) : null;

  const saved = await deps.store.saveMyBusiness({ ...rest, location });
  return saved.ok ? ok(saved.value) : err({ code: "save_failed" });
}

// ---------- funding goal ----------
export const goalInput = z.object({
  title: z.string().trim().min(3).max(100),
  description: optionalText(500),
  target: rand,
  kind: z.enum(["donation", "presale"]),
  milestones: z
    .array(z.object({ title: z.string().trim().min(2).max(100), amount: rand }))
    .min(1)
    .max(MAX_MILESTONES),
});

export type GoalFieldErrors = Partial<
  Record<"title" | "description" | "target" | "kind" | "milestones", string>
>;

const goalMessages: Record<keyof GoalFieldErrors, string> = {
  title: "Enter a goal title (3 to 100 characters).",
  description: "Keep the description under 500 characters.",
  target: "Enter the amount you need in rand, for example 5000 or 5000.50.",
  kind: "Choose what supporters get.",
  milestones: `Add 1 to ${MAX_MILESTONES} milestones, each with a name and a rand amount.`,
};

export type CreateGoalError =
  | { code: "invalid_input"; fields: GoalFieldErrors }
  | { code: "no_business" }
  | { code: "save_failed" };

export async function createGoal(
  deps: { store: BusinessStore },
  userId: string,
  rawInput: unknown,
): Promise<Result<{ id: string }, CreateGoalError>> {
  const parsed = goalInput.safeParse(rawInput);
  if (!parsed.success) {
    return err({ code: "invalid_input", fields: toFieldErrors(parsed.error.issues, goalMessages) });
  }
  const { title, description, target, kind, milestones } = parsed.data;

  const check = checkMilestones(
    target,
    milestones.map((m) => m.amount),
  );
  if (!check.ok) {
    const problem = check.error;
    if (problem.code === "target_out_of_range") {
      return err({
        code: "invalid_input",
        fields: { target: "The goal must be between R100 and R1 000 000." },
      });
    }
    const message =
      problem.code === "sum_mismatch"
        ? problem.differenceCents > 0
          ? `Your milestones are ${formatRand(problem.differenceCents)} short of the goal. They must add up exactly.`
          : `Your milestones are ${formatRand(-problem.differenceCents)} over the goal. They must add up exactly.`
        : goalMessages.milestones;
    return err({ code: "invalid_input", fields: { milestones: message } });
  }

  // Ownership comes from the signed-in session, never from the form.
  const business = await deps.store.getMyBusiness(userId);
  if (!business) return err({ code: "no_business" });

  const saved = await deps.store.createGoal(business.id, {
    title,
    description,
    targetCents: target,
    kind,
    milestones: milestones.map((m) => ({ title: m.title, amountCents: m.amount })),
  });
  return saved.ok ? ok(saved.value) : err({ code: "save_failed" });
}
