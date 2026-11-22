import { err, ok, type Result } from "@/domain/result";
import type { UserRole } from "@/domain/roles";
import type { AccountEraser } from "./ports";

export const DELETE_CONFIRMATION_WORD = "DELETE";

export type DeleteAccountError = "confirm_required" | "not_allowed" | "money_held" | "failed";

/**
 * A person deletes their own account. It cannot be undone, so they must type the word. Administrators
 * are never deleted this way. The database refuses while money is still held for the person.
 */
export async function deleteAccount(
  deps: { eraser: AccountEraser },
  input: { userId: string; role: UserRole; confirmation: unknown },
): Promise<Result<true, DeleteAccountError>> {
  if (input.role === "admin") return err("not_allowed");

  const typed =
    typeof input.confirmation === "string" ? input.confirmation.trim().toUpperCase() : "";
  if (typed !== DELETE_CONFIRMATION_WORD) return err("confirm_required");

  const result = await deps.eraser.erase(input.userId);
  return result.ok ? ok(true as const) : err(result.error);
}
