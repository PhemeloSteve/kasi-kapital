import { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import type { BusinessModeration } from "./ports";

const suspendInput = z.object({
  businessId: z.uuid(),
  reason: z.string().trim().min(1).max(300),
});

export type SuspendError =
  "invalid_input" | "reason_required" | "not_allowed" | "not_found" | "failed";

/** A super administrator suspends a business. The database re-checks the level and records the reason. */
export async function suspendBusiness(
  deps: { moderation: BusinessModeration },
  input: { businessId: unknown; reason: unknown },
): Promise<Result<true, SuspendError>> {
  const reasonText = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reasonText === "") return err("reason_required");

  const parsed = suspendInput.safeParse({ businessId: input.businessId, reason: reasonText });
  if (!parsed.success) return err("invalid_input");

  const result = await deps.moderation.suspend(parsed.data);
  return result.ok ? ok(true as const) : err(result.error);
}

export type UnsuspendError =
  "invalid_input" | "not_allowed" | "not_suspended" | "not_found" | "failed";

/** A super administrator reinstates a suspended business. It goes back to "under review". */
export async function unsuspendBusiness(
  deps: { moderation: BusinessModeration },
  input: { businessId: unknown },
): Promise<Result<true, UnsuspendError>> {
  const id = z.uuid().safeParse(input.businessId);
  if (!id.success) return err("invalid_input");

  const result = await deps.moderation.unsuspend(id.data);
  return result.ok ? ok(true as const) : err(result.error);
}
